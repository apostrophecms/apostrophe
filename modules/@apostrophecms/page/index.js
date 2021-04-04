const _ = require('lodash');
const path = require('path');

module.exports = {
  cascades: [ 'batchOperations' ],
  options: {
    alias: 'page',
    types: [
      {
        // So that the minimum parked pages don't result in an error when home has no manager. -Tom
        name: '@apostrophecms/home-page',
        label: 'Home'
      }
    ],
    quickCreate: true
  },
  batchOperations: {
    add: {
      archive: {
        label: 'Archive'
      },
      publish: {
        label: 'Publish'
      },
      unpublish: {
        label: 'Unpublish'
      }
    }
  },
  async init(self) {
    self.typeChoices = self.options.types || [];
    self.parked = (self.options.minimumPark || [ {
      slug: '/',
      parkedId: 'home',
      _defaults: {
        title: 'Home',
        type: '@apostrophecms/home-page'
      },
      _children: [ {
        slug: '/archive',
        parkedId: 'archive',
        type: '@apostrophecms/archive-page',
        archived: true,
        orphan: true,
        title: 'Archive'
      } ]
    } ]).concat(self.options.park || []);
    self.addManagerModal();
    self.addEditorModal();
    self.enableBrowserData();
    self.addDeduplicateRanksMigration();
    self.addFixHomePagePathMigration();
    self.addMissingLastTargetIdAndPositionMigration();
    self.addArchivedMigration();
    await self.createIndexes();
  },
  restApiRoutes(self) {
    return {
      // Trees are arranged in a tree, not a list. So this API returns the home page,
      // with _children populated if ?_children=1 is in the query string. An editor can
      // also get a light version of the entire tree with ?all=1, for use in a
      // drag-and-drop UI.
      //
      // If flat=1 is present, the pages are returned as a flat list rather than a tree,
      // and the `_children` property of each is just an array of `_id`s.
      //
      // If ?autocomplete=x is present, then an autocomplete prefix search for pages
      // matching that string is carried out, and a flat list of pages is returned,
      // with no `_children`. This is mainly useful to our relationship editor.
      // The user must have some page editing privileges to use it. The 10 best
      // matches are returned as an object with a `results` property containing the
      // array of pages.

      async getAll(req) {
        self.publicApiCheck(req);
        const all = self.apos.launder.boolean(req.query.all);
        const archived = self.apos.launder.booleanOrNull(req.query.archived);
        const flat = self.apos.launder.boolean(req.query.flat);
        const autocomplete = self.apos.launder.string(req.query.autocomplete);

        if (autocomplete.length) {
          if (!self.apos.permission.can(req, 'edit', '@apostrophecms/page')) {
            throw self.apos.error('forbidden');
          }
          return {
            // For consistency with the pieces REST API we
            // use a results property when returning a flat list
            results: await self.getRestQuery(req).limit(10).relationships(false).areas(false).toArray()
          };
        }

        if (all) {
          if (!self.apos.permission.can(req, 'edit', '@apostrophecms/page')) {
            throw self.apos.error('forbidden');
          }
          const page = await self.getRestQuery(req).and({ level: 0 }).children({
            depth: 1000,
            archived,
            orphan: null,
            relationships: false,
            areas: false,
            permission: false,
            project: self.getAllProjection()
          }).toObject();

          if (!page) {
            throw self.apos.error('notfound');
          }

          let data = [ page ];

          // Prune pages we can't reorganize
          data = clean(data);
          if (flat) {
            const result = [];
            flatten(result, data[0]);

            return {
              // For consistency with the pieces REST API we
              // use a results property when returning a flat list
              results: result
            };
          }
          return data[0];
        } else {
          const result = await self.getRestQuery(req).and({ level: 0 }).toObject();
          if (!result) {
            throw self.apos.error('notfound');
          }

          // Attach `_url` and `_urls` properties to the home page
          self.apos.attachment.all(result, { annotate: true });
          return result;
        }

        // If I can't edit at least one of a node's
        // descendants, prune it from the tree. Returns
        // a pruned version of the tree

        function clean(nodes) {
          mark(nodes, []);
          return prune(nodes);
          function mark(nodes, ancestors) {
            _.each(nodes, function(node) {
              if (node._edit) {
                // TODO: Ensure `good` is removed from API responses.
                node.good = true;
                _.each(ancestors, function(ancestor) {
                  ancestor.good = true;
                });
              }
              mark(node._children || [], ancestors.concat([ node ]));
            });
          }
          function prune(nodes) {
            const newNodes = [];
            _.each(nodes, function(node) {
              node._children = prune(node._children || []);
              if (node.good) {
                newNodes.push(node);
              }
            });
            return newNodes;
          }

        }
        function flatten(result, node) {
          const children = node._children;
          node._children = _.map(node._children, '_id');
          result.push(node);
          _.each(children || [], function(child) {
            flatten(result, child);
          });

        }
      },
      // _id may be a page _id, or the convenient shorthands
      // `_home` or `_archive`
      async getOne(req, _id) {
        self.publicApiCheck(req);
        _id = self.inferIdLocaleAndMode(req, _id);
        const criteria = self.getIdCriteria(_id);
        const result = await self.getRestQuery(req).and(criteria).toObject();
        if (!result) {
          throw self.apos.error('notfound');
        }
        if (self.apos.launder.boolean(req.query['render-areas']) === true) {
          await self.apos.area.renderDocsAreas(req, [ result ]);
        }
        // Attach `_url` and `_urls` properties
        self.apos.attachment.all(result, { annotate: true });
        return result;
      },
      // POST a new page to the site. The schema fields should be part of the JSON request body.
      //
      // You may pass `_targetId` and `_position` to specify the location in the page tree.
      // `_targetId` is the _id of another page, and `_position` may be `before`, `after`,
      // `firstChild` or `lastChild`.
      //
      // If you do not specify these properties they default to the homepage and `lastChild`,
      // creating a subpage of the home page.
      //
      // You may pass _copyingId. If you do all properties not in `req.body` are copied from it.
      //
      // This call is atomic with respect to other REST write operations on pages.
      async post(req) {
        self.publicApiCheck(req);
        req.body._position = req.body._position || 'lastChild';
        let targetId = self.apos.launder.string(req.body._targetId);
        let position = self.apos.launder.string(req.body._position);
        // Here we have to normalize before calling insert because we
        // need the parent page to call newChild(). insert calls again but
        // sees there's no work to be done, so no performance hit
        const normalized = await self.getTargetIdAndPosition(req, null, targetId, position);
        targetId = normalized.targetId;
        position = normalized.position;
        const copyingId = self.apos.launder.id(req.body._copyingId);
        const input = _.omit(req.body, '_targetId', '_position', '_copyingId');
        if (typeof (input) !== 'object') {
          // cheeky
          throw self.apos.error('invalid');
        }

        if (req.body._newInstance) {
          // If we're looking for a fresh page instance and aren't saving yet,
          // simply get a new page doc and return;
          const parentPage = await self.findForEditing(req, { _id: targetId })
            .permission('edit', '@apostrophecms/page').toObject();
          return self.newChild(parentPage);
        }

        return self.withLock(req, async () => {
          const targetPage = await self.findForEditing(req, targetId ? { _id: targetId } : { level: 0 }).ancestors(true).permission('edit-@apostrophecms/page').toObject();
          if (!targetPage) {
            throw self.apos.error('notfound');
          }
          const manager = self.apos.doc.getManager(self.apos.launder.string(input.type));
          if (!manager) {
            // sneaky
            throw self.apos.error('invalid');
          }
          let page;
          if ((position === 'firstChild') || (position === 'lastChild')) {
            page = self.newChild(targetPage);
          } else {
            const parentPage = targetPage._ancestors[targetPage._ancestors.length - 1];
            if (!parentPage) {
              throw self.apos.error('notfound');
            }
            page = self.newChild(parentPage);
          }
          await manager.convert(req, input, page, {
            onlyPresentFields: true,
            copyingId
          });
          await self.insert(req, targetPage._id, position, page, { lock: false });
          return self.findOneForEditing(req, { _id: page._id }, { attachments: true });
        });
      },
      // Consider using `PATCH` instead unless you're sure you have 100% up to date
      // data for every property of the page. If you are trying to change one thing,
      // `PATCH` is a smarter choice.
      //
      // Update the page via `PUT`. The entire page, including all areas,
      // must be in req.body.
      //
      // To move a page in the tree at the same time, you may pass `_targetId` and
      // `_position`. Unlike normal properties passed to PUT these are not mandatory
      // to pass every time.
      //
      // This call is atomic with respect to other REST write operations on pages.
      //
      // If `_advisoryLock: { tabId: 'xyz', lock: true }` is passed, the operation will begin by obtaining an advisory
      // lock on the document for the given context id, and no other items in the patch will be addressed
      // unless that succeeds. The client must then refresh the lock frequently (by default, at least
      // every 30 seconds) with repeated PATCH requests of the `_advisoryLock` property with the same
      // context id. If `_advisoryLock: { tabId: 'xyz', lock: false }` is passed, the advisory lock will be
      // released *after* addressing other items in the same patch. If `force: true` is added to
      // the `_advisoryLock` object it will always remove any competing advisory lock.
      //
      // `_advisoryLock` is only relevant if you want to ask others not to edit the document while you are
      // editing it in a modal or similar.

      async put(req, _id) {
        self.publicApiCheck(req);
        _id = self.inferIdLocaleAndMode(req, _id);
        return self.withLock(req, async () => {
          const page = await self.find(req, { _id }).toObject();
          if (!page) {
            throw self.apos.error('notfound');
          }
          if (!page._edit) {
            throw self.apos.error('forbidden');
          }
          const input = req.body;
          const manager = self.apos.doc.getManager(self.apos.launder.string(input.type) || page.type);
          if (!manager) {
            throw self.apos.error('invalid');
          }
          let tabId = null;
          let lock = false;
          let force = false;
          if (input._advisoryLock && ((typeof input._advisoryLock) === 'object')) {
            tabId = self.apos.launder.string(input._advisoryLock.tabId);
            lock = self.apos.launder.boolean(input._advisoryLock.lock);
            force = self.apos.launder.boolean(input._advisoryLock.force);
          }
          if (tabId && lock) {
            await self.apos.doc.lock(req, page, tabId, {
              force
            });
          }
          self.enforceParkedProperties(req, page, input);
          await manager.convert(req, input, page);
          await self.update(req, page);
          if (input._targetId) {
            const targetId = self.apos.launder.string(input._targetId);
            const position = self.apos.launder.string(input._position);
            await self.move(req, page._id, targetId, position);
          }
          if (tabId && !lock) {
            await self.apos.doc.unlock(req, page, tabId);
          }
          return self.findOneForEditing(req, { _id: page._id }, { attachments: true });
        });
      },
      // Unimplemented; throws a 501 status code. This would truly and permanently remove the thing, per the REST spec.
      // To manipulate apostrophe's archived status for something, use a `PATCH` call to modify the `archived` property and set
      // it to `true` or `false`. TODO: robust DELETE support as part of a recycle-bin-emptying UI with a big fat
      // confirmation on it. Future implementation must also consider whether attachments have zero remaining references not
      // fully deleted, which isn't the same as having references still in the archive.
      async delete(req, _id) {
        self.publicApiCheck(req);
        _id = self.inferIdLocaleAndMode(req, _id);
        const page = await self.findOneForEditing(req, {
          _id
        });
        return self.delete(req, page);
      },
      // Patch some properties of the page.
      //
      // You may pass `_targetId` and `_position` to move the page within the tree. `_position`
      // may be `before`, `after` or `inside`. To move a page into or out of the archive, set
      // `archived` to `true` or `false`.
      patch(req, _id) {
        self.publicApiCheck(req);
        _id = self.inferIdLocaleAndMode(req, _id);
        return self.patch(req, _id);
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        ':_id/publish': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing({
            ...req,
            mode: 'draft'
          }, {
            aposDocId: _id.split(':')[0]
          });
          if (!draft) {
            throw self.apos.error('notfound');
          }
          if (!draft.aposLocale) {
            // Not subject to draft/publish workflow
            throw self.apos.error('invalid');
          }
          return self.publish(req, draft);
        },
        ':_id/unpublish': async (req) => {
          const _id = self.apos.i18n.inferIdLocaleAndMode(req, req.params._id);
          const aposDocId = _id.replace(/:.*$/, '');
          const published = await self.findOneForEditing({
            ...req,
            mode: 'published'
          }, {
            aposDocId
          });
          if (!published) {
            throw self.apos.error('notfound');
          }
          return self.withLock(req, async () => {
            const manager = self.apos.doc.getManager(published.type);
            manager.emit('beforeUnpublish', req, published);
            await self.apos.doc.delete({
              ...req,
              mode: 'published'
            }, published);
            await self.apos.doc.db.updateOne({
              _id: published._id.replace(':published', ':draft')
            }, {
              $set: {
                modified: 1
              },
              $unset: {
                lastPublishedAt: 1
              }
            });
            return true;
          });
        },
        ':_id/revert-draft-to-published': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing({
            ...req,
            mode: 'draft'
          }, {
            aposDocId: _id.split(':')[0]
          });
          if (!draft) {
            throw self.apos.error('notfound');
          }
          if (!draft.aposLocale) {
            // Not subject to draft/publish workflow
            throw self.apos.error('invalid');
          }
          return self.revertDraftToPublished(req, draft);
        },
        ':_id/revert-published-to-previous': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const published = await self.findOneForEditing({
            ...req,
            mode: 'published'
          }, {
            aposDocId: _id.split(':')[0]
          });
          if (!published) {
            throw self.apos.error('notfound');
          }
          if (!published.aposLocale) {
            // Not subject to draft/publish workflow
            throw self.apos.error('invalid');
          }
          return self.revertPublishedToPrevious(req, published);
        }
      }
    };
  },
  handlers(self) {
    return {
      beforeSend: {
        async addLevelAttributeToBody(req) {
          // Add level as a data attribute on the body tag
          // The admin bar uses this to stay open if configured by the user
          if (typeof _.get(req, 'data.page.level') === 'number') {
            self.apos.template.addBodyDataAttribute(req, { 'apos-level': req.data.page.level });
          }
        },
        async attachHomeBeforeSend(req) {

          // Did something else already set it?
          if (req.data.home) {
            return;
          }
          // Was this explicitly disabled?
          if (self.options.home === false) {
            return;
          }
          // Avoid redundant work when ancestors are available. They won't be if they are
          // not enabled OR we're not on a regular CMS page at the moment
          if (req.data.page && req.data.page._ancestors && req.data.page._ancestors[0]) {
            req.data.home = req.data.page._ancestors[0];
            return;
          }
          // Fetch the home page with the same builders used to fetch ancestors, for consistency.
          // If builders for ancestors are not configured, then by default we still fetch the children of the
          // home page, so that tabs are easy to implement. However allow this to be
          // expressly shut off:
          //
          // home: { children: false }
          const builders = self.getServePageBuilders().ancestors ||
            {
              children: !(self.options.home && self.options.home.children === false)
            };
          const query = self.find(req, { level: 0 }).ancestorPerformanceRestrictions();
          _.each(builders, function (val, key) {
            query[key](val);
          });
          req.data.home = await query.toObject();
        }
      },
      'apostrophe:modulesReady': {
        validateTypeChoices() {
          for (const choice of self.typeChoices) {
            if (!choice.name) {
              throw new Error('One of the page types specified for your types option has no name property.');
            }
            if (!choice.label) {
              throw new Error('One of the page types specified for your types option has no label property.');
            }
            if (!self.apos.modules[choice.name]) {
              let error = `There is no module named ${choice.name}, but it is configured as a page type\nin your types option.`;
              if (choice.name === 'home-page') {
                error += '\n\nYou probably meant @apostrophecms/home-page.';
              }
              throw new Error(error);
            }
          }
        },
        async manageOrphans() {
          const managed = self.apos.doc.getManaged();

          const parkedTypes = self.getParkedTypes();
          for (const type of parkedTypes) {
            if (!_.includes(managed, type)) {
              self.apos.util.warnDev(`The park option of the @apostrophecms/page module contains type
${type} but there is no module that manages that type. You must
implement a module of that name that extends @apostrophecms/piece-type
or @apostrophecms/page-type, or remove the entry from park.`);
            }
          }
          const distinct = await self.apos.doc.db.distinct('type');
          for (const type of distinct) {
            if (!_.includes(managed, type)) {
              self.apos.util.warnDev(`The aposDocs mongodb collection contains docs with the type ${type || 'undefined or null'}
but there is no module that manages that type. You must implement
a module of that name that extends @apostrophecms/piece-type or
@apostrophecms/page-type, or remove these documents from the
database.`);
              self.apos.doc.managers[type] = {
                // Do-nothing placeholder manager
                schema: [],
                find(req) {
                  return [];
                },
                isAdminOnly() {
                  return true;
                },
                isLocalized() {
                  return false;
                }
              };
            }
          }
        }
      },
      'apostrophe:afterInit': {
        addServeRoute() {
          self.apos.app.get('*', self.serve);
        },
        async implementParkAll() {
          const req = self.apos.task.getReq();
          for (const item of self.parked) {
            await self.implementParkOne(req, item);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      find(req, criteria = {}, options = {}) {
        return self.apos.modules['@apostrophecms/any-page-type'].find(req, criteria, options);
      },
      getIdCriteria(_id) {
        return (_id === '_home') ? {
          level: 0
        } : (_id === '_archive') ? {
          level: 1,
          archived: true
        } : {
          _id
        };
      },
      // Implementation of the PATCH route. Factored as a method to allow
      // it to be called from the universal @apostrophecms/doc PATCH route
      // as well.
      //
      // However if you plan to submit many patches over a period of time while editing you may also
      // want to use the advisory lock mechanism.
      //
      // If `_advisoryLock: { tabId: 'xyz', lock: true }` is passed, the operation will begin by obtaining an advisory
      // lock on the document for the given context id, and no other items in the patch will be addressed
      // unless that succeeds. The client must then refresh the lock frequently (by default, at least
      // every 30 seconds) with repeated PATCH requests of the `_advisoryLock` property with the same
      // context id. If `_advisoryLock: { tabId: 'xyz', lock: false }` is passed, the advisory lock will be
      // released *after* addressing other items in the same patch. If `force: true` is added to
      // the `_advisoryLock` object it will always remove any competing advisory lock.
      //
      // `_advisoryLock` is only relevant if you plan to make ongoing edits over a period of time
      // and wish to avoid conflict with other users. You do not need it for one-time patches.
      //
      // If `input._patches` is an array of patches to the same document, this method
      // will iterate over those patches as if each were `input`, applying all of them
      // within a single lock and without redundant network operations. This greatly
      // improves the performance of saving all changes to a document at once after
      // accumulating a number of changes in patch form on the front end. If _targetId and
      // _position are present only the last such values given in the array of patches
      // are applied.
      async patch(req, _id) {
        return self.withLock(req, async () => {
          const input = req.body;
          const page = await self.findOneForEditing(req, { _id });
          let result;
          if (!page) {
            throw self.apos.error('notfound');
          }
          if (!page._edit) {
            throw self.apos.error('forbidden');
          }
          const patches = Array.isArray(input._patches) ? input._patches : [ input ];
          // Conventional for loop so we can handle the last one specially
          for (let i = 0; (i < patches.length); i++) {
            const input = patches[i];
            let tabId = null;
            let lock = false;
            let force;
            if (input._advisoryLock && ((typeof input._advisoryLock) === 'object')) {
              tabId = self.apos.launder.string(input._advisoryLock.tabId);
              lock = self.apos.launder.boolean(input._advisoryLock.lock);
              force = self.apos.launder.boolean(input._advisoryLock.force);
            }
            if (tabId && lock) {
              await self.apos.doc.lock(req, page, tabId, {
                force
              });
            }
            self.enforceParkedProperties(req, page, input);
            await self.applyPatch(req, page, input);
            if (i === (patches.length - 1)) {
              await self.update(req, page);
              if (input._targetId) {
                const targetId = self.apos.launder.string(input._targetId);
                const position = self.apos.launder.string(input._position);
                await self.move(req, page._id, targetId, position);
              }
              result = self.findOneForEditing(req, { _id }, { attachments: true });
            }
            if (tabId && !lock) {
              await self.apos.doc.unlock(req, page, tabId);
            }
          }
          if (!result) {
            // Edge case: empty `_patches` array. Don't be a pain,
            // return the document as-is
            return self.findOneForEditing(req, { _id }, { attachments: true });
          }
          return result;
        });
      },
      // Apply a single patch to the given page without saving. An implementation detail of the
      // patch method, also used by the undo mechanism to simulate patches.
      // Does not handle _targetId, that is implemented in the patch method.
      async applyPatch(req, page, input) {
        const manager = self.apos.doc.getManager(self.apos.launder.string(input.type) || page.type);
        if (!manager) {
          throw self.apos.error('invalid');
        }
        self.apos.schema.implementPatchOperators(input, page);
        const parentPage = page._ancestors.length && page._ancestors[page._ancestors.length - 1];
        const schema = self.apos.schema.subsetSchemaForPatch(self.allowedSchema(req, {
          ...page,
          type: manager.name
        }, parentPage), input);
        await self.apos.schema.convert(req, schema, input, page);
        await manager.emit('afterConvert', req, input, page);
      },
      // True delete. Will throw an error if the page
      // has descendants
      async delete(req, page, options = {}) {
        return self.apos.doc.delete(req, page, options);
      },
      getBrowserData(req) {
        const browserOptions = _.pick(self, 'action', 'schema', 'types');
        _.assign(browserOptions, _.pick(self.options, 'batchOperations'));
        _.defaults(browserOptions, {
          label: 'Page',
          pluralLabel: 'Pages',
          components: {}
        });
        _.defaults(browserOptions.components, {
          insertModal: 'AposDocEditor',
          managerModal: 'AposPagesManager'
        });

        if (req.data.bestPage) {
          browserOptions.page = self.pruneCurrentPageForBrowser(req.data.bestPage);
        }
        browserOptions.name = self.__meta.name;
        browserOptions.quickCreate = self.options.quickCreate;
        return browserOptions;
      },
      // Returns a query that finds pages the current user can edit
      // in a batch operation.
      //
      // `req` determines what the user is eligible to edit, `criteria`
      // is the MongoDB criteria object, and any properties of `options`
      // are invoked as methods on the query with their values.
      findForBatch(req, criteria = {}, options = {}) {
        const query = self.find(req, criteria, options).permission('edit').archived(null);
        return query;
      },
      // Insert a page. `targetId` must be an existing page id, and
      // `position` may be `before`, `inside` or `after`. Alternatively
      // `position` may be a zero-based offset for the new child
      // of `targetId` (note that the `rank` property of sibling pages
      // is not strictly ascending, so use an array index into `_children` to
      // determine this parameter instead).
      //
      // The `options` argument may be omitted completely. If
      // `options.permissions` is explicitly set to false, permissions checks
      // are bypassed.
      //
      // Returns the new page.
      //
      // If `options.permissions` is explicitly set to false, permissions checks
      // are bypassed.
      async insert(req, targetId, position, page, options = {}) {
        // Handle numeric positions
        const normalized = await self.getTargetIdAndPosition(req, null, targetId, position);
        targetId = normalized.targetId;
        position = normalized.position;
        return self.withLock(req, async () => {
          let peers;
          page.aposLastTargetId = targetId;
          page.aposLastPosition = position;
          const target = await self.getTarget(req, targetId, position);
          if (!target) {
            throw self.apos.error('notfound');
          }
          let parent;
          if ((position === 'before') || (position === 'after')) {
            parent = await self.findForEditing(req, {
              path: self.getParentPath(target)
            }).children({
              depth: 1,
              archived: null,
              orphan: null,
              areas: false,
              permission: false
            }).toObject();
            peers = parent._children;
          } else {
            parent = target;
            peers = target._children;
          }
          if (!parent) {
            throw self.apos.error('notfound');
          }
          if (options.permissions !== false) {
            if (!parent._edit) {
              throw self.apos.error('forbidden');
            }
          }
          let pushed = [];
          if (position === 'firstChild') {
            page.rank = 0;
            pushed = peers.map(child => child._id);
          } else if (position === 'lastChild') {
            if (!parent.level && (page.type !== '@apostrophecms/archive-page')) {
              const archive = peers.find(peer => peer.type === '@apostrophecms/archive-page');
              if (archive) {
                // Archive has to be last child of the home page, but don't be punitive,
                // just put this page before it
                return self.insert(req, archive._id, 'before', page, options);
              }
            }
            if (!peers.length) {
              page.rank = 0;
            } else {
              page.rank = peers[peers.length - 1].rank + 1;
            }
          } else if (position === 'before') {
            page.rank = target.rank;
            const index = peers.findIndex(peer => peer._id === target._id);
            if (index === -1) {
              throw self.apos.error('notfound');
            }
            pushed = peers.slice(index).map(peer => peer._id);
          } else if (position === 'after') {
            if (target.type === '@apostrophecms/archive-page') {
              return self.insert(req, target._id, 'before', page, options);
            }
            page.rank = target.rank + 1;
            const index = peers.findIndex(peer => peer.id === target._id);
            if (index !== -1) {
              pushed = peers.slice(index + 1).map(peer => peer._id);
            }
          }
          if (pushed.length) {
            // push down after
            await self.apos.doc.db.updateMany({
              _id: {
                $in: pushed
              }
            }, {
              $inc: {
                rank: 1
              }
            });
          }
          // Normally we generate the aposDocId here so we can complete
          // the path before calling doc.insert, but watch out for values
          // already being present
          if (page._id) {
            const components = page._id.split(':');
            if (components.length < 3) {
              throw new Error('If you supply your own _id it must end with :locale:mode, like :en:published');
            }
            page.aposDocId = components[0];
          } else if (!page.aposDocId) {
            page.aposDocId = self.apos.util.generateId();
          }
          page.path = self.apos.util.addSlashIfNeeded(parent.path) + page.aposDocId;
          page.level = parent.level + 1;
          await self.apos.doc.insert(req, page, options);
          return page;
        });
      },
      // Takes a function, `fn`, which performs
      // some operation on the page tree. Invokes that operation
      // while a lock is held on the page tree.
      //
      // The function is awaited.
      //
      // Nested locks for the same `req` are permitted, in order to allow
      // inserts or moves that are triggered by `afterMove`, `beforeInsert`, etc.
      //
      // If fn returns a value, that value is passed on.
      async withLock(req, fn) {
        let locked = false;
        try {
          await self.lock(req);
          locked = true;
          return await fn();
        } finally {
          if (locked) {
            await self.unlock(req);
          }
        }
      },
      // Lock the page tree.
      //
      // The lock must be released by calling the `unlock` method.
      // It is usually best to use the `withLock` method instead, to
      // invoke a function of your own while the lock is in your
      // possession, so you don't have to keep track of it.
      //
      // Nested locks are permitted for the same `req`.
      async lock(req) {
        if (req.aposPageTreeLockDepth) {
          req.aposPageTreeLockDepth++;
          return;
        }
        await self.apos.lock.lock('@apostrophecms/page:tree');
        req.aposPageTreeLockDepth = 1;
      },
      // Release a page tree lock obtained with the `lock` method.
      // Note that it is safest to use the `withLock` method to avoid
      // the bookkeeping of calling either `lock` or `unlock` yourself.
      async unlock(req) {
        if (!req.aposPageTreeLockDepth) {
          throw new Error('Looks like you called apos.page.unlock without ever calling apos.page.lock, or you have more unlock calls than lock calls');
        }
        req.aposPageTreeLockDepth--;
        if (req.aposPageTreeLockDepth) {
          return;
        }
        await self.apos.lock.unlock('@apostrophecms/page:tree');
      },
      // This method creates a new object suitable to be inserted
      // as a child of the specified parent via insert(). It DOES NOT
      // insert it at this time. If the parent page is locked down
      // such that no child page types are permitted, this method
      // returns null. Visibility settings are inherited from the
      // parent page.
      newChild(parentPage) {
        const pageType = self.allowedChildTypes(parentPage)[0];
        if (!pageType) {
          self.apos.util.warn('No allowed Page types are specified.');
          return null;
        }
        const manager = self.apos.doc.getManager(pageType);
        if (!manager) {
          if (self.apos.modules[pageType]) {
            throw self.apos.error('error', `The module ${pageType} does not extend @apostrophecms/page-type.`);
          } else {
            throw self.apos.error('error', `The page type module ${pageType} does not exist in the project.`);
          }
        }
        const page = manager.newInstance();
        _.extend(page, {
          title: 'New Page',
          slug: self.apos.util.addSlashIfNeeded(parentPage.slug) + 'new-page',
          type: pageType,
          visibility: parentPage.visibility
        });
        return page;
      },
      allowedChildTypes(page) {
        if (!page && self.options.allowedHomepageTypes) {
          return self.options.allowedHomepageTypes;
        } else if (page && self.options.allowedSubpageTypes) {
          if (self.options.allowedSubpageTypes[page.type]) {
            return self.options.allowedSubpageTypes[page.type];
          }
        }
        // Default is to allow any type in the configured list
        return _.map(self.typeChoices, 'name');
      },
      // Move a page already in the page tree to another location.
      //
      // Insert a page. `targetId` must be an existing page id, and
      // `position` may be `before`, `inside` or `after`. Alternatively
      // `position` may be a zero-based offset for the new child
      // of `targetId` (note that the `rank` property of sibling pages
      // is not strictly ascending, so use an array index into `_children` to
      // determine this parameter instead).
      //
      // As a shorthand, `targetId` may be `_archive` to refer to the main archive page,
      // or `_home` to refer to the home page.
      //
      // Returns an object with a `modified` property, containing an
      // array of objects with _id and slug properties, indicating the new slugs of all
      // modified pages. If `options` is passed to this method, it is
      // also supplied as the `options` property of the returned object.
      //
      // After the moved and target pages are fetched, the `beforeMove` event is emitted with
      // `req, moved, target, position`.
      async move(req, movedId, targetId, position) {
        // Handle numeric positions
        const normalized = await self.getTargetIdAndPosition(req, null, targetId, position);
        targetId = normalized.targetId;
        position = normalized.position;
        return self.withLock(req, body);
        async function body() {
          let parent;
          let changed = [];
          let rank;
          let originalPath;
          let originalSlug;
          const moved = await getMoved();
          const oldParent = moved._ancestors[0];
          const target = await self.getTarget(req, targetId, position);
          const manager = self.apos.doc.getManager(moved.type);
          await manager.emit('beforeMove', req, moved, target, position);
          determineRankAndNewParent();
          if (!moved._edit) {
            throw self.apos.error('forbidden');
          }
          if (!(parent && oldParent)) {
            // Move outside tree
            throw self.apos.error('forbidden');
          }
          if ((oldParent._id !== parent._id) && (parent.type !== '@apostrophecms/archive-page') && (!parent._edit)) {
            throw self.apos.error('forbidden');
          }
          await nudgeNewPeers();
          await moveSelf();
          await updateDescendants();
          await archiveDescendants();
          await manager.emit('afterMove', req, moved, {
            originalSlug,
            originalPath,
            changed,
            target,
            position
          });
          return {
            changed
          };
          async function getMoved() {
            const moved = await self.findForEditing(req, { _id: movedId }).permission(false).ancestors({
              depth: 1,
              visibility: null,
              archived: null,
              areas: false,
              permission: false
            }).toObject();
            if (!moved) {
              throw self.apos.error('invalid', 'No such page');
            }
            if (!moved.level) {
              throw self.apos.error('invalid', 'Cannot move the home page');
            }
            // You can't move the archivecan itself
            if (moved.type === '@apostrophecms/archive-page') {
              throw self.apos.error('invalid', 'Cannot move the archive can');
            }
            if (moved.parked) {
              throw self.apos.error('invalid', 'Cannot move a parked page');
            }
            return moved;
          }
          function determineRankAndNewParent() {
            if (position === 'firstChild') {
              parent = target;
              rank = 0;
              return;
            } else if (position === 'before') {
              rank = target.rank;
            } else if (position === 'after') {
              if (target.type === '@apostrophecms/archive-page') {
                throw self.apos.error('invalid', 'Only the archive can can be the last child of the home page.');
              }
              rank = target.rank + 1;
            } else if (position === 'lastChild') {
              parent = target;
              if (!parent.level && (moved.type !== '@apostrophecms/archive-page')) {
                const archive = parent._children.find(peer => peer.type === '@apostrophecms/archive-page');
                if (archive) {
                  // Archive has to be last child of the home page, but don't be punitive,
                  // just put this page before it
                  return self.move(req, moved._id, archive._id, 'before');
                }
              }
              if (target._children && target._children.length) {
                rank = target._children[target._children.length - 1].rank + 1;
              } else {
                rank = 0;
              }
              return;
            } else {
              throw new Error('no such position option');
            }
            parent = target._ancestors[0];
          }
          async function nudgeNewPeers() {
            // Nudge down the pages that should now follow us
            await self.apos.doc.db.updateMany({
              path: self.matchDescendants(parent),
              level: parent.level + 1,
              rank: { $gte: rank }
            }, {
              $inc: { rank: 1 }
            });
          }
          async function moveSelf() {
            originalPath = moved.path;
            originalSlug = moved.slug;
            const level = parent.level + 1;
            const newPath = self.apos.util.addSlashIfNeeded(parent.path) + path.basename(moved.path);
            // We're going to use update with $set, but we also want to update
            // the object so that moveDescendants can see what we did
            moved.path = newPath;
            // If the old slug wasn't customized, OR our new parent is
            // in the archive, update the slug as well as the path
            if (parent._id !== oldParent._id) {
              const matchOldParentSlugPrefix = new RegExp('^' + self.apos.util.regExpQuote(self.apos.util.addSlashIfNeeded(oldParent.slug)));
              if (moved.slug.match(matchOldParentSlugPrefix)) {
                let slugStem = parent.slug;
                if (slugStem !== '/') {
                  slugStem += '/';
                }
                moved.slug = moved.slug.replace(matchOldParentSlugPrefix, self.apos.util.addSlashIfNeeded(parent.slug));
                changed.push({
                  _id: moved._id,
                  slug: moved.slug
                });
              } else if (parent.archived && !moved.archived) {
                // #385: we don't follow the pattern of our old parent but we're
                // moving to the archive, so the slug must change to avoid blocking
                // reuse of the old URL by a new page
                moved.slug = parent.slug + '/' + path.basename(moved.slug);
              }
            }
            moved.level = level;
            moved.rank = rank;
            moved.aposLastTargetId = targetId;
            moved.aposLastPosition = position;
            // Are we in the archivecan? Our new parent reveals that
            if (parent.archived) {
              moved.archived = true;
            } else {
              delete moved.archived;
            }
            await self.update(req, moved);
          }
          async function updateDescendants() {
            changed = changed.concat(await self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug));
          }
          async function archiveDescendants() {
            // Make sure our descendants have the same archived status
            const matchParentPathPrefix = self.matchDescendants(moved);
            const $set = {};
            const $unset = {};
            if (moved.archived) {
              $set.archived = true;
            } else {
              $unset.archived = true;
            }
            const action = {};
            if (!_.isEmpty($set)) {
              action.$set = $set;
            }
            if (!_.isEmpty($unset)) {
              action.$unset = $unset;
            }
            if (_.isEmpty(action)) {
              return;
            }
            await self.apos.doc.db.updateMany({ path: matchParentPathPrefix }, action);
          }
        }
      },
      // A method to return a target page object based on a passed `targetId`
      // value. `position` is used to prevent attempts to move after the archive
      // "page."
      async getTarget(req, targetId, position) {
        const criteria = self.getIdCriteria(targetId);
        const target = await self.find(req, criteria).permission(false).archived(null).areas(false).ancestors({
          depth: 1,
          archived: null,
          orphan: null,
          areas: false,
          permission: false
        }).children({
          depth: 1,
          archived: null,
          orphan: null,
          areas: false,
          permission: false
        }).toObject();
        if (!target) {
          throw self.apos.error('notfound');
        }
        if (target.type === '@apostrophecms/archive-page' && target.level === 1 && position === 'after') {
          throw self.apos.error('invalid');
        }
        return target;
      },
      // A method to support numeric positions while moving pages within the
      // page tree. If a numeric position is submitted, this method assumes
      // that the `targetId` is meant to be the moved page's parent. It will
      // return a new `targetId` for a sibling page to use the 'before' position
      // if applicable.
      async getTargetIdAndPosition(req, pageId, targetId, position) {
        targetId = self.apos.launder.id(targetId);
        position = self.apos.launder.string(position);

        if (isNaN(parseInt(position)) || parseInt(position) < 0) {
          // Return an already-valid position or a potentially invalid, but
          // non-numeric position to be evaluated in `self.move`.
          return {
            targetId,
            position
          };
        }

        // The position is a number, so we're converting it to one of the
        // acceptable string values and treating the `target` as the
        // moved page's parent.
        const target = await self.getTarget(req, targetId, position);
        position = parseInt(position);
        // Get the index of the moving page within the target's children.
        const childIndex = target._children.findIndex(child => {
          return child._id === pageId;
        });

        if (position === 0 || target._children.length === 0) {
          position = 'firstChild';
        } else if (childIndex > -1 && position >= (target._children.length - 1)) {
          position = 'lastChild';
        } else if (childIndex === -1 && position >= (target._children.length)) {
          position = 'lastChild';
        } else if (childIndex === position) {
          // If they're trying to put a page in the position it already has,
          // allow them to proceed nonetheless.
          targetId = target._children[position - 1]._id;
          position = 'after';
        } else if (childIndex > -1 && childIndex < position) {
          targetId = target._children[position]._id;
          position = 'after';
        } else {
          targetId = target._children[position]._id;
          position = 'before';
        }
        return {
          targetId,
          position
        };
      },
      // Based on `req`, `moved`, `data.moved`, `data.oldParent` and `data.parent`, decide whether
      // this move should be permitted. If it should not be, throw an error.
      //
      // This method is async because overrides, for instance in @apostrophecms/workflow,
      // may require asynchronous work to perform it.
      async movePermissions(req, moved, data) {
      },
      async deduplicatePages(req, pages, toArchive) {
        for (const page of pages) {
          const match = self.matchDescendants(page);
          await deduplicate(page);
          await propagate(page, match);
        }
        async function deduplicate(page) {
          if (toArchive) {
            return self.apos.doc.getManager(page.type).deduplicateArchive(req, page);
          } else {
            return self.apos.doc.getManager(page.type).deduplicateRescue(req, page);
          }
        }
        async function propagate(page, match) {
          const oldPath = page.path;
          const oldSlug = page.slug;
          // This operation can change paths and slugs of pages, those changes
          // need rippling to their descendants
          const descendants = _.filter(pages, function (descendant) {
            return descendant.path.match(match);
          });

          for (const descendant of descendants) {
            descendant.path = descendant.path.replace(new RegExp('^' + self.apos.util.regExpQuote(oldPath)), page.path);
            descendant.slug = descendant.slug.replace(new RegExp('^' + self.apos.util.regExpQuote(oldSlug)), page.slug);

            try {
              await self.apos.doc.db.updateOne({ _id: descendant._id }, {
                $set: {
                  path: descendant.path,
                  slug: descendant.slug
                }
              });
            } catch (err) {
              if (self.apos.doc.isUniqueError(err)) {
                // The slug is now in conflict for this subpage.
                // Try again with path only
                self.apos.doc.db.updateOne({ _id: descendant._id }, { $set: { path: descendant.path } });
              } else {
                throw err;
              }
            }
          }
        }
      },
      // Returns `{ parentSlug: '/foo', changed: [ ... ] }` where `parentSlug` is the
      // slug of the page's former parent, and `changed` is an array
      // of objects with _id and slug properties, including all subpages that
      // had to move too.
      async moveToArchive(req, _id) {
        const archive = await findArchive();
        if (!archive) {
          throw new Error('Site has no archive, contact administrator');
        }
        const page = await findPage();
        if (!page) {
          throw self.apos.error('notfound');
        }
        const parent = page._ancestors[0];
        if (!parent) {
          throw self.apos.error('invalid', 'Cannot move the home page to the archive');
        }
        const changed = await movePage();
        return {
          parentSlug: parent && parent.slug,
          changed
        };
        async function findArchive() {
          // Always only one archive page at level 1, so we don't have
          // to hardcode the slug
          return self.find(req, {
            archived: true,
            level: 1
          }).permission(false).archived(null).areas(false).toObject();
        }
        async function findPage() {
          // Also checks permissions
          return self.find(req, { _id: _id }).permission('edit').ancestors({
            depth: 1,
            archived: null,
            areas: false
          }).toObject();
        }
        async function movePage() {
          return self.move(req, page._id, archive._id, 'firstChild');
        }
      },
      // Update a page. The `options` argument may be omitted entirely.
      // if it is present and `options.permissions` is set to `false`,
      // permissions are not checked.
      async update(req, page, options) {
        if (page.level === 0) {
          // You cannot move the home page to the archive
          page.archived = false;
        }
        if (!options) {
          options = {};
        }
        const manager = self.apos.doc.getManager(page.type);
        await manager.emit('beforeUpdate', req, page, options);
        await manager.emit('beforeSave', req, page, options);
        await self.apos.doc.update(req, page, options);
        return page;
      },
      // Publish a draft, updating the published locale.
      async publish(req, draft, options = {}) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.publish(req, draft, options);
      },
      // Reverts the given draft to the most recent publication.
      //
      // Returns the draft's new value, or `false` if the draft
      // was not modified from the published version (`modified: false`)
      // or no published version exists yet.
      //
      // This is *not* the on-page `undo/redo` backend. This is the
      // "Revert to Published" feature.
      //
      // Emits the `afterRevertDraftToPublished` event before
      // returning, which receives `req, { draft }` and may
      // replace the `draft` property to alter the returned value.
      async revertDraftToPublished(req, draft) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.revertDraftToPublished(req, draft);
      },
      // Given a draft document, this method reverts both the draft and
      // the corresponding published document to the previously published
      // version, and returns the updated draft and published
      // documents as `{ draft, published}`.
      //
      // If it is not possible to revert because the document is new or
      // has already been reverted to the previously published version,
      // this method returns `false`.
      //
      // Emits the `afterRevertDraftAndPublishedToPrevious` event before
      // returning, which receives `req, { draft, published }` and may
      // replace those properties to alter the returned value.
      async revertPublishedToPrevious(req, published) {
        const manager = self.apos.doc.getManager(published.type);
        return manager.revertPublishedToPrevious(req, published);
      },
      // Ensure the existence of a page or array of pages and
      // lock them in place in the page tree.
      //
      // The `slug` property must be set. The `parent`
      // property may be set to the slug of the intended
      // parent page, which must also be parked. If you
      // do not set `parent`, the page is assumed to be a
      // child of the home page, which is always parked.
      // See also the `park` option; typically invoked via
      // that option when configuring the module.
      park(pageOrPages) {
        const pages = Array.isArray(pageOrPages) ? pageOrPages : [ pageOrPages ];
        self.parked = self.parked.concat(pages);
      },
      // Route that serves pages. See afterInit in
      // index.js for the wildcard argument and the app.get call
      async serve(req, res) {
        req.deferWidgetLoading = true;
        try {
          await self.serveGetPage(req);
          await self.emit('serve', req);
          await self.serveNotFound(req);
        } catch (err) {
          await self.serveDeliver(req, err);
          return;
        }
        await self.serveDeliver(req, null);
      },
      // Sets `req.data.bestPage` to the page whose slug is the longest
      // path prefix of `req.params[0]` (the page slug); an exact match
      // of course wins, followed by the parent "folder," and so on up to the
      // home page.
      async serveGetPage(req) {
        req.slug = req.params[0];
        // Fix common screwups in URLs: leading/trailing whitespace,
        // presence of trailing slashes (but always restore the
        // leading slash). Express leaves escape codes uninterpreted
        // in the path, so look for %20, not ' '.
        req.slug = req.slug.trim();
        req.slug = self.removeTrailingSlugSlashes(req, req.slug);
        if (!req.slug.length || req.slug.charAt(0) !== '/') {
          req.slug = '/' + req.slug;
        }
        // Had to change the URL, so redirect to it. TODO: this
        // contains an assumption that we are mounted at /
        if (req.slug !== req.params[0]) {
          return req.res.redirect(req.slug);
        }
        const builders = self.getServePageBuilders();
        const query = self.find(req);
        query.applyBuilders(builders);
        self.matchPageAndPrefixes(query, req.slug);
        await self.emit('serveQuery', query);
        req.data.bestPage = await query.toObject();
        self.evaluatePageMatch(req);
      },
      // Remove trailing slashes from a slug. This is factored out
      // so that it can be overridden, for instance by the
      // @apostrophecms/workflow module.
      removeTrailingSlugSlashes(req, slug) {
        if (!slug) {
          // For bc, support one argument
          slug = req;
        }
        return slug.replace(/\/+$/, '');
      },
      // If the page will 404 according to the `isFound` method, this
      // method will emit a `notFound` event giving all modules a chance
      // to intercept the request. If none intercept it, the standard 404 behavior
      // is set up.
      async serveNotFound(req) {
        if (self.isFound(req)) {
          return;
        }
        // Give all modules a chance to save the day
        await self.emit('notFound', req);
        // Are we happy now?
        if (self.isFound(req)) {
          return;
        }
        const q = self.apos.util.slugify(req.url, { separator: ' ' });
        req.data.suggestedSearch = q;
        req.notFound = true;
        req.res.statusCode = 404;
        self.setTemplate(req, 'notFound');
      },
      async serveDeliver(req, err) {
        let providePage = true;
        // A2 treats req as a notepad of things we'd
        // like to happen in res; that allows various
        // pageServe methods to override each other.
        // Now we're finally ready to enact those
        // things on res
        if (req.contentType) {
          req.res.setHeader('Content-Type', req.contentType);
        }
        if (req.statusCode) {
          req.res.statusCode = req.statusCode;
        }
        if (req.redirect) {
          let status = 302;
          // Allow the status code to be overridden for redirects too, but
          // if we see an inappropriate status code assume it's because someone
          // set req.redirect to override a 404 without considering this point
          if (req.statusCode && _.includes([
            301,
            302,
            303,
            307,
            308
          ], req.statusCode)) {
            status = req.statusCode;
          }
          return req.res.redirect(status, req.redirect);
        }
        // Handle 500 errors
        if (err) {
          self.apos.util.error(err);
          self.apos.template.setTemplate(req, 'templateError');
          req.statusCode = 500;
          providePage = false;
        }
        if (req.notFound) {
          // pages.serveNotFound already
          // did the heavy lifting here
          providePage = false;
        }
        // Special cases for "you must log in to access that"
        // and "you are logged in, but not cool enough to
        // see that"
        if (req.loginRequired) {
          self.setTemplate(req, 'loginRequired');
          providePage = false;
        } else if (req.insufficient) {
          self.setTemplate(req, 'insufficient');
          providePage = false;
        }
        if (!req.template) {
          self.apos.util.error('req.template was never set');
          self.apos.template.setTemplate(req, 'templateError');
          req.statusCode = 500;
          providePage = false;
        }
        const args = {
          edit: providePage ? req.data.bestPage._edit : null,
          slug: providePage ? req.data.bestPage.slug : null,
          page: providePage ? req.data.bestPage : null
        };

        // Merge data that other modules has asked us to
        // make available to the template
        _.extend(args, req.data);
        // A simple way to access everything we know about
        // the page in JSON format. Allow this only if we
        // have editing privileges on the page
        if (req.query.pageInformation === 'json' && args.page && args.page._edit) {
          return req.res.send(args.page);
        }
        return self.sendPage(req, req.template, args);
      },
      // A request is "found" if it should not be
      // treated as a "404 not found" situation
      isFound(req) {
        return req.loginRequired || req.insufficient || req.redirect || (req.data.page && !req.notFound);
      },
      // Returns the query builders to be invoked when fetching a
      // page, by default. These add information about ancestor and child
      // pages of the page in question
      getServePageBuilders() {
        return self.options.builders || {
          // Get the kids of the ancestors too so we can do tabs and accordion nav
          ancestors: { children: true },
          // Get our own kids
          children: true
        };
      },
      // The given query object is modified to return only pages that match
      // the given slug or a path prefix of it, and to sort results
      // in favor of a more complete match
      matchPageAndPrefixes(query, slug) {
        const slugs = [];
        let components;
        // Partial matches. Avoid an unnecessary OR of '/' and '/' for the
        // homepage by checking that slug.length > 1
        if (slug.length && slug.substr(0, 1) === '/' && slug.length > 1) {
          let path = '';
          // homepage is always interesting
          slugs.unshift('/');
          components = slug.substr(1).split('/');
          for (let i = 0; i < components.length - 1; i++) {
            const component = components[i];
            path = self.apos.util.addSlashIfNeeded(path) + component;
            slugs.unshift(path);
          }
        }
        // And of course always consider an exact match. We use unshift to
        // put the exact match first in the query, but we still need to use
        // sort() and limit() to guarantee that the best result wins
        slugs.unshift(slug);
        query.sort({ slug: -1 });
        query.and({ slug: { $in: slugs } });
      },
      // Given a `req` object in which `req.data.bestPage` has already
      // been set, also set `req.data.page` if the slug is an exact match.
      // Otherwise set `req.remainder` to the nonmatching portion
      // of `req.params[0]` and leave `req.data.bestPage` as-is.
      // `req.remainder` is then utilized by modules like `@apostrophecms/page-type`
      // to implement features like dispatch, which powers the
      // "permalink" or "show" pages of `@apostrophecms/piece-page-type`
      evaluatePageMatch(req) {
        const slug = req.params[0];
        if (!req.data.bestPage) {
          return;
        }
        if (req.data.bestPage.slug === slug) {
          req.data.page = req.data.bestPage;
        }
        let remainder = slug.substr(req.data.bestPage.slug.length);
        // Strip trailing slashes for consistent results
        remainder = remainder.replace(/\/+$/, '');
        // For consistency, guarantee a leading / if there is not one
        // already. This way parsing remainders attached to the home
        // page (the slug of which is '/') is not a special case
        if (remainder.charAt(0) !== '/') {
          remainder = '/' + remainder;
        }
        req.remainder = remainder;
      },
      async createIndexes() {
        await self.ensurePathIndex();
        await self.ensureLevelRankIndex();
      },
      async ensurePathIndex() {
        await self.apos.doc.db.createIndex({
          path: 1,
          aposLocale: 1
        });
      },
      async ensureLevelRankIndex() {
        const params = self.getLevelRankIndexParams();
        await self.apos.doc.db.createIndex(params, {});
      },
      getLevelRankIndexParams() {
        return {
          level: 1,
          rank: 1
        };
      },
      // A limited subset of page properties are pushed to
      // browser-side JavaScript when editing privileges exist.
      pruneCurrentPageForBrowser(page) {
        page = _.pick(page, 'title', 'slug', '_id', 'type', 'ancestors', '_url', 'aposDocId', 'aposLocale');
        // Limit information about ancestors to avoid
        // excessive amounts of data in the page
        page.ancestors = _.map(page.ancestors, function (ancestor) {
          return _.pick(ancestor, [
            'title',
            'slug',
            '_id',
            'type',
            '_url',
            'aposDocId',
            'aposLocale'
          ]);
        });
        return page;
      },
      // Invoked via callForAll in the docs module
      docFixUniqueError(req, doc) {
        if (doc.path) {
          const num = Math.floor(Math.random() * 10).toString();
          doc.path += num;
        }
      },
      // Update the paths and slugs of descendant pages,
      // changing slugs only if they were
      // compatible with the original slug. Also updates
      // the level of descendants.
      //
      // On success, returns an array of objects with _id and slug properties,
      // indicating the new slugs for any pages that were modified.
      async updateDescendantsAfterMove(req, page, originalPath, originalSlug) {
        // If our slug changed, then our descendants' slugs should
        // also change, if they are still similar. You can't do a
        // global substring replace in MongoDB the way you can
        // in MySQL, so we need to fetch them and update them
        // individually. async.mapSeries is a good choice because
        // there may be zillions of descendants and we don't want
        // to choke the server. We could use async.mapLimit, but
        // let's not get fancy just yet
        const changed = [];
        if (originalSlug === page.slug && originalPath === page.path) {
          return changed;
        }
        const oldLevel = originalPath.split('/').length - 1;
        const matchParentPathPrefix = new RegExp('^' + self.apos.util.regExpQuote(originalPath + '/'));
        const matchParentSlugPrefix = new RegExp('^' + self.apos.util.regExpQuote(originalSlug + '/'));
        let done = false;
        const query = self.apos.doc.db.find({ path: matchParentPathPrefix }).project({
          slug: 1,
          path: 1,
          level: 1
        });
        while (!done) {
          const desc = await query.next();
          if (!desc) {
            // This means there are no more objects
            done = true;
            break;
          }
          let newSlug = desc.slug.replace(matchParentSlugPrefix, page.slug + '/');
          if (page.archived && !desc.archived) {
            // #385: we are moving this to the archive, force a new slug
            // even if it was formerly a customized one. Otherwise it is
            // difficult to free up custom slugs by archiving pages
            if (newSlug === desc.slug) {
              newSlug = page.slug + '/' + path.basename(desc.slug);
            }
          }
          changed.push({
            _id: desc._id,
            slug: newSlug
          });
          // Allow for the possibility that the slug becomes
          // a duplicate of something already nested under
          // the new parent at this point
          desc.path = desc.path.replace(matchParentPathPrefix, page.path + '/');
          desc.slug = newSlug;
          desc.level = desc.level + (page.level - oldLevel);
          await self.apos.doc.retryUntilUnique(req, desc, () => updateDescendant(desc));
        }
        return changed;
        async function updateDescendant(desc) {
          await self.apos.doc.db.updateOne({ _id: desc._id }, { $set: _.pick(desc, 'path', 'slug', 'level') });
        }
      },
      // Parks one page as found in the `park` option. Called by
      // `implementParkAll`.
      async implementParkOne(req, item) {
        if (!item.parkedId) {
          throw new Error('Parked pages must have a unique parkedId property');
        }
        if (!((item.type || (item._defaults && item._defaults.type)) && (item.slug || item._defaults.slug))) {
          throw new Error('Parked pages must have type and slug properties, they may be fixed or part of _defaults:\n' + JSON.stringify(item, null, '  '));
        }
        const parent = await findParent();
        item.parked = _.keys(_.omit(item, '_defaults'));
        if (!parent) {
          item.rank = 0;
          item.level = 0;
        }
        const existing = await findExisting();
        if (existing) {
          await updateExisting();
        } else {
          await insert();
        }
        await children();
        async function findParent() {
          let parentSlug;
          if (item.level === 0 || item.slug === '/') {
            return;
          }
          if (!item.parent) {
            parentSlug = '/';
          } else {
            parentSlug = item.parent;
          }
          return self.findOneForEditing(req, { slug: parentSlug });
        }
        async function findExisting() {
          return self.findOneForEditing(req, { parkedId: item.parkedId });
        }
        async function updateExisting() {
          // Enforce all permanent properties on existing
          // pages too
          await self.apos.doc.db.updateOne({ _id: existing._id }, { $set: self.apos.util.clonePermanent(item) });
        }
        async function insert() {
          const parkedDefaults = item._defaults || {};
          delete item._defaults;
          let ordinaryDefaults;
          if (parent) {
            ordinaryDefaults = self.newChild(parent);
          } else {
            // The home page is being parked
            const type = item.type || parkedDefaults.type;
            if (!type) {
              throw new Error('Parked home page must have an explicit page type:\n\n' + JSON.stringify(item, null, '  '));
            }
            ordinaryDefaults = self.apos.doc.getManager(type).newInstance();
          }
          const _item = {
            ...ordinaryDefaults,
            ...parkedDefaults,
            ...item
          };
          delete _item._children;
          if (!parent) {
            // Parking the home page for the first time
            _item.aposDocId = self.apos.util.generateId();
            _item.path = _item.aposDocId;
            return self.apos.doc.insert(req, _item);
          } else {
            return self.insert(req, parent._id, 'lastChild', _item);
          }
        }
        async function children() {
          if (!item._children) {
            return;
          }
          for (const child of item._children) {
            child.parent = item.slug;
            await self.implementParkOne(req, child);
          }
        }
      },
      async unparkTask(argv) {
        if (argv._.length !== 2) {
          throw new Error('Wrong number of arguments');
        }
        const slug = argv._[1];
        const count = await self.apos.doc.db.updateOne({ slug: slug }, { $unset: { parked: 1 } });
        if (!count) {
          throw 'No page with that slug was found.';
        }
      },
      // Routes use this to convert _id to id for the
      // convenience of jqtree
      mapMongoIdToJqtreeId(changed) {
        return _.map(changed, function (change) {
          change.id = change._id;
          delete change._id;
          return change;
        });
      },
      // Invoked by the @apostrophecms/version module.
      //
      // Your module can add additional doc properties that should never be rolled back by pushing
      // them onto the `fields` array.
      docUnversionedFields(req, doc, fields) {
        // Moves in the tree have knock-on effects on other
        // pages, they are not suitable for rollback
        fields.push('path', 'archived', 'rank', 'level');
      },
      // Returns true if the doc is a page in the tree
      // (it has a slug with a leading /).
      isPage(doc) {
        // Proper docs always have a slug, but some of our unit tests are lazy about this.
        return doc.slug && doc.slug.match(/^\//);
      },
      // Returns a regular expression to match the `path` property of the descendants of the given page,
      // but not itself. You can also pass the path rather than the entire page object.
      matchDescendants(pageOrPath) {
        const path = pageOrPath.path || pageOrPath;
        // Make sure there is a trailing slash, but don't add two (the home page already has one).
        // Also make sure there is at least one additional character, which there always will be,
        // in order to prevent the home page from matching as its own descendant
        return new RegExp(`^${self.apos.util.regExpQuote(path)}/.`);
      },
      // Returns the path property of the page's parent. For use in queries to fetch the parent.
      getParentPath(page) {
        return page.path.replace(/\/[^/]+$/, '');
      },
      // Returns true if `possibleAncestorPage` is an ancestor of `ofPage`.
      // A page is not its own ancestor. If either object is missing or
      // has no path property, false is returned.
      isAncestorOf(possibleAncestorPage, ofPage) {
        if (!possibleAncestorPage) {
          return false;
        }
        if (!ofPage) {
          return false;
        }
        if (!possibleAncestorPage.path) {
          return false;
        }
        if (!ofPage.path) {
          return false;
        }
        let path = ofPage.path;
        if (path === possibleAncestorPage.path) {
          return false;
        }
        do {
          path = path.replace(/\/[^/]+$/, '');
          if (path === possibleAncestorPage.path) {
            return true;
          }
        } while (path.indexOf('/') !== -1);
        return false;
      },
      // While it's a good thing that all docs now can have nuanced permissions,
      // only pages care about "apply to subpages" as a concept when editing
      // permissions. This method adds those nuances to the permissions-related
      // schema fields. Called by the update routes (for new pages, there are
      // no subpages to apply things to yet). Returns a new schema
      addApplyToSubpagesToSchema(schema) {
        // Do only as much cloning as we have to to avoid modifying the original
        schema = _.clone(schema);
        const index = _.findIndex(schema, { name: 'visibility' });
        if (index !== -1) {
          schema.splice(index + 1, 0, {
            type: 'boolean',
            name: 'applyVisibilityToSubpages',
            label: 'Apply to Subpages',
            group: schema[index].group
          });
        }
        return schema;
      },
      // Get the page type names for all the parked pages, including parked children, recursively.
      getParkedTypes() {
        return self.parked.map(getType).concat(getChildTypes(self.parked));
        function getType(park) {
          let type = park.type || (park._defaults && park._defaults.type);
          if (!type) {
            type = 'PARKEDPAGEWITHNOTYPE';
          }
          return type;
        }
        function getChildTypes(parked) {
          let types = [];
          _.each(parked, function (page) {
            if (page._children) {
              types = types.concat(_.map(page._children, getType)).concat(getChildTypes(page._children));
            }
          });
          return _.uniq(types);
        }
      },
      removeParkedPropertiesFromSchema(page, schema) {
        return _.filter(schema, function (field) {
          return !_.includes(page.parked, field.name);
        });
      },
      // any `slug` field named `slug`. If not, return the schema unmodified.
      removeSlugFromHomepageSchema(page, schema) {
        if (page.level === 0) {
          schema = _.reject(schema, {
            type: 'slug',
            name: 'slug'
          });
        }
        return schema;
      },
      addManagerModal() {
        self.apos.modal.add(
          `${self.__meta.name}:manager`,
          self.getComponentName('managerModal', 'AposPagesManager'),
          { moduleName: self.__meta.name }
        );
      },
      addEditorModal() {
        self.apos.modal.add(
          `${self.__meta.name}:editor`,
          self.getComponentName('insertModal', 'AposDocEditor'),
          { moduleName: self.__meta.name }
        );
      },
      // Returns the effective base URL for the given request.
      // If Apostrophe's top-level `baseUrl` option is set, it is returned,
      // otherwise the empty string. This makes it easier to build absolute
      // URLs (when `baseUrl` is configured), or to harmlessly prepend
      // the empty string (when it is not configured). The
      // Apostrophe queries used to fetch Apostrophe pages
      // consult this method, and it is extended by the optional
      // `@apostrophecms/workflow` module to create correct absolute URLs
      // for specific locales.
      getBaseUrl(req) {
        return self.apos.baseUrl || '';
      },
      // Implements a simple batch operation like publish or unpublish.
      // Pass `req`, the `name` of a configured batch operation,
      // and an async function that accepts (req, page, data) and
      // performs the modification on that one page (including calling
      // `update` if appropriate). Your function will be awaited.
      //
      // `data` is an object containing any schema fields specified
      // for the batch operation. If there is no schema it will be
      // an empty object.
      //
      // The ids of the pages to be operated on should be in `req.body.ids`.
      // For convenience, you may also pass just one id via `req.body._id`.
      //
      // If `req.body.job` is truthy, this method immediately returns
      // `{ jobId: 'cxxxx' }`. The `jobId` can then
      // be passed as a prop to an `ApostropheJobsMonitor` component
      // which will pop up as a modal until complete and emit a
      // `finished` event when complete (TODO: implement this component
      // in 3.0).
      //
      // If `req.body.job` is not set, this async function does not return
      // until the entire operation is complete. Note that for large
      // operations that will be too late for the webserver, so when
      // using `ids` you should always implement `ApostropheJobsMonitor`
      // instead.
      //
      // To avoid RAM issues with very large selections, the current
      // implementation processes the pages in series.
      async batchSimpleRoute(req, name, change) {
        const batchOperation = _.find(self.options.batchOperations, { name: name });
        const schema = batchOperation.schema || [];
        const data = self.apos.schema.newInstance(schema);
        await self.apos.schema.convert(req, schema, 'form', req.body, data);
        let ids = self.apos.launder.ids(req.body.ids);
        if (!ids) {
          if (req.body._id) {
            ids = self.apos.launder.id(req.body._id);
          }
        }
        if (req.body.job) {
          return runJob();
        } else {
          for (const id of ids) {
            await one(req, id);
          }
        }
        async function runJob() {
          return self.apos.modules['@apostrophecms/job'].run(req, ids, one, { labels: { title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label } });
        }
        async function one(req, id) {
          const page = await self.findForBatch(req, { _id: id }).toObject();
          if (!page) {
            throw new Error('notfound');
          }
          await change(req, page, data);
        }
      },
      // Given a page and its parent (if any), returns a schema that
      // is filtered appropriately to that page's type, taking into
      // account whether the page is new and the parent's allowed
      // subpage types
      allowedSchema(req, page, parentPage) {
        let schema = self.apos.doc.getManager(page.type).allowedSchema(req);
        const typeField = _.find(schema, { name: 'type' });
        if (typeField) {
          const allowed = self.allowedChildTypes(parentPage);
          // For a preexisting page, we can't forbid the type it currently has
          if (page._id && !_.includes(allowed, page.type)) {
            allowed.unshift(page.type);
          }
          typeField.choices = _.map(allowed, function (name) {
            return {
              value: name,
              label: getLabel(name)
            };
          });
        }
        if (page._id) {
          // Preexisting page
          schema = self.addApplyToSubpagesToSchema(schema);
          schema = self.removeParkedPropertiesFromSchema(page, schema);
        }
        return schema;
        function getLabel(name) {
          const choice = _.find(self.typeChoices, { name: name });
          let label = choice && choice.label;
          if (!label) {
            const manager = self.apos.doc.getManager(name);
            if (!manager) {
              throw new Error('There is no page type ' + name + ' but it is configured in allowedHomepageTypes or allowedSubpageTypes or is the type of an existing page, I give up');
            }
            label = manager.label;
          }
          if (!label) {
            label = name;
          }
          return label;
        }
      },
      getRestQuery(req) {
        const query = self.find(req).ancestors(true).children(true).applyBuildersSafely(req.query);
        if (!self.apos.permission.can(req, 'edit', self.__meta.name)) {
          if (!self.options.publicApiProjection) {
            // Shouldn't be needed thanks to publicApiCheck, but be sure
            query.and({
              _id: '__iNeverMatch'
            });
          } else {
            query.project(self.options.publicApiProjection);
          }
        }
        return query;
      },
      // Returns a query that finds pages the current user can edit. Unlike
      // find(), this query defaults to including docs in the archive, although
      // we apply filters in the UI.
      findForEditing(req, criteria, builders) {
        // Include ancestors to help with determining allowed types
        const query = self.find(req, criteria).permission('edit').archived(null).ancestors(true);
        if (builders) {
          for (const [ key, value ] of Object.entries(builders)) {
            query[key](value);
          }
        }
        return query;
      },
      async findOneForEditing(req, criteria, builders) {
        return self.findForEditing(req, criteria, builders).toObject();
      },
      // Throws a `notfound` exception if a public API projection is
      // not specified and the user does not have editing permissions. Otherwise does
      // nothing. Simplifies implementation of `getAll` and `getOne`.
      publicApiCheck(req) {
        if (!self.options.publicApiProjection) {
          if (!self.apos.permission.can(req, 'edit', self.__meta.name)) {
            throw self.apos.error('notfound');
          }
        }
      },
      getAllProjection() {
        return {
          _url: 1,
          title: 1,
          type: 1,
          path: 1,
          rank: 1,
          level: 1,
          visibility: 1,
          archived: 1,
          parked: 1,
          lastPublishedAt: 1,
          aposDocId: 1,
          aposLocale: 1
        };
      },
      addArchivedMigration() {
        self.apos.migration.add('rename-trash-to-archived', async () => {
          await self.apos.doc.db.updateMany({
            trash: {
              $ne: true
            },
            archived: {
              $exists: 0
            }
          }, {
            $set: {
              archived: false
            },
            $unset: {
              trash: 1
            }
          });
          await self.apos.doc.db.updateMany({
            trash: true,
            archived: {
              $exists: 0
            }
          }, {
            $set: {
              archived: true
            },
            $unset: {
              trash: 1
            }
          });
          await self.apos.doc.db.updateMany({
            parkedId: 'trash'
          }, {
            $set: {
              parkedId: 'archive',
              type: '@apostrophecms/archive-page',
              title: 'Archive'
            }
          });
          await self.apos.migration.eachDoc({
            slug: /^\/trash(\/|$)/,
            archived: true
          }, async doc => {
            return self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                slug: doc.slug.replace('/trash', '/archive')
              }
            });
          });
        });
      },
      addDeduplicateRanksMigration() {
        self.apos.migration.add('deduplicate-archive-rank', async () => {
          const tabs = await self.apos.doc.db.find({
            slug: /^\//,
            level: 1
          }).sort({
            archived: 1,
            rank: 1
          }).toArray();
          for (let i = 0; (i < tabs.length); i++) {
            await self.apos.doc.db.updateOne({
              _id: tabs[i]._id
            }, {
              $set: {
                rank: i
              }
            });
          }
        });
      },
      addFixHomePagePathMigration() {
        self.apos.migration.add('fix-home-page-path', async () => {
          const home = await self.apos.doc.db.findOne({
            slug: '/',
            path: '/',
            level: 0
          });
          if (!home) {
            return;
          }
          return self.apos.doc.db.updateOne({
            _id: home._id
          }, {
            $set: {
              path: home._id.replace(/:.*$/)
            }
          });
        });
      },
      addMissingLastTargetIdAndPositionMigration() {
        self.apos.migration.add('missing-last-target-id-and-position', async () => {
          await self.apos.migration.eachDoc({
            slug: /^\//,
            // Home page should not have them, that's OK
            level: {
              $gte: 0
            },
            aposLastTargetId: {
              $exists: 0
            }
          }, 5, async (doc) => {
            const parentPath = self.getParentPath(doc);
            const parentAposDocId = parentPath.split('/').pop();
            let parentId;
            if (doc.aposLocale) {
              parentId = `${parentAposDocId}:${doc.aposLocale}`;
            } else {
              parentId = parentAposDocId;
            }
            const peerCriteria = {
              path: self.matchDescendants(parentPath),
              level: doc.level
            };
            if (doc.aposLocale) {
              peerCriteria.aposLocale = doc.aposLocale;
            }
            const peers = await self.apos.doc.db.find(peerCriteria).sort({
              rank: 1
            }).project({
              _id: 1
            }).toArray();
            let targetId;
            let position;
            const index = peers.findIndex(peer => peer._id === doc._id);
            if (index === -1) {
              return;
            }
            if (index === 0) {
              targetId = parentId;
              position = 'firstChild';
            } else {
              targetId = peers[index - 1]._id;
              position = 'after';
            }
            return self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: {
                aposLastTargetId: targetId,
                aposLastPosition: position
              }
            });
          });
        });
      },
      // Infer `req.locale` and `req.mode` from `_id` if they were
      // not set already by explicit query parameters. Conversely,
      // if the appropriate query parameters were set, rewrite
      // `_id` accordingly. Returns `_id`, after rewriting if appropriate.
      inferIdLocaleAndMode(req, _id) {
        // For pages we currently always do this. For pieces it's conditional
        // on whether the type is localized.
        return self.apos.i18n.inferIdLocaleAndMode(req, _id);
      },
      // Copy any parked properties of `page` back into `input` to
      // prevent any attempt to alter them via the PUT or PATCH APIs
      enforceParkedProperties(req, page, input) {
        for (const field of (page.parked || [])) {
          input[field] = page[field];
        }
      }
    };
  },
  helpers(self) {
    return {
      isAncestorOf: function (possibleAncestorPage, ofPage) {
        return self.isAncestorOf(possibleAncestorPage, ofPage);
      }
    };
  },
  tasks(self) {
    return {
      unpark: {
        usage: 'Usage: node app @apostrophecms/page:unpark /page/slug\n\nThis unparks a page that was formerly locked in a specific\nposition in the page tree.',
        task: self.unparkTask
      }
    };
  }
};
