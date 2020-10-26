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
    contextMenu: [
      {
        action: 'insert-page',
        label: 'New Page'
      },
      {
        action: 'copy-page',
        label: 'Copy Page'
      },
      {
        action: 'update-page',
        label: 'Page Settings'
      },
      {
        action: 'versions-page',
        label: 'Page Versions'
      },
      {
        action: 'trash-page',
        label: 'Move to Trash'
      },
      {
        action: 'reorganize-page',
        label: 'Reorganize'
      }
    ],
    publishMenu: [ {
      action: 'publish-page',
      label: 'Publish Page'
    } ]
  },
  batchOperations: {
    add: {
      trash: {
        label: 'Trash'
      },
      publish: {
        label: 'Publish'
      },
      unpublish: {
        label: 'Unpublish'
      }
    }
  },
  async init(self, options) {
    self.typeChoices = options.types || [];
    self.parked = (self.options.minimumPark || [ {
      slug: '/',
      parkedId: 'home',
      _defaults: {
        title: 'Home',
        type: '@apostrophecms/home-page'
      },
      _children: [ {
        slug: '/trash',
        parkedId: 'trash',
        type: '@apostrophecms/trash',
        trash: true,
        orphan: true,
        _defaults: { title: 'Trash' }
      } ]
    } ]).concat(self.options.park || []);
    self.apos.task.add('@apostrophecms/page', 'unpark', 'Usage: node app @apostrophecms/page:unpark /page/slug\n\n' + 'This unparks a page that was formerly locked in a specific\n' + 'position in the page tree.', async function (apos, argv) {
      // Wrapping a method makes it easy to override
      // that method
      return self.unparkTask();
    });
    self.validateTypeChoices();
    self.finalizeControls();
    self.addManagerModal();
    self.addEditorModal();
    self.enableBrowserData();
    await self.createIndexes();
  },
  restApiRoutes(self, options) {
    return {
      // Trees are arranged in a tree, not a list. So this API returns the home page,
      // with _children populated if ?_children=1 is in the query string. An admin can
      // also get a light version of the entire tree with ?all=1, for use in a
      // drag-and-drop UI.
      async getAll(req) {
        self.publicApiCheck(req);
        const all = self.apos.launder.boolean(req.query.all);
        const flat = self.apos.launder.boolean(req.query.flat);
        if (all) {
          if (!self.apos.permission.can(req, 'edit', '@apostrophecms/page')) {
            throw self.apos.error('forbidden');
          }
          const page = await self.getRestQuery(req).and({ level: 0 }).children({
            depth: 1000,
            trash: false,
            orphan: null,
            relationships: false,
            areas: false,
            permission: false
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
            return result;
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
                newNodes.push(_.pick(node,
                  'title', 'slug', 'path', '_id', 'type', 'metaType', '_url',
                  '_children', 'parked'
                ));
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
      // `_home` or `_trash`
      async getOne(req, _id) {
        self.publicApiCheck(req);
        const criteria = (_id === '_home') ? {
          level: 0
        } : (_id === '_trash') ? {
          level: 1,
          trash: true
        } : {
          _id
        };
        const result = await self.getRestQuery(req).and(criteria).toObject();
        if (!result) {
          throw self.apos.error('notfound');
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

        const {
          targetId,
          position
        } = await self.getTargetIdAndPosition(req, null, req.body._targetId, req.body._position);

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
            .permission('edit-@apostrophecms/page').toObject();
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
          return self.findOneForEditing(req, { _id: page._id }, null, { annotate: true });
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
      async put(req, _id) {
        self.publicApiCheck(req);
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
          await manager.convert(req, input, page);
          await self.update(req, page);
          if (input._targetId) {
            const {
              targetId,
              position
            } = await self.getTargetIdAndPosition(req, page._id, input._targetId, input._position);

            await self.move(req, page._id, targetId, position);
          }
          return self.findOneForEditing(req, { _id: page._id }, null, { annotate: true });
        });
      },
      // Unimplemented; throws a 501 status code. This would truly and permanently remove the thing, per the REST spec.
      // To manipulate apostrophe's trash status for something, use a `PATCH` call to modify the `trash` property and set
      // it to `true` or `false`. TODO: robust DELETE support as part of a recycle-bin-emptying UI with a big fat
      // confirmation on it. Future implementation must also consider whether attachments have zero remaining references not
      // fully deleted, which isn't the same as having references still in the trash.
      async delete(req, _id) {
        self.publicApiCheck(req);
        throw self.apos.error('unimplemented');
      },
      // Patch some properties of the page.
      //
      // You may pass `_targetId` and `_position` to move the page within the tree. `_position`
      // may be `before`, `after` or `inside`. To move a page into or out of the trash, set
      // `trash` to `true` or `false`.
      patch(req, _id) {
        self.publicApiCheck(req);
        return self.patch(req, _id);
      }
    };
  },
  handlers(self, options) {
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
          const builders = self.getServePageBuilders().ancestors || { children: !(self.options.home && self.options.home.children === false) };
          const query = self.find(req, { level: 0 }).ancestorPerformanceRestrictions();
          _.each(builders, function (val, key) {
            query[key](val);
          });
          req.data.home = await query.toObject();
        }
      },
      'apostrophe:modulesReady': {
        async manageOrphans() {
          const managed = self.apos.doc.getManaged();
          const types = (self.options.typeChoices || []).map(type => type.name);
          for (const type of types) {
            if (!_.includes(managed, type)) {
              throw new Error(`The typeChoices option of the @apostrophecms/page module contains type
${type} but there is no module that manages that type. You must
implement a module of that name that extends @apostrophecms/piece-type
or @apostrophecms/page-type, or remove the entry from typeChoices.`);
            }
          }
          const parkedTypes = self.getParkedTypes();
          for (const type of parkedTypes) {
            if (!_.includes(managed, type)) {
              throw new Error(`The park option of the @apostrophecms/page module contains type
${type} but there is no module that manages that type. You must
implement a module of that name that extends @apostrophecms/piece-type
or @apostrophecms/page-type, or remove the entry from park.`);
            }
          }
          const distinct = await self.apos.doc.db.distinct('type');
          for (const type of distinct) {
            if (!_.includes(managed, type)) {
              throw new Error(`The aposDocs mongodb collection contains docs with the type ${type || 'undefined or null'}
but there is no module that manages that type. You must implement
a module of that name that extends @apostrophecms/piece-type or
@apostrophecms/page-type, or remove these documents from the
database.`);
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
  methods(self, options) {
    return {
      find(req, criteria = {}, options = {}) {
        return self.apos.modules['@apostrophecms/any-page-type'].find(req, criteria, options);
      },
      // Implementation of the PATCH route. Factored as a method to allow
      // it to be called from the universal @apostrophecms/doc PATCH route
      // as well.
      async patch(req, _id) {
        // TODO watch out for _targetId and _position and trash and their implications
        return self.withLock(req, async () => {
          const page = await self.findOneForEditing(req, { _id });
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
          self.apos.schema.implementPatchOperators(input, page);
          const parentPage = page._ancestors.length && page._ancestors[page._ancestors.length - 1];
          const schema = self.apos.schema.subsetSchemaForPatch(self.allowedSchema(req, {
            ...page,
            type: manager.name
          }, parentPage), input);
          await self.apos.schema.convert(req, schema, input, page);
          await self.emit('afterConvert', req, input, page);
          await self.update(req, page);

          if (input._targetId) {
            const {
              targetId,
              position
            } = await self.getTargetIdAndPosition(req, page._id, input._targetId, input._position);

            await self.move(req, page._id, targetId, position);
          }
          return self.findOneForEditing(req, { _id: page._id }, null, { annotate: true });
        });
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
        return browserOptions;
      },
      // Returns a cursor that finds pages the current user can edit
      // in a batch operation.
      //
      // `req` determines what the user is eligible to edit, `criteria`
      // is the MongoDB criteria object, and any properties of `options`
      // are invoked as methods on the query with their values.
      findForBatch(req, criteria = {}, options = {}) {
        const cursor = self.find(req, criteria, options).permission('edit').trash(null);
        return cursor;
      },
      // Insert a page. `targetId` must be an existing page id, and
      // `position` may be `before`, `inside` or `after`.
      //
      // The `options` argument may be omitted completely. If
      // `options.permissions` is set to false, permissions checks
      // are bypassed.
      //
      // Returns the new page.
      async insert(req, targetId, position, page, options = { permissions: true }) {
        return self.withLock(req, async () => {
          let peers;
          const query = self.findForEditing(req, { _id: targetId });
          if ((position === 'firstChild') || (position === 'lastChild')) {
            query.children({
              depth: 1,
              trash: null,
              areas: false,
              permission: false
            });
          }
          const target = await query.toObject();
          if (!target) {
            throw self.apos.error('notfound');
          }
          let parent;
          if ((position === 'before') || (position === 'after')) {
            parent = await self.findForEditing(req, {
              path: self.getParentPath(target)
            }).children({
              depth: 1,
              trash: null,
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
          page._id = self.apos.util.generateId();
          page.path = self.apos.util.addSlashIfNeeded(parent.path) + page._id;
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
        const page = self.apos.doc.getManager(pageType).newInstance();
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
      // position can be 'before', 'after', `firstChild` or `lastChild` and
      // determines the moved page's new relationship to
      // the target page.
      //
      // As a shorthand, `targetId` may be `_trash` to refer to the trash can,
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
        if (!options) {
          options = {};
        } else {
          options = _.clone(options);
        }
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
          await self.emit('beforeMove', req, moved, target, position, options);
          determineRankAndNewParent();
          if (!moved._edit) {
            throw self.apos.error('forbidden');
          }
          if (!(parent && oldParent)) {
            // Move outside tree
            throw self.apos.error('forbidden');
          }
          if ((oldParent._id !== parent._id) && (parent.type !== '@apostrophecms/trash') && (!parent._edit)) {
            throw self.apos.error('forbidden');
          }
          await nudgeNewPeers();
          await moveSelf();
          await updateDescendants();
          await trashDescendants();
          await self.emit('afterMove', req, moved, {
            originalSlug,
            originalPath,
            changed,
            target,
            position,
            options
          });
          return {
            changed,
            options
          };
          async function getMoved() {
            const moved = await self.find(req, { _id: movedId }).permission(false).trash(null).areas(false).ancestors({
              depth: 1,
              trash: null,
              areas: false,
              permission: false
            }).applyBuilders(options.builders || {}).toObject();
            if (!moved) {
              throw new Error('no such page');
            }
            if (!moved.level) {
              throw new Error('cannot move root');
            }
            if (moved.parked) {
              throw new Error('cannot move parked page via move() API, see park() API');
            }
            // You can't move the trashcan itself
            if (moved.type === '@apostrophecms/trash') {
              throw new Error('cannot move trashcan');
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
              if (moved.parked) {
                // Reserved range
                throw new Error('cannot move a page after a parked page');
              }
              rank = target.rank + 1;
            } else if (position === 'lastChild') {
              parent = target;
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
            // in the trash, update the slug as well as the path
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
              } else if (parent.trash && !moved.trash) {
                // #385: we don't follow the pattern of our old parent but we're
                // moving to the trash, so the slug must change to avoid blocking
                // reuse of the old URL by a new page
                moved.slug = parent.slug + '/' + path.basename(moved.slug);
              }
            }
            moved.level = level;
            moved.rank = rank;
            // Are we in the trashcan? Our new parent reveals that
            if (parent.trash) {
              moved.trash = true;
            } else {
              delete moved.trash;
            }
            await self.update(req, moved);
          }
          async function updateDescendants() {
            changed = changed.concat(await self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug));
          }
          async function trashDescendants() {
            // Make sure our descendants have the same trash status
            const matchParentPathPrefix = self.matchDescendants(moved);
            const $set = {};
            const $unset = {};
            if (moved.trash) {
              $set.trash = true;
            } else {
              $unset.trash = true;
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
      // value. `position` is used to prevent attempts to move after the trash
      // "page."
      async getTarget(req, targetId, position) {
        const criteria = (targetId === '_home') ? {
          level: 0
        } : (targetId === '_trash') ? {
          level: 1,
          trash: true
        } : {
          _id: targetId
        };
        const target = await self.find(req, criteria).permission(false).trash(null).areas(false).ancestors(_.assign({
          depth: 1,
          trash: null,
          areas: false,
          permission: false
        }, options.builders || {})).children({
          depth: 1,
          trash: null,
          areas: false,
          permission: false
        }).applyBuilders(options.builders || {}).toObject();
        if (!target) {
          throw self.apos.error('notfound');
        }
        if (target.type === '@apostrophecms/trash' && target.level === 1 && position === 'after') {
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
        // moved pages's parent.
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
      // `options` is the same options object that was passed to `self.move`, or an empty object
      // if none was passed.
      //
      // This method is async because overrides, for instance in @apostrophecms/workflow,
      // may require asynchronous work to perform it.
      async movePermissions(req, moved, data, options) {
      },
      async deduplicatePages(req, pages, toTrash) {
        for (const page of pages) {
          const match = self.matchDescendants(page);
          await deduplicate(page);
          await propagate(page, match);
        }
        async function deduplicate(page) {
          if (toTrash) {
            return self.apos.doc.getManager(page.type).deduplicateTrash(req, page);
          } else {
            return self.apos.doc.getManager(page.type).deduplicateRescue(req, page);
          }
        }
        async function propagate(page, match) {
          const oldPath = page.path;
          const oldSlug = page.slug;
          // This operation can change paths and slugs of pages, those changes need
          // rippling to their descendants
          const descendants = _.filter(pages, function (descendant) {
            return descendant.path.match(match);
          });
          for (const descendant of descendants) {
            descendant.path = descendant.path.replace(new RegExp('^' + self.apos.util.regExpQuote(oldPath)), page.path);
            descendant.slug = descendant.slug.replace(new RegExp('^' + self.apos.util.regExpQuote(oldSlug)), page.slug);
            try {
              return await self.apos.doc.db.updateOne({ _id: descendant._id }, {
                $set: {
                  path: descendant.path,
                  slug: descendant.slug
                }
              });
            } catch (err) {
              if (self.apos.doc.isUniqueError(err)) {
                // The slug is now in conflict for this subpage.
                // Try again with path only
                return self.apos.doc.db.updateOne({ _id: descendant._id }, { $set: { path: descendant.path } });
              }
              throw err;
            }
          }
        }
      },
      // Returns `{ parentSlug: '/foo', changed: [ ... ] }` where `parentSlug` is the
      // slug of the page's former parent, and `changed` is an array
      // of objects with _id and slug properties, including all subpages that
      // had to move too.
      async moveToTrash(req, _id) {
        const trash = await findTrash();
        if (!trash) {
          throw new Error('Site has no trashcan, contact administrator');
        }
        const page = await findPage();
        if (!page) {
          throw self.apos.error('notfound');
        }
        const parent = page._ancestors[0];
        if (!parent) {
          throw self.apos.error('invalid', 'Cannot move the home page to the trash');
        }
        const changed = await movePage();
        return {
          parentSlug: parent && parent.slug,
          changed
        };
        async function findTrash() {
          // Always only one trash page at level 1, so we don't have
          // to hardcode the slug
          return self.find(req, {
            trash: true,
            level: 1
          }).permission(false).trash(null).areas(false).toObject();
        }
        async function findPage() {
          // Also checks permissions
          return self.find(req, { _id: _id }).permission('edit').ancestors({
            depth: 1,
            trash: null,
            areas: false
          }).toObject();
        }
        async function movePage() {
          return self.move(req, page._id, trash._id, 'firstChild');
        }
      },
      // Update a page. The `options` argument may be omitted entirely.
      // if it is present and `options.permissions` is set to `false`,
      // permissions are not checked.
      async update(req, page, options) {
        if (page.level === 0) {
          // You cannot move the home page to the trash
          page.trash = false;
        }
        if (!options) {
          options = {};
        }
        await self.emit('beforeUpdate', req, page, options);
        await self.emit('beforeSave', req, page, options);
        await self.apos.doc.update(req, page, options);
        return page;
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
          page: providePage ? req.data.bestPage : null,
          contextMenu: req.contextMenu,
          publishMenu: req.publishMenu
        };
        if (args.page && args.edit) {
          if (!args.contextMenu) {
            // Standard context menu for a regular page
            args.contextMenu = self.options.contextMenu;
          }
          if (!args.publishMenu) {
            // Standard publish menu for a regular page
            args.publishMenu = self.options.publishMenu;
          }
        }
        if (args.page) {
          if (args.page.level === 0) {
            // Snip out copy page if we are on the homepage
            args.contextMenu = _.filter(args.contextMenu, function (item) {
              return item.action !== 'copy-page';
            });
          }
          if (!self.allowedChildTypes(args.page).length) {
            // Snip out add page if no
            // child page types are allowed
            args.contextMenu = _.filter(args.contextMenu, function (item) {
              return item.action !== 'insert-page';
            });
          }
        }
        if (args.contextMenu) {
          // Allow context menu items to require a particular permission
          args.contextMenu = _.filter(args.contextMenu, function (item) {
            if (!item.permission) {
              return true;
            }
            if (self.apos.permission.can(req, item.permission.action, item.permission.type)) {
              return true;
            }
          });
        }
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
        const params = self.getPathIndexParams();
        await self.apos.doc.db.createIndex(params, {
          unique: true,
          sparse: true
        });
      },
      getPathIndexParams() {
        return { path: 1 };
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
        page = _.pick(page, 'title', 'slug', '_id', 'type', 'ancestors', '_url');
        // Limit information about ancestors to avoid
        // excessive amounts of data in the page
        page.ancestors = _.map(page.ancestors, function (ancestor) {
          return _.pick(ancestor, [
            'title',
            'slug',
            '_id',
            'type',
            '_url'
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
          if (page.trash && !desc.trash) {
            // #385: we are moving this to the trash, force a new slug
            // even if it was formerly a customized one. Otherwise it is
            // difficult to free up custom slugs by trashing pages
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
            _item._id = self.apos.util.generateId();
            _item.path = _item._id;
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
      async unparkTask() {
        if (self.apos.argv._.length !== 2) {
          throw new Error('Wrong number of arguments');
        }
        const slug = self.apos.argv._[1];
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
        fields.push('path', 'trash', 'rank', 'level');
      },
      // Returns true if the doc is a page in the tree
      // (it has a slug with a leading /).
      isPage(doc) {
        // Proper docs always have a slug, but some of our unit tests are lazy about this.
        return doc.slug && doc.slug.match(/^\//);
      },
      // Returns a regular expression to match the `path` property of the descendants of the given page,
      // but not itself
      matchDescendants(page) {
        // Make sure there is a trailing slash, but don't add two (the home page already has one).
        // Also make sure there is at least one additional character, which there always will be,
        // in order to prevent the home page from matching as its own descendant
        return new RegExp(`^${self.apos.util.regExpQuote(page.path)}/.`);
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
        const fields = [
          '_viewUsers',
          '_viewGroups',
          '_editUsers',
          '_editGroups'
        ];
        // Do only as much cloning as we have to to avoid modifying the original
        schema = _.clone(schema);
        const index = _.findIndex(schema, { name: 'loginRequired' });
        if (index !== -1) {
          schema.splice(index + 1, 0, {
            type: 'boolean',
            name: 'applyLoginRequiredToSubpages',
            label: 'Apply to Subpages',
            group: schema[index].group
          });
        }
        _.each(fields, function (name) {
          const index = _.findIndex(schema, { name: name });
          if (index === -1) {
            return;
          }
          const field = _.clone(schema[index]);
          const base = name.replace(/^_/, '');
          field.removedIdsField = base + 'RemovedIds';
          field.fieldsStorage = base + 'Fields';
          field.schema = [ {
            name: 'applyToSubpages',
            type: 'boolean',
            label: 'Apply to Subpages',
            inline: true
          } ];
          schema[index] = field;
        });
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
      validateTypeChoices() {
        _.each(self.typeChoices, function (choice) {
          if (!choice.name) {
            throw new Error('One of the page types specified for your \'types\' option has no \'name\' property.');
          }
          if (!choice.label) {
            throw new Error('One of the page types specified for your \'types\' option has no \'label\' property.');
          }
        });
      },
      finalizeControls() {
        self.createControls = self.options.createControls || [
          {
            type: 'minor',
            action: 'cancel',
            label: 'Cancel'
          },
          {
            type: 'major',
            action: 'save',
            label: 'Save'
          }
        ];
        self.editControls = self.options.editControls || [
          {
            type: 'minor',
            action: 'cancel',
            label: 'Cancel'
          },
          {
            type: 'major',
            action: 'save',
            label: 'Save'
          }
        ];
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
      getCreateControls(req) {
        const controls = _.cloneDeep(self.createControls);
        return controls;
      },
      getEditControls(req) {
        const controls = _.cloneDeep(self.editControls);
        return controls;
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
      // Returns a cursor that finds pages the current user can edit. Unlike
      // find(), this cursor defaults to including docs in the trash, although
      // we apply filters in the UI.
      findForEditing(req, criteria, projection, options) {
        // Include ancestors to help with determining allowed types
        const cursor = self.find(req, criteria).permission('edit').trash(null).ancestors(true);
        if (projection) {
          cursor.project(projection);
        }
        return cursor;
      },
      async findOneForEditing(req, criteria, projection, options) {
        return self.findForEditing(req, criteria, projection, options).toObject();
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
      }
    };
  },
  helpers(self, options) {
    return {
      isAncestorOf: function (possibleAncestorPage, ofPage) {
        return self.isAncestorOf(possibleAncestorPage, ofPage);
      }
    };
  }
};
