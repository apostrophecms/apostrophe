const _ = require('lodash');
const path = require('path');
const { klona } = require('klona');
const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = {
  cascades: [ 'filters', 'batchOperations', 'utilityOperations' ],
  options: {
    alias: 'page',
    types: [
      {
        // So that the minimum parked pages don't result in an error when home
        // has no manager. -Tom
        name: '@apostrophecms/home-page',
        label: 'apostrophe:home'
      }
    ],
    quickCreate: true,
    minimumPark: [
      {
        slug: '/',
        parkedId: 'home',
        _defaults: {
          title: 'Home',
          type: '@apostrophecms/home-page'
        }
      },
      {
        slug: '/archive',
        parkedId: 'archive',
        type: '@apostrophecms/archive-page',
        archived: true,
        orphan: true,
        title: 'Archive'
      }
    ],
    redirectFailedUpperCaseUrls: true,
    relationshipSuggestionIcon: 'web-icon'
  },
  filters: {
    add: {
      archived: {
        label: 'apostrophe:archived',
        inputType: 'radio',
        choices: [
          {
            value: false,
            label: 'apostrophe:live'
          },
          {
            value: true,
            label: 'apostrophe:archived'
          }
        ],
        // TODO: Delete `allowedInChooser` if not used.
        allowedInChooser: false,
        def: false,
        required: true
      }
    }
  },
  utilityOperations(self) {
    return {
      add: {
        new: {
          canCreate: true,
          relationship: true,
          label: {
            key: 'apostrophe:newDocType',
            type: '$t(apostrophe:page)'
          },
          eventOptions: {
            event: 'edit',
            type: self.__meta.name
          }
        }
      }
    };
  },
  batchOperations: {
    add: {
      publish: {
        label: 'apostrophe:publish',
        messages: {
          progress: 'apostrophe:batchPublishProgress',
          completed: 'apostrophe:batchPublishCompleted'
        },
        icon: 'earth-icon',
        modalOptions: {
          title: 'apostrophe:publishType',
          description: 'apostrophe:publishingBatchConfirmation',
          confirmationButton: 'apostrophe:publishingBatchConfirmationButton'
        },
        permission: 'publish'
      },
      archive: {
        label: 'apostrophe:archive',
        messages: {
          progress: 'apostrophe:batchArchiveProgress',
          completed: 'apostrophe:batchArchiveCompleted'
        },
        icon: 'archive-arrow-down-icon',
        if: {
          archived: false
        },
        modalOptions: {
          title: 'apostrophe:archiveType',
          description: 'apostrophe:archivingBatchConfirmation',
          confirmationButton: 'apostrophe:archivingBatchConfirmationButton'
        },
        permission: 'delete'
      },
      restore: {
        label: 'apostrophe:restore',
        messages: {
          progress: 'apostrophe:batchRestoreProgress',
          completed: 'apostrophe:batchRestoreCompleted'
        },
        icon: 'archive-arrow-up-icon',
        if: {
          archived: true
        },
        modalOptions: {
          title: 'apostrophe:restoreType',
          description: 'apostrophe:restoreBatchConfirmation',
          confirmationButton: 'apostrophe:restoreBatchConfirmationButton'
        },
        permission: 'edit'
      },
      localize: {
        label: 'apostrophe:localize',
        messages: {
          icon: 'translate-icon',
          progress: 'apostrophe:localizingBatch',
          completed: 'apostrophe:localizedBatch',
          resultsEventName: 'apos-localize-batch-results'
        },
        if: {
          archived: false
        },
        modal: 'AposI18nLocalize',
        permission: 'edit'
      }
    },
    group: {
      more: {
        icon: 'dots-vertical-icon',
        operations: [ 'localize' ]
      }
    }
  },
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:manager`]: {
          type: 'item',
          label: 'apostrophe:page',
          action: {
            type: 'admin-menu-click',
            payload: {
              itemName: `${self.__meta.name}:manager`
            }
          },
          permission: {
            action: 'edit',
            type: self.__meta.name
          },
          shortcut: self.options.shortcut ?? `G,${self.apos.task.getReq().t('apostrophe:page').slice(0, 1)}`
        },
        [`${self.__meta.name}:create-new`]: {
          type: 'item',
          label: 'apostrophe:commandMenuCreateNew',
          action: {
            type: 'command-menu-manager-create-new'
          },
          permission: {
            action: 'create',
            type: self.__meta.name
          },
          shortcut: 'C'
        },
        [`${self.__meta.name}:search`]: {
          type: 'item',
          label: 'apostrophe:commandMenuSearch',
          action: {
            type: 'command-menu-manager-focus-search'
          },
          shortcut: 'Ctrl+F Meta+F'
        },
        [`${self.__meta.name}:select-all`]: {
          type: 'item',
          label: 'apostrophe:commandMenuSelectAll',
          action: {
            type: 'command-menu-manager-select-all'
          },
          shortcut: 'Ctrl+Shift+A Meta+Shift+A'
        },
        [`${self.__meta.name}:archive-selected`]: {
          type: 'item',
          label: 'apostrophe:commandMenuArchiveSelected',
          action: {
            type: 'command-menu-manager-archive-selected'
          },
          permission: {
            action: 'delete',
            type: self.__meta.name
          },
          shortcut: 'E'
        },
        [`${self.__meta.name}:exit-manager`]: {
          type: 'item',
          label: 'apostrophe:commandMenuExitManager',
          action: {
            type: 'command-menu-manager-close'
          },
          shortcut: 'Q'
        }
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:manager': {
            label: 'apostrophe:commandMenuManager',
            commands: [
              `${self.__meta.name}:manager`
            ]
          }
        },
        [`${self.__meta.name}:manager`]: {
          '@apostrophecms/command-menu:manager': {
            label: 'apostrophe:commandMenuManager',
            commands: [
              `${self.__meta.name}:create-new`,
              `${self.__meta.name}:search`,
              `${self.__meta.name}:select-all`,
              `${self.__meta.name}:archive-selected`,
              `${self.__meta.name}:exit-manager`
            ]
          }
        }
      }
    };
  },
  async init(self) {
    self.typeChoices = self.options.types || [];
    // If "park" redeclares something with a parkedId present in "minimumPark",
    // the later one should win
    self.composeParked();
    self.addManagerModal();
    self.addEditorModal();
    self.enableBrowserData();
    self.addLegacyMigrations();
    self.addMisreplicatedParkedPagesMigration();
    self.addDuplicateParkedPagesMigration();
    self.apos.migration.add('deduplicateRanks2', self.deduplicateRanks2Migration);
    self.apos.migration.add('missingLastPublishedAt', self.missingLastPublishedAtMigration);
    await self.createIndexes();
    self.composeFilters();
  },
  restApiRoutes(self) {

    return {
      // Trees are arranged in a tree, not a list. So this API returns the home
      // page, with _children populated if ?_children=1 is in the query string.
      // An editor can also get a light version of the entire tree with ?all=1,
      // for use in a drag-and-drop UI.
      //
      // If ?flat=1 is present, the pages are returned as a flat list rather
      // than a tree, and the `_children` property of each is just an array of
      // `_id`s.
      //
      // If ?autocomplete=x is present, then an autocomplete prefix search for
      // pages matching that string is carried out, and a flat list of pages is
      // returned, with no `_children`. This is mainly useful to our
      // relationship editor. The user must have some page editing privileges to
      // use it. The 10 best matches are returned as an object with a `results`
      // property containing the array of pages. If ?type=x is present, only
      // pages of that type are returned. This query parameter is only used in
      // conjunction with ?autocomplete=x. It will be ignored otherwise.
      //
      // If querying for draft pages, you may add ?published=1 to attach a
      // `_publishedDoc` property to each draft that also exists in a published
      // form.

      getAll: [
        ...self.apos.expressCacheOnDemand ? [ self.apos.expressCacheOnDemand ] : [],
        async (req) => {
          await self.publicApiCheckAsync(req);
          const all = self.apos.launder.boolean(req.query.all);
          const archived = self.apos.launder.booleanOrNull(req.query.archived);
          const flat = self.apos.launder.boolean(req.query.flat);
          const autocomplete = self.apos.launder.string(req.query.autocomplete);
          const type = self.apos.launder.string(req.query.type);

          if (autocomplete.length) {
            if (!self.apos.permission.can(req, 'view', '@apostrophecms/any-page-type')) {
              throw self.apos.error('forbidden');
            }

            if (type.length && !self.apos.permission.can(req, 'view', type)) {
              throw self.apos.error('forbidden');
            }

            const query = self.getRestQuery(req)
              .permission(false)
              .limit(10)
              .relationships(false)
              .areas(false);
            if (type.length) {
              query.type(type);
            }

            return {
              // For consistency with the pieces REST API we
              // use a results property when returning a flat list
              results: await query.toArray()
            };
          }

          if (type.length) {
            const manager = self.apos.doc.getManager(type);
            if (!manager) {
              throw self.apos.error('invalid');
            }

            const query = self.getRestQuery(req);
            query
              .type(type)
              .ancestors(false)
              .children(false)
              .attachments(false)
              .perPage(manager.options.perPage);

            // populates totalPages when perPage is present
            await query.toCount();

            const docs = await query.toArray();

            return {
              results: docs.map(doc => manager.removeForbiddenFields(req, doc)),
              pages: query.get('totalPages'),
              currentPage: query.get('page') || 1,
              ...(query.get('choicesResults') && {
                choices: query.get('choicesResults')
              })
            };
          }

          if (all) {
            if (!self.apos.permission.can(req, 'view', '@apostrophecms/any-page-type')) {
              throw self.apos.error('forbidden');
            }
            const page = await self.getRestQuery(req)
              .permission(false)
              .and({ level: 0 })
              .children({
                depth: 1000,
                archived,
                orphan: null,
                relationships: false,
                areas: false,
                permission: false,
                withPublished: self.apos.launder.boolean(req.query.withPublished),
                project: self.getAllProjection()
              }).toObject();

            if (
              self.options.cache &&
              self.options.cache.api &&
              self.options.cache.api.maxAge
            ) {
              self.setMaxAge(req, self.options.cache.api.maxAge);
            }

            if (!page) {
              throw self.apos.error('notfound');
            }

            if (flat) {
              const result = [];
              flatten(result, page);

              return {
                // For consistency with the pieces REST API we
                // use a results property when returning a flat list
                results: result
              };
            } else {
              return page;
            }
          } else {
            const result = await self.getRestQuery(req).and({ level: 0 }).toObject();

            if (
              self.options.cache &&
              self.options.cache.api &&
              self.options.cache.api.maxAge
            ) {
              self.setMaxAge(req, self.options.cache.api.maxAge);
            }

            if (!result) {
              throw self.apos.error('notfound');
            }

            // Attach `_url` and `_urls` properties to the home page
            self.apos.attachment.all(result, { annotate: true });
            return result;
          }

          function flatten(result, node) {
            const children = node._children;
            node._children = _.map(node._children, '_id');
            result.push(node);
            _.each(children || [], function(child) {
              flatten(result, child);
            });

          }
        }
      ],
      // _id may be a page _id, or the convenient shorthands
      // `_home` or `_archive`

      getOne: [
        ...self.apos.expressCacheOnDemand ? [ self.apos.expressCacheOnDemand ] : [],
        async (req, _id) => {
          _id = self.inferIdLocaleAndMode(req, _id);
          // Edit access to draft is sufficient to fetch either
          await self.publicApiCheckAsync(req);
          const criteria = self.getIdCriteria(_id);
          const result = await self
            .getRestQuery(req)
            .permission(false)
            .and(criteria)
            .toObject();

          if (self.options.cache?.api?.maxAge) {
            const { maxAge } = self.options.cache.api;

            if (!self.options.cache.api.etags) {
              self.setMaxAge(req, maxAge);
            } else if (self.checkETag(req, result, maxAge)) {
              return {};
            }
          }

          if (!result) {
            throw self.apos.error('notfound');
          }
          const renderAreas = req.query['render-areas'];
          const inline = renderAreas === 'inline';
          if (inline || self.apos.launder.boolean(renderAreas)) {
            await self.apos.area.renderDocsAreas(req, [ result ], {
              inline
            });
          }
          // Attach `_url` and `_urls` properties
          self.apos.attachment.all(result, { annotate: true });
          return result;
        }
      ],
      // POST a new page to the site. The schema fields should be part of the
      // JSON request body.
      //
      // You may pass `_targetId` and `_position` to specify the location in
      // the page tree. `_targetId` is the _id of another page, and `_position`
      // may be `before`, `after`, `firstChild` or `lastChild`.
      //
      // If you do not specify these properties they default to the homepage
      // and `lastChild`, creating a subpage of the home page.
      //
      // You may pass _copyingId. If you do all properties not in `req.body`
      // are copied from it.
      //
      // This call is atomic with respect to other REST write operations on
      // pages.
      async post(req) {
        await self.publicApiCheckAsync(req);
        let targetId = self.apos.launder.string(req.body._targetId);
        let position = self.apos.launder.string(req.body._position || 'lastChild');
        // Here we have to normalize before calling insert because we
        // need the parent page to call newChild(). insert calls again but
        // sees there's no work to be done, so no performance hit
        const normalized = await self.getTargetIdAndPosition(
          req,
          null,
          targetId,
          position
        );
        targetId = normalized.targetId || '_home';
        position = normalized.position;
        const copyingId = self.apos.launder.id(req.body._copyingId);
        const createId = self.apos.launder.id(req.body._createId);
        const input = _.omit(req.body, '_targetId', '_position', '_copyingId');
        if (typeof (input) !== 'object') {
          // cheeky
          throw self.apos.error('invalid');
        }

        if (req.body._newInstance) {
          // If we're looking for a fresh page instance and aren't saving yet,
          // simply get a new page doc and return it
          const parentPage = await self.findForEditing(req, self.getIdCriteria(targetId))
            .permission('create', '@apostrophecms/any-page-type').toObject();
          const { _newInstance, ...body } = req.body;
          const newChild = {
            ...self.newChild(parentPage),
            ...body
          };
          newChild._previewable = true;
          return newChild;
        }

        return self.withLock(req, async () => {
          const targetPage = await self
            .findForEditing(req, self.getIdCriteria(targetId))
            .ancestors(true)
            .permission('create')
            .toObject();

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
            copyingId,
            createId
          });
          await self.insert(req, targetPage._id, position, page, { lock: false });
          return self.findOneForEditing(req, { _id: page._id }, {
            attachments: true,
            permission: false
          });
        });
      },
      // Consider using `PATCH` instead unless you're sure you have 100% up to
      // date data for every property of the page. If you are trying to change
      // one thing, `PATCH` is a smarter choice.
      //
      // Update the page via `PUT`. The entire page, including all areas,
      // must be in req.body.
      //
      // To move a page in the tree at the same time, you may pass `_targetId`
      // and `_position`. Unlike normal properties passed to PUT these are not
      // mandatory to pass every time.
      //
      // This call is atomic with respect to other REST write operations on
      // pages.
      //
      // If `_advisoryLock: { tabId: 'xyz', lock: true }` is passed, the
      // operation will begin by obtaining an advisory lock on the document for
      // the given context id, and no other items in the patch will be addressed
      // unless that succeeds. The client must then refresh the lock frequently
      // (by default, at least every 30 seconds) with repeated PATCH requests of
      // the `_advisoryLock` property with the same context id. If
      // `_advisoryLock: { tabId: 'xyz', lock: false }` is passed, the advisory
      // lock will be released *after* addressing other items in the same patch.
      // If `force: true` is added to the `_advisoryLock` object it will always
      // remove any competing advisory lock.
      //
      // `_advisoryLock` is only relevant if you want to ask others not to edit
      // the document while you are editing it in a modal or similar.

      async put(req, _id) {
        _id = self.inferIdLocaleAndMode(req, _id);
        await self.publicApiCheckAsync(req);

        return self.withLock(req, async () => {
          const page = await self.findForEditing(req, { _id }).toObject();
          if (!page) {
            throw self.apos.error('notfound');
          }
          if (!page._edit) {
            throw self.apos.error('forbidden');
          }
          const input = req.body;
          const manager = self.apos.doc.getManager(
            self.apos.launder.string(input.type) || page.type
          );
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
      async delete(req, _id) {
        _id = self.inferIdLocaleAndMode(req, _id);
        await self.publicApiCheckAsync(req);
        const page = await self.findOneForEditing(req, {
          _id
        });

        if (!page) {
          throw self.apos.error('notfound');
        }
        return self.delete(req, page);
      },
      // Patch some properties of the page.
      //
      // You may pass `_targetId` and `_position` to move the page within the
      // tree. `_position` may be `before`, `after` or `inside`. To move a page
      // into or out of the archive, set `archived` to `true` or `false`.
      async patch(req, _id) {
        _id = self.inferIdLocaleAndMode(req, _id);
        await self.publicApiCheckAsync(req);
        return self.patch(req, _id);
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        ':_id/publish': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing(req.clone({
            mode: 'draft'
          }), {
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
        ':_id/localize': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForLocalizing(req.clone({
            mode: 'draft'
          }), {
            aposDocId: _id.split(':')[0]
          });
          if (!draft) {
            throw self.apos.error('notfound');
          }
          if (!draft.aposLocale) {
            // Not subject to draft/publish workflow
            throw self.apos.error('invalid');
          }
          const toLocale = self.apos.i18n.sanitizeLocaleName(req.body.toLocale);
          const update = self.apos.launder.boolean(req.body.update);
          if ((!toLocale) || (toLocale === req.locale)) {
            throw self.apos.error('invalid');
          }
          return self.localize(req, draft, toLocale, {
            update
          });
        },
        ':_id/unpublish': async (req) => {
          const _id = self.apos.i18n.inferIdLocaleAndMode(req, req.params._id);
          const aposDocId = _id.replace(/:.*$/, '');
          const published = await self.findOneForEditing(req.clone({
            mode: 'published'
          }), {
            aposDocId
          });
          if (!published) {
            throw self.apos.error('notfound');
          }
          return self.withLock(
            req,
            async () => self.unpublish(req, published)
          );
        },
        ':_id/submit': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing(req.clone({
            mode: 'draft'
          }), {
            aposDocId: _id.split(':')[0]
          });
          if (!draft) {
            throw self.apos.error('notfound');
          }
          const manager = self.apos.doc.getManager(draft.type);
          return manager.submit(req, draft);
        },
        ':_id/dismiss-submission': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing(req.clone({
            mode: 'draft'
          }), {
            aposDocId: _id.split(':')[0]
          });
          if (!draft) {
            throw self.apos.error('notfound');
          }
          const manager = self.apos.doc.getManager(draft.type);
          return manager.dismissSubmission(req, draft);
        },
        ':_id/revert-draft-to-published': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          const draft = await self.findOneForEditing(req.clone({
            mode: 'draft'
          }), {
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
          const published = await self.findOneForEditing(req.clone({
            mode: 'published'
          }), {
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
        },
        ':_id/share': async (req) => {
          const { _id } = req.params;
          const share = self.apos.launder.boolean(req.body.share);

          if (!_id) {
            throw self.apos.error('invalid');
          }

          const draft = await self.findOneForEditing(req, {
            _id
          });

          if (!draft || draft.aposMode !== 'draft') {
            throw self.apos.error('notfound');
          }

          const sharedDoc = share
            ? await self.share(req, draft)
            : await self.unshare(req, draft);

          return sharedDoc;
        },
        publish (req) {
          if (!Array.isArray(req.body._ids)) {
            throw self.apos.error('invalid');
          }

          req.body._ids = req.body._ids.map(_id => {
            return self.inferIdLocaleAndMode(req, _id);
          });

          return self.apos.modules['@apostrophecms/job'].runBatch(
            req,
            req.body._ids,
            async function(req, id) {
              const piece = await self.findOneForEditing(req, { _id: id });
              if (!piece) {
                throw self.apos.error('notfound');
              }

              await self.publish(req, piece);
            },
            {
              action: 'publish',
              docTypes: [ self.__meta.name, '@apostrophecms/page' ]
            }
          );
        },
        async archive(req) {
          if (!Array.isArray(req.body._ids)) {
            throw self.apos.error('invalid');
          }

          const ids = req.body._ids.map(_id => {
            return self.inferIdLocaleAndMode(req, _id);
          });

          const patches = await self.getBatchArchivePatches(req, ids);

          return self.apos.modules['@apostrophecms/job'].runBatch(
            req,
            patches.map(patch => patch._id),
            async function(req, id) {
              const patch = patches.find(patch => patch._id === id);

              await self.patch(
                req.clone({
                  mode: 'draft',
                  body: patch.body
                }),
                patch._id
              );
            },
            {
              action: 'archive',
              docTypes: [ self.__meta.name, '@apostrophecms/page' ]
            }
          );
        },
        async restore(req) {
          if (!Array.isArray(req.body._ids)) {
            throw self.apos.error('invalid');
          }

          const ids = req.body._ids.map(_id => {
            return self.inferIdLocaleAndMode(req, _id);
          });

          const patches = await self.getBatchRestorePatches(req, ids);

          return self.apos.modules['@apostrophecms/job'].runBatch(
            req,
            patches.map(patch => patch._id),
            async function(req, id) {
              const patch = patches.find(patch => patch._id === id);

              await self.patch(
                req.clone({
                  mode: 'draft',
                  body: patch.body
                }),
                patch._id
              );
            },
            {
              action: 'restore',
              docTypes: [ self.__meta.name, '@apostrophecms/page' ]
            }
          );
        },
        localize(req) {
          req.body.type = 'apostrophe:pages';

          return self.apos.modules['@apostrophecms/job'].run(
            req,
            (req, reporting) => self.apos.modules['@apostrophecms/i18n']
              .localizeBatch(req, self, reporting),
            {
              action: 'localize',
              ids: req.body._ids,
              docTypes: [ self.__meta.name, '@apostrophecms/page' ]
            }
          );
        }
      },
      get: {
        ':_id/locales': async (req) => {
          const _id = self.inferIdLocaleAndMode(req, req.params._id);
          return {
            results: await self.apos.doc.getLocales(req, _id)
          };
        }
      }
    };
  },
  routes(self) {
    return {
      get: {
        // Redirects to the URL of the document in the specified alternate
        // locale. Issues a 404 if the document not found, a 400 if the
        // document has no URL
        ':_id/locale/:toLocale': self.apos.i18n.toLocaleRouteFactory(self)
      }
    };
  },
  handlers(self) {
    return {
      '@apostrophecms/page-type:beforeSave': {
        handleParkedFieldsOverride(req, doc) {
          if (!doc.parkedId) {
            return;
          }
          const parked = self.parked.find(p => p.parkedId === doc.parkedId);
          if (!parked) {
            return;
          }
          const parkedFields = Object.keys(parked).filter(field => field !== '_defaults');
          for (const parkedField of parkedFields) {
            doc[parkedField] = parked[parkedField];
          }
        }
      },
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
          // Avoid redundant work when ancestors are available. They won't be
          // if they are not enabled OR we're not on a regular CMS page at the
          // moment
          if (req.data.page && req.data.page._ancestors && req.data.page._ancestors[0]) {
            req.data.home = req.data.page._ancestors[0];
            return;
          }
          // Fetch the home page with the same builders used to fetch
          // ancestors, for consistency. If builders for ancestors are not
          // configured, then by default we still fetch the children of the home
          // page, so that tabs are easy to implement. However allow this to be
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
      'apostrophe:modulesRegistered': {
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
        detectSchemaConflicts() {
          for (const left of self.typeChoices) {
            for (const right of self.typeChoices) {
              const diff = compareSchema(left, right);
              if (diff.size) {
                self.apos.util.warnDev(`The page type "${left.name}" has a conflict with "${right.name}" (${formatDiff(diff)}). This may cause errors or other problems when an editor switches page types.`);
              }
            }
          }
          function compareSchema(left, right) {
            const conflicts = new Map();
            if (left.name === right.name) {
              return conflicts;
            }

            const leftSchema = self.apos.modules[left.name].schema;
            const rightSchema = self.apos.modules[right.name].schema;
            for (const leftField of leftSchema) {
              const rightField = rightSchema.find(field => field.name === leftField.name);
              if (rightField && leftField.type !== rightField.type) {
                conflicts.set(leftField.name, [ leftField.type, rightField.type ]);
              }
            }

            return conflicts;
          }
          function formatDiff(diff) {
            return Array.from(diff.entries())
              .map(([ entry, [ left, right ] ]) => `${entry}:${left} vs ${entry}:${right}`);
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
                options: {
                  editRole: 'admin',
                  publishRole: 'admin'
                },
                permissions: {},
                find(req) {
                  return [];
                },
                isLocalized() {
                  return false;
                }
              };
            }
          }
        },
        composeBatchOperations() {
          const groupedOperations = Object.entries(self.batchOperations)
            .reduce((acc, [ opName, properties ]) => {
              // Check if there is a required schema field for this batch
              // operation.
              const requiredFieldNotFound = properties.requiredField && !self.schema
                .some((field) => field.name === properties.requiredField);

              if (requiredFieldNotFound) {
                return acc;
              }
              // Find a group for the operation, if there is one.
              const associatedGroup = getAssociatedGroup(opName);
              const currentOperation = {
                action: opName,
                ...properties
              };
              const { action, ...props } = getOperationOrGroup(
                currentOperation,
                associatedGroup,
                acc
              );

              return {
                ...acc,
                [action]: {
                  ...props
                }
              };
            }, {});

          self.batchOperations = Object.entries(groupedOperations)
            .map(([ action, properties ]) => ({
              action,
              ...properties
            }));

          function getOperationOrGroup (currentOp, [ groupName, groupProperties ], acc) {
            if (!groupName) {
              // Operation is not grouped. Return it as it is.
              return currentOp;
            }

            // Return the operation group with the new operation added.
            return {
              action: groupName,
              ...groupProperties,
              operations: [
                ...(acc[groupName] && acc[groupName].operations) || [],
                currentOp
              ]
            };
          }

          // Returns the object entry, e.g., `[groupName, { ...groupProperties
          // }]`
          function getAssociatedGroup (operation) {
            return Object.entries(self.batchOperationsGroups)
              .find(([ _key, { operations } ]) => {
                return operations.includes(operation);
              }) || [];
          }
        },
        composeUtilityOperations() {
          self.utilityOperations = Object.entries(self.utilityOperations || {})
            .map(([ action, properties ]) => ({
              action,
              ...properties
            }));
        }
      },
      'apostrophe:ready': {
        addServeRoute() {
          self.apos.app.get('*',
            (req, res, next) => {
              return self.apos.expressCacheOnDemand
                ? self.apos.expressCacheOnDemand(req, res, next)
                : next();
            },
            self.serve
          );
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
        return (_id === '_home')
          ? {
            level: 0
          }
          : (_id === '_archive')
            ? {
              level: 1,
              archived: true
            }
            : {
              _id
            };
      },
      // Implementation of the PATCH route. Factored as a method to allow
      // it to be called from the universal @apostrophecms/doc PATCH route
      // as well.
      //
      // However if you plan to submit many patches over a period of time while
      // editing you may also want to use the advisory lock mechanism.
      //
      // If `_advisoryLock: { tabId: 'xyz', lock: true }` is passed, the
      // operation will begin by obtaining an advisory lock on the document for
      // the given context id, and no other items in the patch will be addressed
      // unless that succeeds. The client must then refresh the lock frequently
      // (by default, at least every 30 seconds) with repeated PATCH requests of
      // the `_advisoryLock` property with the same context id. If
      // `_advisoryLock: { tabId: 'xyz', lock: false }` is passed, the advisory
      // lock will be released *after* addressing other items in the same patch.
      // If `force: true` is added to the `_advisoryLock` object it will always
      // remove any competing advisory lock.
      //
      // `_advisoryLock` is only relevant if you plan to make ongoing edits
      // over a period of time and wish to avoid conflict with other users. You
      // do not need it for one-time patches.
      //
      // If `input._patches` is an array of patches to the same document, this
      // method will iterate over those patches as if each were `input`,
      // applying all of them within a single lock and without redundant network
      // operations. This greatly improves the performance of saving all changes
      // to a document at once after accumulating a number of changes in patch
      // form on the front end. If _targetId and _position are present only the
      // last such values given in the array of patches are applied.
      async patch(req, _id) {
        return self.withLock(req, async () => {
          const input = req.body;
          const keys = Object.keys(input);
          let possiblePatchedFields;
          if (input._advisoryLock && keys.length === 1) {
            possiblePatchedFields = false;
          } else if (keys.length === 0) {
            possiblePatchedFields = false;
          } else {
            possiblePatchedFields = true;
          }
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
            if (possiblePatchedFields) {
              await self.applyPatch(req, page, input);
            }
            if (i === (patches.length - 1)) {
              if (possiblePatchedFields) {
                await self.update(req, page);
                let modified;
                if (input._targetId) {
                  const targetId = self.apos.launder.string(input._targetId);
                  const position = self.apos.launder.string(input._position);
                  modified = await self.move(req, page._id, targetId, position);
                }
                result = await self
                  .findOneForEditing(req, { _id }, { attachments: true });
                if (modified) {
                  result.__changed = modified.changed;
                }
              }
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
      // Apply a single patch to the given page without saving. An
      // implementation detail of the patch method, also used by the undo
      // mechanism to simulate patches. Does not handle _targetId, that is
      // implemented in the patch method.
      async applyPatch(req, page, input) {
        const manager = self.apos.doc
          .getManager(self.apos.launder.string(input.type) || page.type);
        if (!manager) {
          throw self.apos.error('invalid');
        }
        self.apos.schema.implementPatchOperators(input, page);
        const parentPage = page._ancestors.length &&
          page._ancestors[page._ancestors.length - 1];
        const schema = self.apos.schema.subsetSchemaForPatch(manager.allowedSchema(req, {
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
        _.defaults(browserOptions, {
          label: 'apostrophe:page',
          pluralLabel: 'apostrophe:pages',
          components: {}
        });
        _.defaults(browserOptions.components, {
          editorModal: self.getComponentName('editorModal', 'AposDocEditor'),
          managerModal: self.getComponentName('managerModal', 'AposPagesManager')
        });

        if (req.data.bestPage) {
          browserOptions.page = self.pruneCurrentPageForBrowser(req.data.bestPage);
        }
        browserOptions.name = self.__meta.name;
        browserOptions.filters = self.filters;
        browserOptions.canPublish = self.apos.permission.can(req, 'publish', '@apostrophecms/any-page-type');
        browserOptions.canCreate = self.apos.permission.can(req, 'create', '@apostrophecms/any-page-type', 'draft');
        browserOptions.quickCreate = self.options.quickCreate && self.apos.permission.can(req, 'create', '@apostrophecms/any-page-type', 'draft');
        browserOptions.localized = true;
        browserOptions.autopublish = false;
        // A list of all valid page types, including parked pages etc. This is
        // not a menu of choices for creating a page manually
        browserOptions.validPageTypes = self.apos.instancesOf('@apostrophecms/page-type').map(module => module.__meta.name);
        browserOptions.canEdit = self.apos.permission.can(req, 'edit', '@apostrophecms/any-page-type', 'draft');
        browserOptions.canLocalize = browserOptions.canEdit &&
          browserOptions.localized &&
          Object.keys(self.apos.i18n.locales).length > 1 &&
          Object.values(self.apos.i18n.locales).some(locale => locale._edit);
        browserOptions.batchOperations = self.checkBatchOperationsPermissions(req);
        browserOptions.utilityOperations = self.utilityOperations;
        browserOptions.canDeleteDraft = self.apos.permission.can(req, 'delete', '@apostrophecms/any-page-type', 'draft');

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
      // Insert a page. `targetId` must be an existing page id, `_archive` or
      // `_home`, and `position` may be `before`, `inside` or `after`.
      // Alternatively `position` may be a zero-based offset for the new child
      // of `targetId` (note that the `rank` property of sibling pages is not
      // strictly ascending, so use an array index into `_children` to determine
      // this parameter instead).
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
        const normalized = await self.getTargetIdAndPosition(
          req,
          null,
          targetId,
          position
        );
        targetId = normalized.targetId;
        position = normalized.position;
        return self.withLock(req, async () => {
          let peers;
          const target = await self.getTarget(req, targetId, position);
          if (!target) {
            throw self.apos.error('notfound');
          }
          let parent;
          if ((position === 'before') || (position === 'after')) {
            parent = await self.findForEditing(req, {
              path: self.getParentPath(target)
            }, { permission: 'create' }).children({
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
            if (!parent._create) {
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
                // Archive has to be last child of the home page, but don't be
                // punitive, just put this page before it
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
            const index = peers.findIndex(peer => peer._id === target._id);
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
          // Prevent a published page from being inserted as a child of a draft
          // page. In effect when this method is called again from the
          // `afterInsert` event of the `doc` module. This can happen when we
          // are inserting a page in req.mode == 'published', which results in
          // insertDrafOf being called (`page-type` module).
          if (page.lastPublishedAt && !parent.lastPublishedAt) {
            await self.unpublish(req, page);
            throw self.apos.error('forbidden', 'Publish the parent page first.');
          }
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
      // inserts or moves that are triggered by `afterMove`, `beforeInsert`,
      // etc.
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
        // Default is to allow any type in the configured list
        return _.map(self.typeChoices, 'name');
      },
      // Move a page already in the page tree to another location.
      //
      // `movedId` is the id of the page being moved. `targetId` must be an
      // existing page id, and `position` may be `before`, `firstChild`,
      // `lastChild` or `after`. Alternatively `position` may be a zero-based
      // offset for the new child of `targetId` (note that the `rank` property
      // of sibling pages is not strictly ascending, so use an array index into
      // `_children` to determine this parameter instead).
      //
      // As a shorthand, `targetId` may be `_archive` to refer to the main
      // archive page, or `_home` to refer to the home page.
      //
      // Returns an object with a `modified` property, containing an
      // array of objects with _id and slug properties, indicating the new
      // slugs of all modified pages. If `options` is passed to this method, it
      // is also supplied as the `options` property of the returned object.
      //
      // After the moved and target pages are fetched, the `beforeMove` event
      // is emitted with `req, moved, target, position`.
      async move(req, movedId, targetId, position) {
        // Handle numeric positions
        const normalized = await self.getTargetIdAndPosition(
          req,
          movedId,
          targetId,
          position
        );
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
          let target;
          try {
            target = await self.getTarget(req, targetId, position);
          } catch (e) {
            // Try again with the draft version of the target, only when
            // moving before/after and the target is published page.
            if (e.name === 'notfound' && targetId.endsWith(':published') && [ 'before', 'after' ].includes(position)) {
              target = await self.getTarget(
                req.clone({ mode: 'draft' }),
                targetId.replace(':published', ':draft'),
                position
              );
            } else {
              throw e;
            }
          }
          const manager = self.apos.doc.getManager(moved.type);
          await manager.emit('beforeMove', req, moved, target, position);
          determineRankAndNewParent();
          // Simple check to see if we are moving the page beneath itself
          if (parent.path.split('/').includes(moved.aposDocId)) {
            throw self.apos.error('forbidden', 'Cannot move a page under itself');
          }
          if (!moved._edit) {
            throw self.apos.error('forbidden');
          }
          if (!(parent && oldParent)) {
            // Move outside tree
            throw self.apos.error('forbidden');
          }
          if (
            (oldParent._id !== parent._id) &&
            (parent.type !== '@apostrophecms/archive-page') &&
            (!parent._create) &&
            (oldParent.type === '@apostrophecms/archive-page' && !parent._edit)
          ) {
            throw self.apos.error('forbidden');
          }
          if (moved.lastPublishedAt && !parent.lastPublishedAt) {
            throw self.apos.error('forbidden', 'Publish the parent page first.');
          }
          const peersChange = await nudgeNewPeers();
          const movedChange = await moveSelf();
          await updateDescendants();
          await manager.emit('afterMove', req, moved, {
            originalSlug,
            originalPath,
            changed,
            target,
            position
          });
          // Do not report the additional changes to the event - BC.
          // Concatenate all changes to one unique array.
          changed = Object.values(
            [ movedChange, ...peersChange, changed ]
              .reduce((acc, change) => {
                acc[change._id] = {
                  ...acc[change._id] || {},
                  ...change
                };
                return acc;
              }, {})
          );
          return {
            changed
          };
          async function getMoved() {
            const moved = await self
              .findForEditing(req, { _id: movedId })
              .permission(false)
              .ancestors({
                depth: 1,
                visibility: null,
                archived: null,
                areas: false,
                relationships: false,
                permission: false
              })
              .toObject();
            if (!moved) {
              throw self.apos.error('invalid', 'No such page');
            }
            if (!moved.level) {
              throw self.apos.error('invalid', 'Cannot move the home page');
            }
            // You can't move the archive itself
            if (moved.type === '@apostrophecms/archive-page') {
              throw self.apos.error('invalid', 'Cannot move the archive');
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
                throw self.apos.error('invalid', 'Only the archive can be the last child of the home page.');
              }
              rank = target.rank + 1;
            } else if (position === 'lastChild') {
              parent = target;
              if (!parent.level && (moved.type !== '@apostrophecms/archive-page')) {
                const archive = parent._children.find(peer => peer.type === '@apostrophecms/archive-page');
                if (archive) {
                  // Archive has to be last child of the home page, but don't
                  // be punitive, just put this page before it
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
            const locale = moved.aposLocale.split(':')[0];
            const criteria = {
              path: self.matchDescendants(parent),
              aposLocale: { $in: [ `${locale}:draft`, `${locale}:published` ] },
              level: parent.level + 1,
              rank: { $gte: rank }
            };
            // Nudge down the pages that should now follow us
            await self.apos.doc.db.updateMany(criteria, {
              $inc: { rank: 1 }
            });
            const modified = await self.apos.doc.db.find({
              ...criteria,
              aposDocId: { $ne: moved.aposDocId }
            })
              .project({
                _id: 1,
                rank: 1
              })
              .toArray();
            return modified;
          }
          async function moveSelf() {
            originalPath = moved.path;
            originalSlug = moved.slug;
            const level = parent.level + 1;
            const newPath = self.apos.util.addSlashIfNeeded(parent.path) +
              path.basename(moved.path);
            // We're going to use update with $set, but we also want to update
            // the object so that moveDescendants can see what we did
            moved.path = newPath;
            // If the old slug wasn't customized, OR our new parent is
            // in the archive, update the slug as well as the path
            if (parent._id !== oldParent._id) {
              const matchOldParentSlugPrefix = new RegExp('^' + self.apos.util.regExpQuote(self.apos.util.addSlashIfNeeded(oldParent.slug)));
              if (moved.slug.match(matchOldParentSlugPrefix)) {
                const movedSlugCandidate = moved.slug
                  .split('/')
                  .slice(0, -1)
                  .join('/');

                moved.slug = parent.slug.endsWith(movedSlugCandidate)
                  ? parent.slug.replace(movedSlugCandidate, '').concat(moved.slug)
                  : moved.slug.replace(
                    matchOldParentSlugPrefix,
                    self.apos.util.addSlashIfNeeded(parent.slug)
                  );
                changed.push({
                  _id: moved._id,
                  slug: moved.slug
                });
              } else if (parent.archived && !moved.archived) {
                // #385: we don't follow the pattern of our old parent but we're
                // moving to the archive, so the slug must change to avoid
                // blocking reuse of the old URL by a new page
                moved.slug = parent.slug + '/' + path.basename(moved.slug);
              }
            }
            moved.level = level;
            moved.rank = rank;
            // Are we in the archive? Our new parent reveals that
            if (parent.archived) {
              moved.archived = true;
            } else {
              delete moved.archived;
            }
            await self.update(req, moved);
            return {
              _id: moved._id,
              slug: moved.slug,
              path: moved.path,
              rank: moved.rank,
              level: moved.level,
              archived: moved.archived ?? null,
              updatedAt: moved.updatedAt
            };
          }
          async function updateDescendants() {
            const descendants = await self.updateDescendantsAfterMove(
              req,
              moved,
              originalPath,
              originalSlug
            );
            changed = changed.concat(descendants);
          }
        }
      },
      // A method to return a target page object based on a passed `targetId`
      // value. `position` is used to prevent attempts to move after the archive
      // "page."
      async getTarget(req, targetId, position) {
        // self.inferIdLocaleAndMode (see i18n module)
        // is mutating the req object. This leads to various issues. This
        // handler is shared among different routines (publish, insert, etc)
        // and should NOT alter the request state.
        const _req = req.clone({});
        const criteria = self.getIdCriteria(self.inferIdLocaleAndMode(_req, targetId));
        // Use findForEditing to ensure we get improvements to that method from
        // npm modules that make the query more inclusive. Then explicitly shut
        // off things we know we don't want to be blocked by
        const target = await self.findForEditing(_req, criteria)
          .permission(false)
          .archived(null)
          .areas(false)
          .ancestors({
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
      // Based on `req`, `moved`, `data.moved`, `data.oldParent` and
      // `data.parent`, decide whether this move should be permitted. If it
      // should not be, throw an error.
      //
      // This method is async because overrides, for instance in
      // @apostrophecms/workflow, may require asynchronous work to perform it.
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
                self.apos.doc.db.updateOne(
                  { _id: descendant._id },
                  { $set: { path: descendant.path } }
                );
              } else {
                throw err;
              }
            }
          }
        }
      },
      // Returns `{ parentSlug: '/foo', changed: [ ... ] }` where `parentSlug`
      // is the slug of the page's former parent, and `changed` is an array of
      // objects with _id and slug properties, including all subpages that had
      // to move too.
      async archive(req, _id) {
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
          return self.find(req, { _id }).permission('edit').ancestors({
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
        await self.apos.doc.update(req, page, options);
        return page;
      },
      // Publish a draft, updating the published locale.
      async publish(req, draft, options = {}) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.publish(req, draft, options);
      },

      // Unpublish a page
      async unpublish(req, page) {
        const manager = self.apos.doc.getManager(page.type);
        return manager.unpublish(req, page);
      },

      // Share a draft
      async share(req, draft) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.share(req, draft);
      },

      // Unshare a draft
      async unshare(req, draft) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.unshare(req, draft);
      },

      // Localize the draft, i.e. copy it to another locale, creating
      // that locale's draft for the first time if necessary. By default
      // existing documents are not updated
      async localize(req, draft, toLocale, options = { update: false }) {
        const manager = self.apos.doc.getManager(draft.type);
        return manager.localize(req, draft, toLocale, options);
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
          return await self.serve500Error(req, err);
        }

        if (self.options.cache?.page?.maxAge) {
          const { maxAge } = self.options.cache.page;

          if (!self.options.cache.page.etags) {
            self.setMaxAge(req, maxAge);
          } else if (self.checkETag(req, undefined, maxAge)) {
            // Stop there and send a 304 status code; the cached response will
            // be used
            return res.sendStatus(304);
          }
        }

        try {
          await self.serveDeliver(req, null);
        } catch (err) {
          await self.serve500Error(req, err);
        }
      },
      // Sets `req.data.bestPage` to the page whose slug is the longest
      // path prefix of `req.params[0]` (the page slug); an exact match
      // of course wins, followed by the parent "folder," and so on up to the
      // home page.
      async serveGetPage(req) {
        const spanName = `${self.__meta.name}:serveGetPage`;
        await self.apos.telemetry.startActiveSpan(spanName, async (span) => {
          span.setAttribute(SemanticAttributes.CODE_FUNCTION, 'serveGetPage');
          span.setAttribute(SemanticAttributes.CODE_NAMESPACE, self.__meta.name);

          try {
            req.slug = req.params[0];
            self.normalizeSlug(req);
            // Had to change the URL, so redirect to it. TODO: this
            // contains an assumption that we are mounted at /
            if (req.slug !== req.params[0]) {
              req.redirect = req.slug;
            }
            const builders = self.getServePageBuilders();
            const query = self.find(req);
            query.applyBuilders(builders);
            self.matchPageAndPrefixes(query, req.slug);
            await self.emit('serveQuery', query);
            req.data.bestPage = await query.toObject();
            self.evaluatePageMatch(req);

            span.setStatus({ code: self.apos.telemetry.api.SpanStatusCode.OK });
          } catch (err) {
            self.apos.telemetry.handleError(span, err);
            throw err;
          } finally {
            span.end();
          }
        });
      },
      // Normalize req.slug to account for unneeded trailing whitespace,
      // trailing slashes other than the root, and double slash based open
      // redirect attempts
      normalizeSlug(req) {
        // Fix common screwups in URLs: leading/trailing whitespace,
        // presence of trailing slashes (but always restore the
        // leading slash). Express leaves escape codes uninterpreted
        // in the path, so look for %20, not ' '.
        req.slug = req.slug.trim();
        req.slug = self.removeTrailingSlugSlashes(req, req.slug);

        // Prevent open redirect attacks based on escaped paths
        // (stomp double slashes)
        req.slug = req.slug.replace(/\/+/g, '/');

        if (!req.slug.length || req.slug.charAt(0) !== '/') {
          req.slug = '/' + req.slug;
        }
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
      // to intercept the request. If none intercept it, the standard 404
      // behavior is set up.
      async serveNotFound(req) {
        if (self.isFound(req)) {
          return;
        }

        if (req.user && (req.mode === 'published')) {
          // Try again in draft mode
          try {
            const testReq = self.apos.task.getReq({
              user: req.user,
              url: req.url,
              slug: req.slug,
              // Simulate what this looks like when the serve page route starts.
              // This is an object, not an array
              params: {
                0: decodeURIComponent(req.path)
              },
              query: req.query,
              mode: 'draft',
              locale: req.locale
            });
            let again;
            do {
              again = false;
              await self.serveGetPage(testReq);
              await self.emit('serve', testReq);
              if (testReq.res.redirectedTo) {
                again = true;
                testReq.url = testReq.res.redirectedTo;
                const qat = testReq.url.indexOf('?');
                if (qat >= 0) {
                  testReq.slug = testReq.url.substring(0, qat);
                } else {
                  testReq.slug = testReq.url;
                }
                testReq.path = testReq.slug;
                testReq.params = {
                  0: testReq.path
                };
                testReq.res.redirectedTo = null;
              }
            } while (again);
            if (self.isFound(testReq)) {
              req.redirect = self.apos.url.build(req.url, {
                aposMode: 'draft'
              });
              return;
            }
          } catch (e) {
            self.apos.util.warn('Error while probing for draft page:', e);
            // Nonfatal, we were just probing
          }
        }

        // If uppercase letters in URL, try with lowercase
        if (self.options.redirectFailedUpperCaseUrls && /[A-Z]/.test(req.path)) {
          req.redirect = self.apos.url.build(req.path.toLowerCase(), req.query);
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
        // Apostrophe treats req as a notepad of things we'd
        // like to happen in res; that allows various
        // pageServe methods to override each other.
        // Now we're finally ready to enact those
        // things on res
        if (req.contentType) {
          req.res.setHeader('Content-Type', req.contentType);
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
      // In the event of an error during the beforeSend event or the
      // error template itself, we render the error template in a
      // simplified way with less potential for chicken and egg problems
      async serve500Error(req, err) {
        self.apos.template.logError(req, err);
        req.res.statusCode = 500;
        return req.res.send(await self.render(req, '@apostrophecms/template:templateError'));
      },
      // A request is "found" if it should not be
      // treated as a "404 not found" situation
      isFound(req) {
        return req.loginRequired ||
          req.insufficient ||
          req.redirect ||
          (req.data.page && !req.notFound);
      },
      // Returns the query builders to be invoked when fetching a
      // page, by default. These add information about ancestor and child
      // pages of the page in question
      getServePageBuilders() {
        return self.options.builders || {
          // Get the kids of the ancestors too so we can do tabs and accordion
          // nav
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
      // `req.remainder` is then utilized by modules like
      // `@apostrophecms/page-type` to implement features like dispatch, which
      // powers the "permalink" or "show" pages of
      // `@apostrophecms/piece-page-type`
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
        // also change, if they are still similar. Also the archived
        // status should match the new parent
        const changed = [];
        if (originalSlug === page.slug && originalPath === page.path) {
          return changed;
        }
        const oldLevel = originalPath.split('/').length - 1;
        const matchParentPathPrefix = new RegExp('^' + self.apos.util.regExpQuote(originalPath + '/'));
        const matchParentSlugPrefix = new RegExp('^' + self.apos.util.regExpQuote(originalSlug + '/'));
        const descendants = await self.findForEditing(req, {
          path: matchParentPathPrefix
        }).areas(false).relationships(false).toArray();
        for (const descendant of descendants) {
          let newSlug = descendant.slug.replace(matchParentSlugPrefix, page.slug + '/');
          if (page.archived && !descendant.archived) {
            // #385: we are moving this to the archive, force a new slug
            // even if it was formerly a customized one. Otherwise it is
            // difficult to free up custom slugs by archiving pages
            if (newSlug === descendant.slug) {
              newSlug = page.slug + '/' + path.basename(descendant.slug);
            }
          }
          // Allow for the possibility that the slug becomes
          // a duplicate of something already nested under
          // the new parent at this point
          descendant.path = descendant.path.replace(matchParentPathPrefix, page.path + '/');
          descendant.slug = newSlug;
          descendant.level = descendant.level + (page.level - oldLevel);
          descendant.archived = page.archived;
          await self.apos.doc.retryUntilUnique(
            req,
            descendant,
            () => self.update(req, descendant)
          );
          changed.push({
            _id: descendant._id,
            slug: descendant.slug,
            path: descendant.path,
            level: descendant.level,
            rank: descendant.rank,
            archived: descendant.archived
          });
        }
        return changed;
      },
      // Parks one page as found in the `park` option. Called by
      // `implementParkAll`.
      async implementParkOne(req, item) {
        if (!item.parkedId) {
          throw new Error('Parked pages must have a unique parkedId property');
        }
        if (
          !((item.type || (item._defaults && item._defaults.type)) &&
          (item.slug || item._defaults.slug))
        ) {
          throw new Error('Parked pages must have type and slug properties, they may be fixed or part of _defaults:\n' + JSON.stringify(item, null, '  '));
        }
        item = klona(item);
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
          return self.findOneForEditing(req, {
            slug: parentSlug
          }, {
            areas: false,
            relationships: false
          });
        }
        async function findExisting() {
          return self.findOneForEditing(req, { parkedId: item.parkedId });
        }
        async function updateExisting() {
          // Enforce all permanent properties on existing
          // pages too
          await self.apos.doc.db.updateOne(
            { _id: existing._id },
            { $set: self.apos.util.clonePermanent(item) }
          );
        }
        async function insert() {
          const parkedDefaults = { ...(item._defaults || {}) };
          const cloned = { ...item };
          delete cloned._defaults;
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
            ...cloned
          };
          delete _item._children;
          if (!parent) {
            // Parking the home page for the first time
            _item.aposDocId = await self.apos.doc.bestAposDocId({
              level: 0,
              slug: '/'
            });
            _item.path = _item.aposDocId;
            _item.lastPublishedAt = new Date();
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
      composeParked() {
        // If a parkedId appears again in options.park, replace the
        // original, repeatedly if necessary; otherwise append to the
        // self.parked list
        self.parked = [];
        const indexByParkedId = {};
        const candidates = self.options.minimumPark.concat(self.options.park || []);
        for (const candidate of candidates) {
          if (indexByParkedId[candidate.parkedId] === undefined) {
            indexByParkedId[candidate.parkedId] = self.parked.length;
            self.parked.push(candidate);
          } else {
            self.parked[indexByParkedId[candidate.parkedId]] = candidate;
          }
        }
      },
      async unparkTask(argv) {
        if (argv._.length !== 2) {
          throw new Error('Wrong number of arguments');
        }
        const slug = argv._[1];
        const count = await self.apos.doc.db
          .updateOne({ slug }, { $unset: { parked: 1 } });
        if (!count) {
          throw 'No page with that slug was found.';
        }
      },
      // Reattach a page as the last child of the home page even if
      // the page tree properties are corrupted
      async reattachTask(argv) {
        if (argv._.length !== 2) {
          throw new Error('Wrong number of arguments');
        }
        const modes = [ 'draft', 'published' ];
        const slugOrId = argv._[1];
        for (const mode of modes) {
          // Note that page moves are autopublished
          const req = self.apos.task.getReq({
            mode
          });
          const home = await self.findOneForEditing(req, {
            slug: '/'
          });
          if (!home) {
            throw `No home page was found in ${req.locale}. Exiting.`;
          }
          const page = await self.findOneForEditing(req, {
            $or: [
              {
                slug: slugOrId
              },
              {
                _id: slugOrId
              }
            ]
          });
          if (!page) {
            console.log(`No page with that slug or _id was found in ${req.locale}:${req.mode}.`);
          } else {
            const rank = (await self.apos.doc.db.find({
              path: self.matchDescendants(home),
              aposLocale: req.locale,
              level: home.level + 1
            })
              .project({ rank: 1 })
              .sort({ rank: 1 })
              .toArray())
              .reduce((memo, page) => Math.max(memo, page.rank), 0) + 1;
            page.path = `${home.path}/${page.aposDocId}`;
            page.rank = rank;
            const $set = {
              path: page.path,
              rank: page.rank
            };
            if (argv['new-slug']) {
              $set.slug = argv['new-slug'];
            }
            await self.apos.doc.db.updateOne({
              _id: page._id
            }, {
              $set
            });
            console.log(`Reattached as the last child of the home page in ${req.locale}:${req.mode}.`);
          }
        }
      },
      // Invoked by the @apostrophecms/version module.
      //
      // Your module can add additional doc properties that should never be
      // rolled back by pushing them onto the `fields` array.
      docUnversionedFields(req, doc, fields) {
        // Moves in the tree have knock-on effects on other
        // pages, they are not suitable for rollback
        fields.push('path', 'archived', 'rank', 'level');
      },
      // Returns true if the doc is a page in the tree
      // (it has a slug with a leading /).
      isPage(doc) {
        // Proper docs always have a slug, but some of our unit tests are lazy
        // about this.
        return doc.slug && doc.slug.match(/^\//);
      },
      // Returns a regular expression to match the `path` property of the
      // descendants of the given page, but not itself. You can also pass the
      // path rather than the entire page object.
      matchDescendants(pageOrPath) {
        const path = pageOrPath.path || pageOrPath;
        // Make sure there is a trailing slash, but don't add two (the home
        // page already has one). Also make sure there is at least one
        // additional character, which there always will be, in order to prevent
        // the home page from matching as its own descendant
        return new RegExp(`^${self.apos.util.regExpQuote(path)}/.`);
      },
      // Returns the path property of the page's parent. For use in queries to
      // fetch the parent.
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
            label: 'apostrophe:applyToSubpages',
            group: schema[index].group
          });
        }
        return schema;
      },
      // Get the page type names for all the parked pages, including parked
      // children, recursively.
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
              types = types
                .concat(_.map(page._children, getType))
                .concat(getChildTypes(page._children));
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
          self.getComponentName('editorModal', 'AposDocEditor'),
          { moduleName: self.__meta.name }
        );
      },
      // Returns the effective base URL for the given request.
      // If Apostrophe's top-level `baseUrl` option is set, or a hostname is
      // defined for the active locale, then that is consulted, otherwise the
      // base URL is the empty string. This makes it easier to build absolute
      // URLs (when `baseUrl` is configured), or to harmlessly prepend the empty
      // string (when it is not configured). The Apostrophe queries used to
      // fetch Apostrophe pages consult this method.
      getBaseUrl(req) {
        const hostname = self.apos.i18n.locales[req.locale]?.hostname;

        return hostname
          ? `${req.protocol}://${hostname}`
          : (self.apos.baseUrl || '');
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
      // TODO: restore this method when fully implemented.
      // async batchSimpleRoute(req, name, change) {
      //   const batchOperation = _.find(self.options.batchOperations, { name: name });
      //   const schema = batchOperation.schema || [];
      //   const data = self.apos.schema.newInstance(schema);
      //   await self.apos.schema.convert(req, schema, 'form', req.body, data);
      //   let ids = self.apos.launder.ids(req.body.ids);
      //   if (!ids) {
      //     if (req.body._id) {
      //       ids = self.apos.launder.id(req.body._id);
      //     }
      //   }
      //   if (req.body.job) {
      //     return runJob();
      //   } else {
      //     for (const id of ids) {
      //       await one(req, id);
      //     }
      //   }
      //   async function runJob() {
      //     return self.apos.modules['@apostrophecms/job'].runBatch(req, ids, one, {
      //       // TODO: Update with new progress notification config
      //     });
      //   }
      //   async function one(req, id) {
      //     const page = await self.findForBatch(req, { _id: id }).toObject();
      //     if (!page) {
      //       throw new Error('notfound');
      //     }
      //     await change(req, page, data);
      //   }
      // },
      // Backward compatible method following moving this to page-type module.
      // This page module method may be deprecated in the next major version.
      allowedSchema(req, page, parentPage) {
        return self.apos.doc.getManager(page.type)
          .allowedSchema(req, page, parentPage);
      },
      // Can be extended on a project level with `_super(req, true)` to disable
      // permission check and public API projection. You shouldn't do this
      // if you're not sure what you're doing.
      getRestQuery(req, omitPermissionCheck = false) {
        const query = self.find(req)
          .ancestors(true)
          .children(true)
          .attachments(true)
          .applyBuildersSafely(req.query);
        // Minimum standard for a REST query without a public projection
        // is being allowed to view drafts on the site
        if (!omitPermissionCheck && !self.canAccessApi(req)) {
          if (!self.options.publicApiProjection) {
            // Shouldn't be needed thanks to publicApiCheck, but be sure
            query.and({
              _id: null
            });
          } else {
            query.project({
              ...self.options.publicApiProjection,
              cacheInvalidatedAt: 1
            });
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
      async findOneForLocalizing(req, criteria, builders) {
        return self.findForEditing(req, criteria, builders).toObject();
      },
      // Throws a `notfound` exception if a public API projection is
      // not specified and the user does not have the `view-draft` permission,
      // which all roles capable of editing the site at all will have. This is
      // needed because although all API calls check permissions specifically
      // where appropriate, we also want to flunk all public access to REST APIs
      // if not specifically configured.
      publicApiCheck(req) {
        if (!self.options.publicApiProjection) {
          if (!self.canAccessApi(req)) {
            throw self.apos.error('notfound');
          }
        }
      },
      // An async version of the above. It can be overridden to implement
      // an asynchronous check of the public API permissions.
      async publicApiCheckAsync(req) {
        return self.publicApiCheck(req);
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
          aposLocale: 1,
          updatedAt: 1,
          submitted: 1,
          modified: 1
        };
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
      },
      async implementParkAllInDefaultLocale() {
        for (const mode of [ 'published', 'draft' ]) {
          const req = self.apos.task.getReq({
            mode
          });
          for (const item of self.parked) {
            await self.implementParkOne(req, item);
          }
        }
      },
      async implementParkAllInOtherLocales() {
        // Now that replication has occurred, we can
        // park in the other locales and we'll just
        // reset the parked properties without
        // destroying the locale relationships
        for (const locale of Object.keys(self.apos.i18n.locales)) {
          for (const mode of [ 'published', 'draft' ]) {
            if (locale === self.apos.i18n.defaultLocale) {
              continue;
            }
            const req = self.apos.task.getReq({
              locale,
              mode
            });
            for (const item of self.parked) {
              await self.implementParkOne(req, item);
            }
          }
        }
      },
      ...require('./lib/legacy-migrations')(self),
      addMisreplicatedParkedPagesMigration() {
        self.apos.migration.add('misreplicated-parked-pages', async () => {
          const parkedPages = await self.apos.doc.db.find({
            parkedId: {
              $ne: null
            }
          }).toArray();
          const locales = [
            self.apos.i18n.defaultLocale,
            ...Object.keys(self.apos.i18n.locales)
          ];
          const parkedIds = [ ...new Set(parkedPages.map(page => page.parkedId)) ];
          for (const parkedId of parkedIds) {
            let aposDocId;
            for (const locale of locales) {
              for (const mode of [ 'draft', 'published' ]) {
                const page = parkedPages.find(page => (page.parkedId === parkedId) && (page.aposLocale === `${locale}:${mode}`));
                if (!page) {
                  continue;
                }
                if (!aposDocId) {
                  aposDocId = page.aposDocId;
                } else {
                  if (page.aposDocId !== aposDocId) {
                    await self.apos.doc.db.removeOne({
                      _id: page._id
                    });
                    await self.apos.doc.db.insertOne({
                      ...page,
                      _id: `${aposDocId}:${locale}:${mode}`,
                      aposDocId,
                      path: page.path.replace(page.aposDocId, aposDocId)
                    });
                  }
                }
              }
            }
          }
        });
      },
      addDuplicateParkedPagesMigration() {
        self.apos.migration.add('duplicate-parked-pages', async () => {
          let parkedPages = await self.apos.doc.db.find({
            parkedId: {
              $ne: null
            }
          }).toArray();
          const parkedIds = [ ...new Set(parkedPages.map(page => page.parkedId)) ];
          const names = Object.keys(self.apos.i18n.locales);
          const locales = [
            ...names.map(locale => `${locale}:draft`),
            ...names.map(locale => `${locale}:published`),
            ...names.map(locale => `${locale}:previous`)
          ];
          let changes = 0;
          const winners = new Map();
          for (const locale of locales) {
            for (const parkedId of parkedIds) {
              let matches = parkedPages.filter(page =>
                (page.parkedId === parkedId) &&
                (page.aposLocale === locale)
              );
              if (matches.length > 0) {
                if (!winners.has(parkedId)) {
                  winners.set(parkedId, matches[0].aposDocId);
                }
              }
              if (matches.length > 1) {
                matches = matches.sort((a, b) => a.createdAt - b.createdAt);
                const ids = matches.slice(1).map(page => page._id);
                await self.apos.doc.db.removeMany({
                  _id: {
                    $in: ids
                  }
                });
                parkedPages = parkedPages.filter(page => !ids.includes(page._id));
                changes++;
              }
            }
          }
          const idChanges = [];
          for (const parkedId of parkedIds) {
            const aposDocId = winners.get(parkedId);
            const matches = parkedPages.filter(page => page.parkedId === parkedId);
            for (const match of matches) {
              if (match.aposDocId !== aposDocId) {
                idChanges.push(
                  [ match._id, match._id.replace(match.aposDocId, aposDocId) ]
                );
              }
            }
          }
          if (idChanges.length) {
            // Also calls self.apos.attachment.recomputeAllDocReferences
            await self.apos.doc.changeDocIds(idChanges);
          } else if (changes > 0) {
            await self.apos.attachment.recomputeAllDocReferences();
          }
        });
      },
      async deduplicateRanks2Migration() {
        for (const locale of Object.keys(self.apos.i18n.locales)) {
          for (const mode of [ 'previous', 'draft', 'published' ]) {
            const pages = await self.apos.doc.db.find({
              slug: /^\//,
              aposLocale: `${locale}:${mode}`
            }, {
              path: 1,
              rank: 1,
              slug: 1
            }).toArray();
            const pagesByPath = new Map();
            for (const page of pages) {
              page._children = [];
              pagesByPath.set(page.path, page);
            }
            for (const page of pages) {
              if (page.level === 0) {
                // Home page has no parent
                continue;
              }
              const parentPath = self.getParentPath(page);
              const parent = pagesByPath.get(parentPath);
              if (!parent) {
                self.apos.util.error(`Warning: page ${page._id} has no parent in the tree`);
                continue;
              }
              parent._children.push(page);
            }
            for (const page of pages) {
              const children = page._children;
              children.sort((a, b) => a.rank - b.rank);
              let lastRank = null;
              let bad = false;
              for (const child of children) {
                if (child.rank === lastRank) {
                  bad = true;
                  break;
                }
                lastRank = child.rank;
              }
              if (bad) {
                self.apos.util.warn(`Fixing ranks for children of ${page.slug} in ${page.aposLocale}`);
                for (let i = 0; (i < children.length); i++) {
                  await self.apos.doc.db.updateOne({
                    _id: children[i]._id
                  }, {
                    $set: {
                      rank: i
                    }
                  });
                }
              }
            }
          }
        }
      },
      missingLastPublishedAtMigration() {
        return self.apos.migration.eachDoc({
          aposMode: 'published',
          lastPublishedAt: null
        }, async doc => {
          const draft = await self.apos.doc.db.findOne({
            _id: doc._id.replace(':published', ':draft')
          });
          if (!draft) {
            self.apos.util.error(`Warning: published document has no matching draft: ${doc._id}`);
            return;
          }
          await self.apos.doc.db.updateOne({
            _id: doc._id
          }, {
            $set: {
              lastPublishedAt: draft.lastPublishedAt
            }
          });
        });
      },
      async inferLastTargetIdAndPosition(doc) {
        const parentPath = self.getParentPath(doc);
        const parentAposDocId = parentPath.split('/').pop();
        const parentId = doc.aposLocale
          ? `${parentAposDocId}:${doc.aposLocale}`
          : parentAposDocId;
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
          throw new Error('Cannot find page among its peers');
        }
        if (index === 0) {
          targetId = parentId;
          position = 'firstChild';
        } else if (index === (peers.length - 1)) {
          targetId = parentId;
          position = 'lastChild';
        } else {
          targetId = peers[index - 1]._id;
          position = 'after';
        }
        return {
          lastTargetId: targetId,
          lastPosition: position
        };
      },
      checkBatchOperationsPermissions(req) {
        return self.batchOperations.filter(batchOperation => {
          if (batchOperation.permission) {
            return self.apos.permission.can(req, batchOperation.permission, '@apostrophecms/any-page-type');
          }

          return true;
        });
      },
      composeFilters() {
        self.filters = Object.keys(self.filters)
          .map(name => ({
            name,
            ...self.filters[name],
            inputType: self.filters[name].inputType || 'select'
          }));

        // Add a null choice if not already added or set to `required`
        self.filters.forEach((filter) => {
          if (filter.choices) {
            if (
              !filter.required &&
              filter.choices &&
              !filter.choices.find((choice) => choice.value === null)
            ) {
              filter.def = null;
              filter.choices.push({
                value: null,
                label: 'apostrophe:none'
              });
            }
          } else {
            // Dynamic choices from the REST API, but
            // we need a label for "no opinion"
            filter.nullLabel = 'apostrophe:filterMenuChooseOne';
          }
        });
      },
      async getBatchArchivePatches(req, ids) {
        const batchReq = req.clone({
          aposAncestors: true,
          aposAncestorsApiProjection: {
            _id: 1,
            title: 1,
            level: 1,
            rank: 1
          }
        });
        const pages = await self
          .find(batchReq, { _id: { $in: ids } })
          .areas(false)
          .relationships(false)
          .ancestors({
            archived: null,
            areas: false,
            relationships: false
          })
          .children({
            archived: null,
            areas: false,
            relationships: false
          })
          .archived(null)
          .toArray();

        const patches = pages.flatMap(page => {
          const childrenPatches = page._children
            .filter(child => !ids.includes(child._id))
            .map(child => {
              return {
                _id: child._id,
                title: child.title,
                body: {
                  archived: false,
                  _targetId: page._id,
                  _position: 'before'
                }
              };
            });

          const ancestors = page._ancestors.slice().reverse();

          return childrenPatches
            .concat(
              ancestors.some(ancestor => ids.includes(ancestor._id))
                ? {
                  _id: page._id,
                  title: page.title,
                  body: {
                    _targetId: ancestors.find(ancestor => ids.includes(ancestor._id))?._id || '_archive',
                    _position: 'lastChild'
                  }
                }
                : {
                  _id: page._id,
                  title: page.title,
                  body: {
                    archived: true,
                    _targetId: '_archive',
                    _position: 'lastChild'
                  }
                }
            );
        });

        patches
          .sort((left, right) => left.body.archived && !right.body.archived
            ? 1
            : !left.body.archived && right.body.archived
              ? -1
              : 0
          );

        return patches;
      },
      async getBatchRestorePatches(req, ids) {
        const batchReq = req.clone({
          aposAncestors: true,
          aposAncestorsApiProjection: {
            _id: 1,
            title: 1,
            level: 1,
            rank: 1
          }
        });
        const pages = await self
          .find(batchReq, { _id: { $in: ids } })
          .areas(false)
          .relationships(false)
          .ancestors({
            archived: null,
            areas: false,
            relationships: false
          })
          .children({
            archived: null,
            areas: false,
            relationships: false
          })
          .archived(null)
          .toArray();

        const patches = pages.flatMap(page => {
          const childrenPatches = page._children
            .filter(child => !ids.includes(child._id))
            .map(child => {
              return {
                _id: child._id,
                title: child.title,
                body: {
                  archived: true,
                  _targetId: '_archive',
                  _position: 'lastChild'
                }
              };
            });

          const ancestors = page._ancestors.slice().reverse();
          const ancestorId = ancestors.find(ancestor => ids.includes(ancestor._id))?._id || '_home';

          return childrenPatches
            .concat(
              {
                _id: page._id,
                title: page.title,
                body: {
                  archived: false,
                  _targetId: ancestorId,
                  _position: ancestorId === '_home' ? 'firstChild' : 'lastChild'
                }
              }
            );
        });

        patches
          .sort((left, right) => left.body.archived && !right.body.archived
            ? -1
            : !left.body.archived && right.body.archived
              ? 1
              : 0
          );

        return patches;
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
      },
      reattach: {
        usage: 'Usage: node app @apostrophecms/page:reattach _id-or-slug',
        task: self.reattachTask
      }
    };
  }
};
