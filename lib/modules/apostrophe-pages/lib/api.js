const path = require('path');
const _ = require('lodash');

module.exports = function(self, options) {

  // Obtain a cursor for finding pages. Adds filters useful for
  // including ancestors, descendants, etc.

  self.find = function(req, criteria, projection) {
    return self.apos.createSync(self.__meta.name + '-cursor', {
      apos: self.apos,
      req: req,
      criteria: criteria,
      projection: projection
    });
  };

  // Returns a cursor that finds pages the current user can edit
  // in a batch operation, including unpublished and trashed pages.
  self.findForBatch = function(req, criteria, projection) {
    let cursor = self.find(req, criteria, projection)
      .permission('edit')
      .published(null)
      .trash(null);
    return cursor;
  };

  // Insert a page as a child of the specified page or page ID.
  //
  // The `options` argument may be omitted completely. If
  // `options.permissions` is set to false, permissions checks
  // are bypassed.
  //
  // Returns the page.

  self.insert = async function(req, parentOrId, page, options) {

    if (!options) {
      options = {};
    }
    return self.withLock(req, body);
    async function body() {
      let parent;
      if (typeof (parentOrId) === 'object') {
        parent = parentOrId;
      } else {
        const cursor = self.find(req, { _id: parentOrId }).published(null).areas(false);
        if (options.permissions === false) {
          cursor.permission(false);
        }
        parent = await cursor.toObject();
        if (!parent) {
          throw new Error('parent not found');
        }
      }
      if (options.permissions !== false) {
        if (!parent._edit) {
          throw new Error('cannot publish parent');
        }
      }
      const results = await self.apos.docs.db.find({
        path: self.matchDescendants(parent),
        level: parent.level + 1
      }).project({
        rank: 1
      })
        .sort({ rank: -1 })
        .limit(1)
        .toArray();
      if (!results.length) {
        page.rank = 0;
      } else {
        page.rank = results[0].rank + 1;
      }

      await self.emit('beforeInsert', page, options);
      await self.emit('beforeSave', page, options);
      const slugBasename = require('path').basename(self.apos.utils.slugify(page.slug));
      let pathFrom;
      if (slugBasename.length && (slugBasename !== 'none')) {
        pathFrom = slugBasename;
      } else {
        pathFrom = self.apos.utils.slugify(page.title);
      }
      page.path = addSlashIfNeeded(parent.path) + pathFrom;
      page.level = parent.level + 1;

      await self.apos.docs.insert(req, page, options);
      return page;
    }
  };

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

  self.withLock = async function(req, fn) {
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
  };

  // Lock the page tree.
  //
  // The lock must be released by calling the `unlock` method.
  // It is usually best to use the `withLock` method instead, to
  // invoke a function of your own while the lock is in your
  // possession, so you don't have to keep track of it.
  //
  // Nested locks are permitted for the same `req`.

  self.lock = async function(req) {
    if (req.aposPageTreeLockDepth) {
      req.aposPageTreeLockDepth++;
      return;
    }
    await self.apos.locks.lock('apostrophe-pages:tree');
    req.aposPageTreeLockDepth = 1;
  };

  // Release a page tree lock obtained with the `lock` method.
  // Note that it is safest to use the `withLock` method to avoid
  // the bookkeeping of calling either `lock` or `unlock` yourself.

  self.unlock = async function(req) {
    if (!req.aposPageTreeLockDepth) {
      throw new Error('Looks like you called apos.pages.unlock without ever calling apos.pages.lock, or you have more unlock calls than lock calls');
    }
    req.aposPageTreeLockDepth--;
    if (req.aposPageTreeLockDepth) {
      return;
    }
    await self.apos.locks.unlock('apostrophe-pages:tree');
  };

  // This method pushes a page's permissions to its subpages selectively based on
  // whether the applyToSubpages choice was selected for each one. It also copies
  // the `loginRequired` property to subpages if the `applyLoginRequiredToSubpages`
  // choice was selected.
  //
  // Both additions and deletions from the permissions list can be propagated
  // in this way.
  //
  // This requires some tricky mongo work to do it efficiently, especially since we
  // need to update both the join ids and the denormalized docPermissions array.
  //
  // The applyToSubpages choice is actually a one-time action, not a permanently
  // remembered setting, so the setting itself is cleared afterwards by this
  // method.
  //
  // This method is called for us by the apostrophe-docs module on update
  // operations, so we first make sure it's a page. We also make sure it's
  // not a new page (no kids to propagate anything to).

  self.docAfterDenormalizePermissions = async function(req, page, options) {

    if (!self.isPage(page)) {
      return;
    }
    if (!page._id) {
      return;
    }

    const admin = req.user && req.user._permissions.admin;

    const allowed = [ 'view' ];
    if (admin) {
      allowed.push('edit');
    }

    const propagateAdd = {};
    const propagatePull = {};
    const propagateSet = {};
    const loginRequired = page.loginRequired;

    if (page.applyLoginRequiredToSubpages) {
      propagateSet.loginRequired = loginRequired;
      // It's a one-time action, don't remember it
      page.applyLoginRequiredToSubpages = false;
    }

    allowed.forEach(prefix => {
      const fields = [ prefix + 'GroupsIds', prefix + 'UsersIds' ];
      const removedFields = fields.map(field => {
        return field.replace(/Ids$/, 'RemovedIds');
      });
      fields.forEach(field => {
        (page[field] || []).forEach(id => {
          const relationshipField = field.replace('Ids', 'Relationships');
          const relationships = page[relationshipField];
          const relationship = (relationships && relationships[id]) || {};
          const propagate = relationship.applyToSubpages;
          if (propagate) {
            append(propagateAdd, 'docPermissions', prefix + '-' + id);
            append(propagateAdd, field, id);
            // This is not a persistent setting, it's a one-time indicator that
            // we should propagate now
            propagateSet[relationshipField + '.' + id + '.applyToSubpages'] = false;
          }
          relationship.applyToSubpages = false;
        });
      });
      removedFields.forEach(field => {
        (page[field] || []).forEach(id => {
          const relationshipField = field.replace('RemovedIds', 'Relationships');
          const relationships = page[relationshipField];
          const relationship = (relationships && relationships[id]) || {};
          const propagate = relationship.applyToSubpages;
          if (propagate) {
            append(propagatePull, 'docPermissions', prefix + '-' + id);
            append(propagatePull, field.replace('Removed', ''), id);
          }
          // This is a one-time operation each time it's chosen, so don't remember it
          relationship.applyToSubpages = false;
        });
      });
    });

    if ((!_.isEmpty(propagatePull)) || (!_.isEmpty(propagateAdd)) || (!_.isEmpty(propagateSet))) {
      const commands = [];
      // Use separate commands because MongoDB is increasingly intolerant
      // of using these operators in the same update call
      if (!_.isEmpty(propagatePull)) {
        commands.push({ $pull: operate(propagatePull, '$in') });
      }
      if (!_.isEmpty(propagateAdd)) {
        commands.push({ $addToSet: operate(propagateAdd, '$each') });
      }
      if (!_.isEmpty(propagateSet)) {
        commands.push({ $set: propagateSet });
      }
      // Oh brother, must do it in two passes
      // https://jira.mongodb.org/browse/SERVER-1050
      const criteria = {
        $and: [
          {
            path: self.matchDescendants(page)
          },
          self.apos.permissions.criteria(req, 'edit-' + page.type)
        ]
      };
      for (const command of commands) {
        await self.apos.docs.db.updateMany(criteria, command);
      }
    }

    function append(container, key, value) {
      if (!_.has(container, key)) {
        container[key] = [];
      }
      container[key].push(value);
    }
    function operate(container, operator) {
      const criterion = {};
      _.each(container, function(val, key) {
        criterion[key] = {};
        criterion[key][operator] = val;
      });
      return criterion;
    }
  };

  // This method creates a new object suitable to be inserted
  // as a child of the specified parent via insert(). It DOES NOT
  // insert it at this time. If the parent page is locked down
  // such that no child page types are permitted, this method
  // returns null. The permissions of the new child page match
  // the permissions of the parent.

  self.newChild = function(parentPage) {
    const pageType = self.allowedChildTypes(parentPage)[0];
    if (!pageType) {
      self.apos.utils.warn('No allowed Page types are specified.');
      return null;
    }
    const page = self.apos.docs.getManager(pageType).newInstance();
    _.extend(page, {
      title: 'New Page',
      slug: self.apos.utils.addSlashIfNeeded(parentPage.slug) + 'new-page',
      type: pageType,
      published: parentPage.published
    });
    // Inherit permissions from parent page
    _.assign(page,
      _.pick(parentPage,
        'loginRequired',
        'applyLoginRequiredToSubpages',
        'viewUsersIds', 'viewUsersRelationships',
        'viewGroupsIds', 'viewGroupsRelationships',
        'editUsersIds', 'editUsersRelationships',
        'editGroupsIds', 'editGroupsRelationships',
        'docPermissions'
      )
    );
    if (!page.published) {
      page.published = false;
    }
    return page;
  };

  self.allowedChildTypes = function(page) {
    if ((!page) && (self.options.allowedHomepageTypes)) {
      return self.options.allowedHomepageTypes;
    } else if (page && self.options.allowedSubpageTypes) {
      if (self.options.allowedSubpageTypes[page.type]) {
        return self.options.allowedSubpageTypes[page.type];
      }
    }
    // Default is to allow any type in the configured list
    return _.map(self.typeChoices, 'name');
  };

  // Move a page already in the page tree to another location.
  //
  // position can be 'before', 'after' or 'inside' and
  // determines the moved page's new relationship to
  // the target page.
  //
  // Returns an object with a `modified` property, containing an
  // array of objects with _id and slug properties, indicating the new slugs of all
  // modified pages. If `options` is passed to this method, it is
  // also supplied as the `options` property of the returned object.
  //
  // *Less commonly used features*
  //
  // These are mainly for use by modules that extend Apostrophe's model layer,
  // such as `apostrophe-workflow`.
  //
  // The `options` argument may be omitted entirely.
  //
  // If `options.criteria` is present, it is merged with
  // all MongoDB criteria used to read and write the database in `self.move`.
  // If `options.filters` is present, those filters are invoked
  // on any Apostrophe cursor find() calls used to read and write the database in `self.move`.
  //
  // `options` is also passed back to the `movePermissions` method,
  // and passed as the `options` property of the `info` parameter of `afterMove`.
  //
  // After the moved and target pages are fetched, the `beforeMove` method is invoked with
  // `req, moved, target, position, options`.
  //
  // `beforeMove` may safely modify top-level properties of `options` without an impact
  // beyond the exit of the current `self.move` call. If modifying deeper properties, clone them.

  self.move = async function(req, movedId, targetId, position, options) {

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
      const target = await getTarget();
      await self.emit('beforeMove', req, moved, target, position, options);
      determineRankAndNewParent();
      await self.movePermissions(req, moved, {
        oldParent: oldParent,
        parent: parent
      }, options);
      await nudgeNewPeers();
      await moveSelf();
      await updateDescendants();
      await trashDescendants();

      await self.emit('afterMove',
        req,
        moved,
        {
          originalSlug,
          originalPath,
          changed,
          target,
          position,
          options
        }
      );

      return {
        changed,
        options
      };

      async function getMoved() {
        const moved = await self.find(req, mergeCriteria({ _id: movedId }))
          .permission(false)
          .trash(null)
          .published(null)
          .areas(false)
          .ancestors(_.assign({ depth: 1, trash: null, published: null, areas: false, permission: false }, options.filters || {}))
          .applyFilters(options.filters || {})
          .toObject();
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
        if (moved.type === 'trash') {
          throw new Error('cannot move trashcan');
        }
        return moved;
      }

      async function getTarget() {
        const target = await self.find(req, mergeCriteria({ _id: targetId }))
          .permission(false)
          .trash(null)
          .published(null)
          .areas(false)
          .ancestors(_.assign({ depth: 1, trash: null, published: null, areas: false, permission: false }, options.filters || {}))
          .applyFilters(options.filters || {})
          .toObject();
        if (!target) {
          throw new Error('no such page');
        }
        if ((target.type === 'trash') && (target.level === 1) && (position === 'after')) {
          throw new Error('trash must be last');
        }

        return target;
      }

      function determineRankAndNewParent() {
        if (position === 'inside') {
          parent = target;
          rank = 0;
          return;
        }
        if (position === 'before') {
          rank = target.rank;
        } else if (position === 'after') {
          if (moved.parked) {
            // Reserved range
            throw new Error('cannot move a page after a parked page');
          }
          rank = target.rank + 1;
        } else {
          throw new Error('no such position option');
        }
        parent = target._ancestors[0];
      }

      async function nudgeNewPeers() {
        // Nudge down the pages that should now follow us
        await self.apos.docs.db.updateMany(
          mergeCriteria({
            path: self.matchDescendants(parent),
            level: parent.level + 1,
            rank: {
              $gte: rank
            }
          }), {
            $inc: {
              rank: 1
            }
          }
        );
      }

      async function moveSelf() {
        originalPath = moved.path;
        originalSlug = moved.slug;
        const level = parent.level + 1;
        const newPath = addSlashIfNeeded(parent.path) + path.basename(moved.path);
        // We're going to use update with $set, but we also want to update
        // the object so that moveDescendants can see what we did
        moved.path = newPath;
        // If the old slug wasn't customized, OR our new parent is
        // in the trash, update the slug as well as the path
        if (parent._id !== oldParent._id) {
          let matchOldParentSlugPrefix = new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(oldParent.slug)));
          if (moved.slug.match(matchOldParentSlugPrefix)) {
            let slugStem = parent.slug;
            if (slugStem !== '/') {
              slugStem += '/';
            }
            moved.slug = moved.slug.replace(matchOldParentSlugPrefix, addSlashIfNeeded(parent.slug));
            changed.push({
              _id: moved._id,
              slug: moved.slug
            });
          } else if (parent.trash && (!moved.trash)) {
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
        changed = changed.concat(await self.updateDescendantsAfterMove(req, moved, originalPath, originalSlug, options));
      }

      async function trashDescendants() {
        // Make sure our descendants have the same trash status
        let matchParentPathPrefix = self.matchDescendants(moved);
        let $set = {};
        let $unset = {};
        if (moved.trash) {
          $set.trash = true;
        } else {
          $unset.trash = true;
        }
        let action = {};
        if (!_.isEmpty($set)) {
          action.$set = $set;
        }
        if (!_.isEmpty($unset)) {
          action.$unset = $unset;
        }
        if (_.isEmpty(action)) {
          return;
        }
        await self.apos.docs.db.updateMany(mergeCriteria({ path: matchParentPathPrefix }), action);
      }

      function mergeCriteria(criteria) {
        if (options.criteria) {
          criteria = { $and: [ criteria, options.criteria ] };
        }
        return criteria;
      }
    }
  };

  // Based on `req`, `moved`, `data.moved`, `data.oldParent` and `data.parent`, decide whether
  // this move should be permitted. If it should not be, throw an error.
  //
  // `options` is the same options object that was passed to `self.move`, or an empty object
  // if none was passed.
  //
  // This method is async because overrides, for instance in apostrophe-workflow,
  // may require asynchronous work to perform it.

  self.movePermissions = async function(req, moved, data, options) {
    if (!moved._edit) {
      throw 'forbidden';
    }
    if (!(data.parent && data.oldParent)) {
      // Move outside tree
      throw 'forbidden';
    }
    // You can always move a page into the trash. You can
    // also change the order of subpages if you can
    // edit the subpage you're moving. Otherwise you
    // must have edit permissions for the new parent page.
    if ((data.oldParent._id !== data.parent._id) && (data.parent.type !== 'trash') && (!data.parent._edit)) {
      throw 'forbidden';
    }
  };

  // Returns `{ parentSlug: '/foo', changed: [ ... ] }` where `parentSlug` is the
  // slug of the page's former parent, and `changed` is an array
  // of objects with _id and slug properties, including all subpages that
  // had to move too. If the `trashInSchema: true` option was
  // set for the module, `parentSlug` is still provided
  // although the parent does not change, and `changed` is
  // still provided although the slugs of the descendants
  // do not change.

  self.moveToTrash = async function(req, _id) {
    if (self.apos.docs.trashInSchema) {
      return self.trashInSchema(req, _id, true);
    } else {
      return self.moveToSharedTrash(req, _id);
    }
  };

  // "Move" a page to the trash by just setting its trash flag
  // and keeping it under the same parent. Called by `moveToTrash`
  // when the `trashInSchema` flag is in effect. The home page
  // still cannot be moved to the trash even in this mode.
  // Trashes descendant pages as well.
  //
  // For the return value see `moveToTrash`.

  self.trashInSchema = async function(req, _id, toTrash) {
    let page, parent;
    let tree = [];
    const action = toTrash ? { $set: { trash: true } } : { $unset: { trash: 1 } };

    await getPage();
    await getChildren();
    await trashOrUntrashPages();
    await dedupePages();

    return {
      parentSlug: parent && parent.slug,
      changed: tree
    };

    async function getPage() {
      // check permissions and load page to trash/untrash
      page = await self.find(req, { _id: _id }).permission('edit').trash(null).ancestors({ depth: 1, published: null, trash: null, areas: false });
      tree.push(page);
      parent = page._ancestors[0];
      if (!page) {
        throw new Error('Page not found');
      }
      if (!parent) {
        throw new Error('Cannot move the home page to or from the trash');
      }
    }

    // get all children of page
    async function getChildren() {
      const path = self.matchDescendants(page);
      const res = await self.find(req, { path: path }).sort({ path: 1 }).toArray();
      tree = tree.concat(res);
    }

    // flag pages appropriately as trash or not
    async function trashOrUntrashPages() {
      const ids = tree.map(p => p._id);
      return self.apos.docs.db.updateMany({ _id: { $in: ids } }, action);
    }

    // iterate over page tree and deduplicate requisite fields
    async function dedupePages() {
      return self.deduplicatePages(req, tree, toTrash);
    }

  };

  self.deduplicatePages = async function(req, pages, toTrash) {

    for (const page of pages) {

      const match = self.matchDescendants(page);
      await deduplicate(page);
      await propagate(page, match);

    }

    async function deduplicate(page) {
      if (toTrash) {
        return self.apos.docs.getManager(page.type).deduplicateTrash(req, page);
      } else {
        return self.apos.docs.getManager(page.type).deduplicateRescue(req, page);
      }
    }

    async function propagate(page, match) {
      const oldPath = page.path;
      const oldSlug = page.slug;
      // This operation can change paths and slugs of pages, those changes need
      // rippling to their descendants
      let descendants = _.filter(pages, function(descendant) {
        return descendant.path.match(match);
      });
      for (const descendant of descendants) {
        descendant.path = descendant.path.replace(new RegExp('^' + self.apos.utils.regExpQuote(oldPath)), page.path);
        descendant.slug = descendant.slug.replace(new RegExp('^' + self.apos.utils.regExpQuote(oldSlug)), page.slug);
        try {
          return await self.apos.docs.db.updateOne({
            _id: descendant._id
          }, {
            $set: {
              path: descendant.path,
              slug: descendant.slug
            }
          });
        } catch (err) {
          if (self.apos.docs.isUniqueError(err)) {
            // The slug is now in conflict for this subpage.
            // Try again with path only
            return self.apos.docs.db.updateOne({
              _id: descendant._id
            }, {
              $set: {
                path: descendant.path
              }
            });
          }
          throw err;
        }
      }
    }
  };

  // Rescue a page previously trashed via `trashInSchema`. This is an operation that only
  // makes sense when the `trashInSchema` option flag is set for the module.
  // Rescues descendants as well. Returns an object containing
  // `parentSlug` and `changed` properties, where:
  //
  // `parentSlug` is the slug of the parent of the page rescued, for consistency
  // with the `moveToTrash` method, although the parent does not change;
  //
  // `changed` is an array of descendant pages whose trash status also changed,
  // with `_id` and `slug` properties.

  self.rescueInTree = async function(req, _id) {
    return self.trashInSchema(req, _id, false);
  };

  // Implements `moveToTrash` when `trashInSchema` is false (the default),
  // by moving the page inside the trashcan page. See `moveToTrash`
  // for what is returned.

  self.moveToSharedTrash = async function(req, _id) {

    const trash = await findTrash();
    if (!trash) {
      throw new Error('Site has no trashcan, contact administrator');
    }
    const page = await findPage();
    const parent = page._ancestors[0];
    if (!parent) {
      throw new Error('Cannot move the home page to the trash');
    }

    const changed = await movePage();

    return {
      parentSlug: parent && parent.slug,
      changed
    };

    async function findTrash() {
      // Always only one trash page at level 1, so we don't have
      // to hardcode the slug
      return self.find(req, { trash: true, level: 1 })
        .permission(false)
        .published(null)
        .trash(null)
        .areas(false)
        .toObject();
    }

    async function findPage() {
      // Also checks permissions
      return self.find(req, { _id: _id }).permission('edit').ancestors({ depth: 1, published: null, trash: null, areas: false }).toObject();
    }

    async function movePage() {
      return self.move(req, page._id, trash._id, 'inside');
    }

  };

  // Empty the trash (destroy a page in the trash permanently).
  //
  // You must specify the _id of a single page. If it has descendants
  // they are also destroyed.
  //
  // If the page does not exist or is not in the trash an error is reported.
  //
  // returns the slug of the parent of the page.

  self.deleteFromTrash = async function(req, _id) {

    const page = await findPage();
    const parent = page._ancestors[0];
    if (!parent) {
      throw new Error('Cannot destroy the home page');
    }
    await deleteFromTrash();
    return parent && parent.slug;

    async function findPage() {
      // Also checks permissions
      return self.find(req, { _id: _id }).permission('publish').trash(true).ancestors({ depth: 1, published: null, trash: null, areas: false }).toObject();
    }

    async function deleteFromTrash() {
      await self.apos.docs.deleteFromTrash(req,
        {
          $or: [
            {
              path: self.matchDescendants(page)
            },
            {
              _id: _id
            }
          ]
        }
      );
    }
  };

  // Update a page. The `options` argument may be omitted entirely.
  // if it is present and `options.permissions` is set to `false`,
  // permissions are not checked.

  self.update = async function(req, page, options) {
    if (page.level === 0) {
      // You cannot move the home page to the trash
      page.trash = false;
    }
    if (!options) {
      options = {};
    }
    await self.emit('beforeUpdate', req, page, options);
    await self.emit('beforeSave', req, page, options);
    await self.apos.docs.update(req, page, options);
    return page;
  };

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

  self.park = function(pageOrPages) {
    let pages;
    pages = Array.isArray(pageOrPages) ? pageOrPages : [ pageOrPages ];
    self.parked = self.parked.concat(pages);
  };

  // Route that serves pages. See afterInit in
  // index.js for the wildcard argument and the app.get call

  self.serve = async function(req, res) {
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
  };

  // Sets `req.data.bestPage` to the page whose slug is the longest
  // path prefix of `req.params[0]` (the page slug); an exact match
  // of course wins, followed by the parent "folder," and so on up to the
  // home page.

  self.serveGetPage = async function(req) {
    req.slug = req.params[0];

    // Fix common screwups in URLs: leading/trailing whitespace,
    // presence of trailing slashes (but always restore the
    // leading slash). Express leaves escape codes uninterpreted
    // in the path, so look for %20, not ' '.
    req.slug = req.slug.trim();

    req.slug = self.removeTrailingSlugSlashes(req, req.slug);

    if ((!req.slug.length) || (req.slug.charAt(0) !== '/')) {
      req.slug = '/' + req.slug;
    }

    // Had to change the URL, so redirect to it. TODO: this
    // contains an assumption that we are mounted at /
    if (req.slug !== req.params[0]) {
      return req.res.redirect(req.slug);
    }

    const filters = self.getServePageFilters();

    const cursor = self.find(req);

    _.each(filters, function(val, key) {
      cursor[key](val);
    });

    self.matchPageAndPrefixes(cursor, req.slug);

    await self.emit('serveCursor', cursor);
    req.data.bestPage = await cursor.toObject();
    self.evaluatePageMatch(req);
  };

  // Remove trailing slashes from a slug. This is factored out
  // so that it can be overridden, for instance by the
  // apostrophe-workflow module.

  self.removeTrailingSlugSlashes = function(req, slug) {
    if (!slug) {
      // For bc, support one argument
      slug = req;
    }
    return slug.replace(/\/+$/, '');
  };

  // If the page will 404 according to the `isFound` method, this
  // method will emit a `notFound` event giving all modules a chance
  // to intercept the request. If none intercept it, the standard 404 behavior
  // is set up.

  self.serveNotFound = async function(req) {
    if (self.isFound(req)) {
      return;
    }
    // Give all modules a chance to save the day
    await self.emit('notFound', req);
    // Are we happy now?
    if (self.isFound(req)) {
      return;
    }
    const q = self.apos.utils.slugify(req.url, { separator: ' ' });
    req.data.suggestedSearch = q;
    req.notFound = true;
    req.res.statusCode = 404;
    req.template = 'notFound';
  };

  self.serveDeliver = async function(req, err) {

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
      if (req.statusCode && _.includes([ 301, 302, 303, 307, 308 ], req.statusCode)) {
        status = req.statusCode;
      }
      return req.res.redirect(status, req.redirect);
    }

    // Handle 500 errors

    if (err) {
      self.apos.utils.error(err);
      req.template = self.apos.templates.renderer('templateError');
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
      req.template = 'loginRequired';
      providePage = false;
    } else if (req.insufficient) {
      req.template = 'insufficient';
      providePage = false;
    }

    if (!req.template) {
      if (req.data.page) {
        // Fallback behavior is to
        // serve page templates out of
        // apostrophe-pages/views/pages
        req.template = 'pages/' + req.data.page.type;
      }
    }

    let args = {
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
        args.contextMenu = _.filter(args.contextMenu, function(item) {
          return item.action !== 'copy-page';
        });
      }
      if (!self.allowedChildTypes(args.page).length) {
        // Snip out add page if no
        // child page types are allowed
        args.contextMenu = _.filter(args.contextMenu, function(item) {
          return item.action !== 'insert-page';
        });
      }
    }

    if (args.contextMenu) {
      // Allow context menu items to require a particular permission
      args.contextMenu = _.filter(args.contextMenu, function(item) {
        if (!item.permission) {
          return true;
        }
        if (self.apos.permissions.can(req, item.permission)) {
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

    if ((req.query.pageInformation === 'json') && args.page && (args.page._edit)) {
      return req.res.send(args.page);
    }

    return self.sendPage(req, req.template, args);

  };

  // This promise event handler is triggered automatically every
  // time `self.sendPage` is called in any module, which includes normal CMS pages,
  // 404 pages, the login page, etc.
  //
  // This handler allows non-CMS pages like `/login` to "see" `data.home` and `data.home._children`
  // in their templates.
  //
  // For performance, if req.data.page is already set and it contains a
  // `req.data._ancestors[0]._children` property, that information
  // is leveraged to avoid redundant queries. If not, a query is made.
  //
  // For consistency, the home page is always retrieved using the same filters that
  // are configured for `ancestors`. Normally that includes children of each
  // ancestor. If that is explicitly reconfigured without the `children` option,
  // you will not get `data.home._children`.

  self.on('beforeSend', 'attachHomeBeforeSend', async function(req) {

    // Add level as a data attribute on the body tag
    // The admin bar usses this to stay open if configured by the user
    if (typeof _.get(req, 'data.page.level') === 'number') {
      self.apos.templates.addBodyDataAttribute(req,
        {
          'apos-level': req.data.page.level
        }
      );
    }

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

    // Fetch the home page with the same filters used to fetch ancestors, for consistency.
    // If filters for ancestors are not configured, then by default we still fetch the children of the
    // home page, so that tabs are easy to implement. However allow this to be
    // expressly shut off:
    //
    // home: { children: false }

    let filters = self.getServePageFilters().ancestors || {
      children: !((self.options.home && (self.options.home.children === false)))
    };

    let cursor = self.find(req, { level: 0 }).ancestorPerformanceRestrictions();

    _.each(filters, function(val, key) {
      cursor[key](val);
    });

    req.data.home = await cursor.toObject();

  });

  // A request is "found" if it should not be
  // treated as a "404 not found" situation

  self.isFound = function(req) {
    return req.loginRequired || req.insufficient || req.redirect || (req.data.page && (!req.notFound));
  };

  // Returns the cursor filter methods to be invoked when fetching a
  // page, by default. These add information about ancestor and child
  // pages of the page in question

  self.getServePageFilters = function() {
    return self.options.filters || {
      // Get the kids of the ancestors too so we can do tabs and accordion nav
      ancestors: {
        children: true
      },
      // Get our own kids
      children: true
    };
  };

  // The given cursor object is modified to return only pages that match
  // the given slug or a path prefix of it, and to sort results
  // in favor of a more complete match

  self.matchPageAndPrefixes = function(cursor, slug) {
    let slugs = [];
    let components;
    // Partial matches. Avoid an unnecessary OR of '/' and '/' for the
    // homepage by checking that slug.length > 1
    if (slug.length && (slug.substr(0, 1) === '/') && (slug.length > 1)) {
      let path = '';
      // homepage is always interesting
      slugs.unshift('/');
      components = slug.substr(1).split('/');
      for (let i = 0; (i < (components.length - 1)); i++) {
        let component = components[i];
        path = addSlashIfNeeded(path) + component;
        slugs.unshift(path);
      }
    }
    // And of course always consider an exact match. We use unshift to
    // put the exact match first in the query, but we still need to use
    // sort() and limit() to guarantee that the best result wins
    slugs.unshift(slug);

    cursor.sort({ slug: -1 });

    cursor.and({ slug: { $in: slugs } });
  };

  // Given a `req` object in which `req.data.bestPage` has already
  // been set, also set `req.data.page` if the slug is an exact match.
  // Otherwise set `req.remainder` to the nonmatching portion
  // of `req.params[0]` and leave `req.data.bestPage` as-is.
  // `req.remainder` is then utilized by modules like `apostrophe-custom-pages`
  // to implement features like dispatch, which powers the
  // "permalink" or "show" pages of `apostrophe-pieces-pages`

  self.evaluatePageMatch = function(req) {

    let slug = req.params[0];

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
  };

  self.ensureIndexes = async function() {
    await self.ensurePathIndex();
    await self.ensureLevelRankIndex();
  };

  self.ensurePathIndex = async function() {
    let params = self.getPathIndexParams();
    await self.apos.docs.db.createIndex(params, { unique: true, sparse: true });
  };

  self.getPathIndexParams = function() {
    return {
      path: 1
    };
  };

  self.ensureLevelRankIndex = async function() {
    let params = self.getLevelRankIndexParams();
    await self.apos.docs.db.createIndex(params, {});
  };

  self.getLevelRankIndexParams = function() {
    return {
      level: 1,
      rank: 1
    };
  };

  // A limited subset of page properties is pushed to
  // browser-side JavaScript. If you want more you
  // should make your own req.browserCalls or override
  // this method. Don't push gigantic joins if you don't
  // want slow pages

  self.pruneCurrentPageForBrowser = function(page) {

    page = _.pick(page, 'title', 'slug', '_id', 'type', 'ancestors', '_url');

    // Limit information about ancestors to avoid
    // excessive amounts of data in the page
    page.ancestors = _.map(page.ancestors, function(ancestor) {
      return _.pick(ancestor, [ 'title', 'slug', '_id', 'type', 'published', '_url' ]);
    });

    return page;

  };

  // Invoked via callForAll in the docs module

  self.docFixUniqueError = function(req, doc) {
    if (doc.path) {
      let num = (Math.floor(Math.random() * 10)).toString();
      doc.path += num;
    }
  };

  // Update the paths and slugs of descendant pages,
  // changing slugs only if they were
  // compatible with the original slug. Also updates
  // the level of descendants.
  //
  // On success, returns an array of objects with _id and slug properties,
  // indicating the new slugs for any pages that were modified.

  self.updateDescendantsAfterMove = async function(req, page, originalPath, originalSlug, options) {
    // If our slug changed, then our descendants' slugs should
    // also change, if they are still similar. You can't do a
    // global substring replace in MongoDB the way you can
    // in MySQL, so we need to fetch them and update them
    // individually. async.mapSeries is a good choice because
    // there may be zillions of descendants and we don't want
    // to choke the server. We could use async.mapLimit, but
    // let's not get fancy just yet
    let changed = [];
    if ((originalSlug === page.slug) && (originalPath === page.path)) {
      return changed;
    }
    let oldLevel = originalPath.split('/').length - 1;
    let matchParentPathPrefix = new RegExp('^' + self.apos.utils.regExpQuote(originalPath + '/'));
    let matchParentSlugPrefix = new RegExp('^' + self.apos.utils.regExpQuote(originalSlug + '/'));
    let done = false;
    let cursor = self.apos.docs.db.find(mergeCriteria({ path: matchParentPathPrefix })).project({ slug: 1, path: 1, level: 1 });
    while (!done) {
      const desc = await cursor.next();
      if (!desc) {
        // This means there are no more objects
        done = true;
        break;
      }
      let newSlug = desc.slug.replace(matchParentSlugPrefix, page.slug + '/');
      if (page.trash && (!desc.trash)) {
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
      await self.apos.docs.retryUntilUnique(req, desc, () => updateDescendant(desc));
    }

    return changed;

    function mergeCriteria(criteria) {
      if (options.criteria) {
        criteria = { $and: [ criteria, options.criteria ] };
      }
      return criteria;
    }

    async function updateDescendant(desc) {
      await self.apos.docs.db.updateOne(
        mergeCriteria({ _id: desc._id }), {
          $set: _.pick(desc, 'path', 'slug', 'level')
        }
      );
    }

  };

  self.parked = (self.options.minimumPark || [
    {
      slug: '/',
      parkedId: 'home',
      published: true,
      _defaults: {
        title: 'Home',
        type: 'home'
      },
      _children: [
        {
          slug: '/trash',
          parkedId: 'trash',
          type: 'trash',
          trash: true,
          published: false,
          orphan: true,
          _defaults: {
            title: 'Trash'
          }
        }
      ]
    }
  ]).concat(self.options.park || []);

  // Locate doc types that exist in the database but have
  // no module to manage them. If there are any, present a
  // warning to the developer and add a placeholder manager.

  self.manageOrphans = async function() {
    const managed = self.apos.docs.getManaged();
    await patchUndefined();
    const distinct = await find();
    await manage();

    async function patchUndefined() {
      return self.apos.docs.db.updateMany({
        type: { $exists: 0 }
      }, {
        $set: {
          type: 'WASUNDEFINED'
        }
      });
    }

    async function find() {
      return self.apos.docs.db.distinct('type');
    }

    async function manage() {
      const orphans = _.difference(distinct, managed);
      if (!orphans.length) {
        return;
      }
      self.apos.utils.error('* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *');
      self.apos.utils.error('HEY DEVELOPER: the following types exist in your aposDocs collection,');
      self.apos.utils.error('but are not managed by any module. A generic manager is being stubbed in');
      self.apos.utils.error('for each one to keep your site from crashing, but you should remove these');
      self.apos.utils.error('permanently from the database OR manage them properly by:\n');
      self.apos.utils.error('* Listing them as "types" for "apostrophe-pages", OR');
      self.apos.utils.error('* Providing an appropriate subclass of apostrophe-pieces.');
      self.apos.utils.error();
      self.apos.utils.error(orphans.join(', '));
      self.apos.utils.error();
      if (_.includes(orphans, 'WASUNDEFINED')) {
        self.apos.utils.error('Some of your docs had no type at all. The type WASUNDEFINED');
        self.apos.utils.error('has been set for them to allow a generic manager to work.');
      }
      self.apos.utils.error('* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *');
      for (let name of orphans) {
        await self.registerGenericPageType(name);
      }
    }
  };

  // Park pages as specified by the `park` option.

  self.implementParkAll = async function() {
    let req = self.apos.tasks.getReq();
    for (let item of self.parked) {
      await self.implementParkOne(req, item);
    }
  };

  // Parks one page as found in the `park` option. Called by
  // `implementParkAll`.

  self.implementParkOne = async function(req, item) {
    if (!((item.type || (item._defaults && item._defaults.type)) && item.slug)) {
      throw new Error('Parked pages must have type and slug properties:\n' + JSON.stringify(item, null, '  '));
    }

    const parent = await findParent();
    item.parked = _.keys(_.omit(item, '_defaults'));
    if (!parent) {
      item.path = '/';
      item.rank = 0;
      item.level = 0;
    }

    let existing = await findExisting();

    if (!existing && item.parkedId) {
      existing = await backupFindExisting();
    }

    if (existing) {
      await updateExisting();
    } else {
      await insert();
    }
    await children();

    async function findParent() {
      let parentSlug;
      if ((item.level === 0) || (item.slug === '/')) {
        return;
      }
      if (!item.parent) {
        parentSlug = '/';
      } else {
        parentSlug = item.parent;
      }
      return self.find(req, { slug: parentSlug })
        .joins(false)
        .areas(false)
        .published(null)
        .permission(false)
        .trash(null)
        .toObject();
    }

    async function findExisting() {
      let criteria = {};
      let slugWithOrWithoutSlash = new RegExp('^' + self.apos.utils.regExpQuote(item.slug.replace(/\/$/, '')) + '/?$');
      if (item.parkedId) {
        criteria.parkedId = item.parkedId;
      } else {
        criteria.slug = slugWithOrWithoutSlash;
      }
      return self.find(req, criteria)
        .joins(false)
        .areas(false)
        .published(null)
        .permission(false)
        .trash(null)
        .toObject();
    }

    async function backupFindExisting() {
      // Perhaps we are transitioning from no parkedId to having a parkedId?
      let criteria = {};
      let slugWithOrWithoutSlash = new RegExp('^' + self.apos.utils.regExpQuote(item.slug.replace(/\/$/, '')) + '/?$');
      criteria.slug = slugWithOrWithoutSlash;
      const existing = await self.find(req, criteria)
        .joins(false)
        .areas(false)
        .published(null)
        .permission(false)
        .trash(null)
        .toObject();
      if (existing && existing.parkedId && (existing.parkedId !== item.parkedId)) {
        throw new Error('The slug you wish to use for a parked page with the parkedId ' + existing.parkedId + ' is already in use by a parked page that has a different parkedId.');
      }
      return existing;
    }

    async function updateExisting() {
      // Enforce all permanent properties on existing
      // pages too
      await self.apos.docs.db.updateOne({
        _id: existing._id
      }, {
        $set: self.apos.utils.clonePermanent(item)
      });
    }

    async function insert() {
      let defaults = item._defaults;
      if (defaults) {
        delete item._defaults;
        _.defaults(item, defaults);
      }
      if (existing) {
        return;
      }
      if (!parent) {
        return self.apos.docs.insert(req, item);
      } else {
        return self.insert(req, parent, item);
      }
    }

    async function children() {
      if (!item._children) {
        return;
      }
      for (let child of item._children) {
        child.parent = item.slug;
        await self.implementParkOne(req, child);
      }
    }

  };

  self.apos.tasks.add('apostrophe-pages', 'unpark',
    'Usage: node app apostrophe-pages:unpark /page/slug\n\n' +
    'This unparks a page that was formerly locked in a specific\n' +
    'position in the page tree.',
    async function(apos, argv) {
      // Wrapping a method makes it easy to override
      // that method
      return self.unparkTask();
    }
  );

  self.unparkTask = async function() {
    if (self.apos.argv._.length !== 2) {
      throw new Error('Wrong number of arguments');
    }
    let slug = self.apos.argv._[1];
    const count = await self.apos.docs.db.updateOne({
      slug: slug
    }, {
      $unset: {
        parked: 1
      }
    });
    if (!count) {
      throw 'No page with that slug was found.';
    }
  };

  // Convenience wrapper
  function addSlashIfNeeded(s) {
    return self.apos.utils.addSlashIfNeeded(s);
  }

  // Routes use this to convert _id to id for the
  // convenience of jqtree
  self.mapMongoIdToJqtreeId = function(changed) {
    return _.map(changed, function(change) {
      change.id = change._id;
      delete change._id;
      return change;
    });
  };

  // Invoked by the apostrophe-versions module.
  //
  // Your module can add additional doc properties that should never be rolled back by pushing
  // them onto the `fields` array.

  self.docUnversionedFields = function(req, doc, fields) {
    // Moves in the tree have knock-on effects on other
    // pages, they are not suitable for rollback
    fields.push('path', 'trash', 'rank', 'level');
  };

  // Returns true if the doc is a page in the tree
  // (it has a slug with a leading /).

  self.isPage = function(doc) {
    // Proper docs always have a slug, but some of our unit tests are lazy about this.
    return doc.slug && doc.slug.match(/^\//);
  };

  // Returns a regular expression to match the `path` property of the descendants of the given page,
  // but not itself
  self.matchDescendants = function(page) {
    // Make sure there is a trailing slash, but don't add two (the home page already has one).
    // Also make sure there is at least one additional character, which there always will be,
    // in order to prevent the home page from matching as its own descendant
    return new RegExp('^' + self.apos.utils.regExpQuote(addSlashIfNeeded(page.path)) + '.');
  };

  // Returns true if `possibleAncestorPage` is an ancestor of `ofPage`.
  // A page is not its own ancestor. If either object is missing or
  // has no path property, false is returned.

  self.isAncestorOf = function(possibleAncestorPage, ofPage) {
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
    // The home page is everybody's ancestor, unless ofPage is also the home page.
    // The regular expression would fail because it would append a second /. -Tom
    if (possibleAncestorPage.path === '/') {
      return ofPage.path !== '/';
    }
    let regex = new RegExp('^' + self.apos.utils.regExpQuote(possibleAncestorPage.path + '/'));
    return ofPage.path.match(regex);
  };

  // While it's a good thing that all docs now can have nuanced permissions,
  // only pages care about "apply to subpages" as a concept when editing
  // permissions. This method adds those nuances to the permissions-related
  // schema fields. Called by the update routes (for new pages, there are
  // no subpages to apply things to yet). Returns a new schema

  self.addApplyToSubpagesToSchema = function(schema) {
    let fields = [ '_viewUsers', '_viewGroups', '_editUsers', '_editGroups' ];
    // Do only as much cloning as we have to to avoid modifying the original
    schema = _.clone(schema);
    let index = _.findIndex(schema, { name: 'loginRequired' });
    if (index !== -1) {
      schema.splice(index + 1, 0, {
        type: 'boolean',
        name: 'applyLoginRequiredToSubpages',
        label: 'Apply to Subpages',
        group: schema[index].group
      });
    }
    _.each(fields, function(name) {
      let index = _.findIndex(schema, { name: name });
      if (index === -1) {
        return;
      }
      let field = _.clone(schema[index]);
      let base = name.replace(/^_/, '');
      field.removedIdsField = base + 'RemovedIds';
      field.relationshipsField = base + 'Relationships';
      field.relationship = [
        {
          name: 'applyToSubpages',
          type: 'boolean',
          label: 'Apply to Subpages',
          inline: true
        }
      ];
      schema[index] = field;
    });
    return schema;
  };

  // Registers a manager for every page type that doesn't already have one via `apostrophe-custom-pages`,
  // `apostrophe-pieces-pages`, etc. Invoked by `modulesReady`

  self.registerGenericPageTypes = async function() {
    let types = _.map(self.typeChoices, 'name');
    types = types.concat(self.getParkedTypes());
    types = _.uniq(types);
    for (let item of types) {
      await self.registerGenericPageType(item);
    }
  };

  // Get the page type names for all the parked pages, including parked children, recursively.

  self.getParkedTypes = function() {
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
      _.each(parked, function(page) {
        if (page._children) {
          types = types.concat(_.map(page._children, getType)).concat(getChildTypes(page._children));
        }
      });
      return _.uniq(types);
    }
  };

  // Registers a manager for a specific page type that doesn't already have one via `apostrophe-custom-pages`,
  // `apostrophe-pieces-pages`, etc. Invoked by `modulesReady` via `registerGenericPageTypes` and
  // `manageOrphans`

  self.registerGenericPageType = async function(type) {
    let manager = self.apos.docs.getManager(type);
    if (manager) {
      return;
    }
    let typeName = type + '-auto-pages';
    self.apos.define(typeName, {
      extend: 'apostrophe-custom-pages',
      name: type
    });
    manager = await self.apos.create(typeName, {
      apos: self.apos
    });
    self.apos.docs.setManager(type, manager);
  };

  self.registerTrashPageType = async function() {
    return self.registerGenericPageType('trash');
  };

  self.validateTypeChoices = function() {
    _.each(self.typeChoices, function(choice) {
      if (!choice.name) {
        throw new Error("One of the page types specified for your 'types' option has no 'name' property.");
      }
      if (!choice.label) {
        throw new Error("One of the page types specified for your 'types' option has no 'label' property.");
      }
    });
  };

  // bc wrapper for `apos.templates.append('contextMenu', helper)`.

  self.addAfterContextMenu = function(helper) {
    return self.apos.templates.append('contextMenu', helper);
  };

  self.finalizeControls = function() {

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

  };

  self.addPermissions = function() {
    self.apos.permissions.add({
      value: 'admin-apostrophe-page',
      label: 'Admin: Pages'
    });
    self.apos.permissions.add({
      value: 'edit-apostrophe-page',
      label: 'Edit: Pages'
    });
  };

  self.removeParkedPropertiesFromSchema = function(page, schema) {
    return _.filter(schema, function(field) {
      return !_.includes(page.parked, field.name);
    });
  };
  // any `slug` field named `slug`. If not, return the schema unmodified.

  self.removeSlugFromHomepageSchema = function(page, schema) {
    if (page.level === 0) {
      schema = _.reject(schema, { type: 'slug', name: 'slug' });
    }
    return schema;
  };

  self.getCreateControls = function(req) {
    let controls = _.cloneDeep(self.createControls);
    return controls;
  };

  self.getEditControls = function(req) {
    let controls = _.cloneDeep(self.editControls);
    return controls;
  };

  self.addToAdminBar = function() {
    self.apos.adminBar.add(self.__meta.name, 'Pages', 'edit-apostrophe-page');
  };

  // Returns the effective base URL for the given request.
  // If Apostrophe's top-level `baseUrl` option is set, it is returned,
  // otherwise the empty string. This makes it easier to build absolute
  // URLs (when `baseUrl` is configured), or to harmlessly prepend
  // the empty string (when it is not configured). The
  // Apostrophe cursors used to fetch Apostrophe pages
  // consult this method, and it is extended by the optional
  // `apostrophe-workflow` module to create correct absolute URLs
  // for specific locales.

  self.getBaseUrl = function(req) {
    return self.apos.baseUrl || '';
  };

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

  self.batchSimpleRoute = async function(req, name, change) {
    let batchOperation = _.find(self.options.batchOperations, { name: name });
    let schema = batchOperation.schema || [];

    let data = self.apos.schemas.newInstance(schema);
    await self.apos.schemas.convert(req, schema, 'form', req.body, data);
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
      return self.apos.modules['apostrophe-jobs'].run(req, ids, one, {
        labels: {
          title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label
        }
      });
    }

    async function one(req, id) {
      const page = await self.findForBatch(req, { _id: id }).toObject();
      if (!page) {
        throw new Error('notfound');
      }
      await change(req, page, data);
    }
  };

  // Given a page and its parent (if any), returns a schema that
  // is filtered appropriately to that page's type, taking into
  // account whether the page is new and the parent's allowed
  // subpage types

  self.allowedSchema = function(req, page, parentPage) {
    let schema = self.apos.docs.getManager(page.type).allowedSchema(req);
    let typeField = _.find(schema, { name: 'type' });
    if (typeField) {
      let allowed = self.allowedChildTypes(parentPage);
      // For a preexisting page, we can't forbid the type it currently has
      if (page._id && (!_.includes(allowed, page.type))) {
        allowed.unshift(page.type);
      }
      typeField.choices = _.map(allowed, function(name) {
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
      let choice = _.find(self.typeChoices, { name: name });
      let label = choice && choice.label;
      if (!label) {
        let manager = self.apos.docs.getManager(name);
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
  };

};
