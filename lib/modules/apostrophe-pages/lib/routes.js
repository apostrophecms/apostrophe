var async = require('async');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.createRoutes = function() {
    // Render the editor for page settings
    self.renderRoute('post', 'editor', self.requireEditor, function(req, res, next) {
      var type = self.apos.launder.string(req.body.type);
      var verb = self.apos.launder.string(req.body.verb);
      var id = self.apos.launder.id(req.body.id);
      var schema;
      var parentPage;
      if (verb === 'update') {
        var trash = self.apos.docs.trashInSchema ? null : false;
        return self.find(req, { _id: id }).ancestors(true).permission('publish-doc').trash(trash).toObject(function(err, page) {
          if (err) {
            return next(err);
          }
          if (!page) {
            return next('notfound');
          }
          var parentPage = page._ancestors && page._ancestors.length && page._ancestors[page._ancestors.length - 1];
          if (!parentPage) {
            // convert 0 to null
            parentPage = null;
          }
          // It is not an error to call this with null when there
          // is no parent page. That checks allowable home page types
          if (self.isAllowedChildType(parentPage, type)) {
            page.type = type;
          }
          schema = self.allowedSchema(req, page, parentPage);
          // We modified it, we have to bless the new version
          self.apos.schemas.bless(req, schema);
          return succeed();
        });
      } else if (verb === 'copy') {
        // id supplied was that of a peer
        return self.find(req, { _id: id }).ancestors(true).toObject(function(err, peerPage) {
          if (err) {
            return next(err);
          }
          if (!peerPage) {
            return next('notfound');
          }
          parentPage = peerPage._ancestors && peerPage._ancestors[0] && peerPage._ancestors[peerPage._ancestors.length - 1];
          if (!parentPage) {
            // set root as parent if parentPage has no ancestors -> root page
            parentPage = peerPage;
          }
          var child = self.newChild(parentPage, type);
          if (!child) {
            return next('invalid');
          }
          if (self.isAllowedChildType(parentPage, type)) {
            child.type = type;
          } else {
            child.type = self.allowedChildTypes(parentPage)[0];
          }
          // New page is not parked, clearing this eliminates problems with
          // missing schema fields for the new copy
          delete child.parked;
          schema = self.allowedSchema(req, child, parentPage);
          return succeed();
        });
      } else {
        // id supplied was that of the parent
        return self.find(req, { _id: id }).permission('publish-doc').toObject(function(err, _parentPage) {
          if (err) {
            return next(err);
          }
          if (!_parentPage) {
            return next('notfound');
          }
          parentPage = _parentPage;
          var child = self.newChild(parentPage, type);
          if (!child) {
            return next('invalid');
          }
          if (self.isAllowedChildType(parentPage, type)) {
            child.type = type;
          } else {
            child.type = self.allowedChildTypes(parentPage)[0];
          }
          if (!child.type) {
            // Parent allows no child types
            return next('invalid');
          }
          schema = self.allowedSchema(req, child, parentPage);
          return succeed();
        });
      }
      function succeed() {
        return next(null, {
          template: 'editor',
          data: {
            schema: schema,
            verb: verb,
            trashInSchema: self.apos.docs.trashInSchema
          }
        });
      }

    });

    // Fetch data needed to edit and ultimately insert a page
    self.apiRoute('post', 'fetch-to-insert', self.requireEditor, function(req, res, next) {
      // parent id
      var _id = req.body._id;
      var type = self.apos.launder.string(req.body.type);
      return self.find(req, { _id: _id }).permission('edit-apostrophe-page').toObject(function(err, parentPage) {
        if (err) {
          return next(err);
        }
        if (!parentPage) {
          return next('notfound');
        }
        var child = self.newChild(parentPage, type);
        if (!child) {
          return next('invalid');
        }
        if (self.isAllowedChildType(parentPage, type)) {
          child.type = type;
        } else {
          child.type = self.allowedChildTypes(parentPage)[0];
        }
        if (!child.type) {
          // parent page does not allow any subpage types
          return next('invalid');
        }
        return next(null, { data: child, schema: self.allowedSchema(req, child, parentPage) });
      });
    });

    self.apiRoute('post', 'insert', self.requireEditor, function(req, res, next) {
      var parentId = self.apos.launder.id(req.body.currentPageId);
      var page = req.body.page || {};
      if (typeof (page) !== 'object') {
        // cheeky
        return next('invalid');
      }
      var parentPage;
      var safePage;
      return async.series({
        findParent: function(callback) {
          return self.find(req, { _id: parentId }).permission('publish-apostrophe-page').toObject(function(err, _parentPage) {
            if (err) {
              return callback(err);
            }
            if (!_parentPage) {
              return callback('notfound');
            }
            parentPage = _parentPage;
            safePage = self.newChild(parentPage, page.type);
            if (!safePage) {
              return callback('invalid');
            }
            if (self.isAllowedChildType(parentPage, page.type)) {
              safePage.type = page.type;
            }
            return callback(null);
          });
        },
        convert: function(callback) {
          // Base the allowed schema on a generic new child of the parent page, not
          // random untrusted stuff from the browser
          var schema = self.allowedSchema(req, safePage, parentPage);
          return self.apos.schemas.convert(req, schema, 'form', page, safePage, callback);
        },
        insert: function(callback) {
          return self.insert(req, parentPage, safePage, callback);
        },
        find: function(callback) {
          // Fetch the page. Yes, we already have it, but this way all the cursor
          // filters run and we have access to ._url
          return self.find(req, { _id: safePage._id }).published(null).toObject(function(err, _safePage) {
            if (err) {
              return callback(err);
            }
            if (!_safePage) {
              return callback('notfound');
            }
            safePage = _safePage;
            return callback(null);
          });
        }
      }, function(err) {
        if (err) {
          return next(err);
        }
        return next(null, { status: 'ok', url: safePage._url, page: safePage });
      });
    });

    // Fetch data needed to edit and ultimately update a page

    self.apiRoute('post', 'fetch-to-update', self.requireEditor, function(req, res, next) {
      var _id = self.apos.launder.id(req.body._id);
      var type = self.apos.launder.string(req.body.type);
      if (!self.apos.docs.getManager(type)) {
        return next('notfound');
      }
      return self.find(req, { _id: _id }).ancestors(true).permission('edit-apostrophe-page').trash(self.apos.docs.trashInSchema ? null : false).toObject(function(err, page) {
        if (err) {
          return next('error');
        }
        if (!page) {
          return next('notfound');
        }
        var parentPage = page._ancestors && page._ancestors.length && page._ancestors[page._ancestors.length - 1];
        if (!parentPage) {
          // convert 0 to null
          parentPage = null;
        }
        if (self.isAllowedChildType(parentPage, type)) {
          page.type = type;
        }
        var schema = self.allowedSchema(req, page, parentPage);
        // We modified it, we have to bless the new version
        self.apos.schemas.bless(req, schema);
        return next(null, { data: page, schema: schema });
      });
    });

    self.apiRoute('post', 'update', self.requireEditor, function(req, res, next) {
      var id = self.apos.launder.id(req.body.currentPageId);
      var page = req.body.page || {};
      if (typeof (page) !== 'object') {
        // cheeky
        return next('notfound');
      }
      var existingPage;
      return async.series({
        find: function(callback) {
          return self.find(req, { _id: id }).ancestors(true).permission('publish-apostrophe-page').trash(self.apos.docs.trashInSchema ? null : false).toObject(function(err, _page) {
            if (err) {
              return callback(err);
            }
            if (!_page) {
              return callback('notfound');
            }
            existingPage = _page;
            return callback(null);
          });
        },
        convert: function(callback) {
          var parentPage = existingPage._ancestors && existingPage._ancestors.length && existingPage._ancestors[existingPage._ancestors.length - 1];
          var manager = self.apos.docs.getManager(self.apos.launder.string(page.type || existingPage.type));
          if (!manager) {
            // sneaky
            return callback('notfound');
          }
          if (self.isAllowedChildType(parentPage, page.type)) {
            existingPage.type = page.type;
          }
          var schema = self.allowedSchema(req, existingPage, parentPage);
          schema = self.addApplyToSubpagesToSchema(schema);
          schema = self.removeParkedPropertiesFromSchema(existingPage, schema);
          // overwrite fields that are in the schema
          return self.apos.schemas.convert(req, schema, 'form', page, existingPage, callback);
        },
        update: function(callback) {
          return self.update(req, existingPage, callback);
        },
        findAgain: function(callback) {
          // Fetch the page. Yes, we already have it, but this way all the cursor
          // filters run and we have access to ._url
          return self.find(req, { _id: existingPage._id }).published(null).trash(self.apos.docs.trashInSchema ? null : false).toObject(function(err, _page) {
            if (err) {
              return callback(err);
            }
            if (!_page) {
              return callback('notfound');
            }
            existingPage = _page;
            return callback(null);
          });
        }
      }, function(err) {
        if (err) {
          return next(err);
        }
        return next(null, { url: existingPage._url, page: existingPage });
      });
    });

    // Fetch data needed to copy a page.

    self.apiRoute('post', 'fetch-to-copy', self.requireEditor, function(req, res, next) {
      var _id = self.apos.launder.id(req.body._id);
      var type = self.apos.launder.string(req.body.type);
      var manager = self.apos.docs.getManager(type);
      if (!manager) {
        return next('notfound');
      }
      return self.find(req, { _id: _id }).ancestors(true).permission('edit-apostrophe-page').toObject(function(err, page) {
        if (err) {
          self.apos.utils.error(err);
          return next('error');
        }
        if (!page) {
          return next('notfound');
        }

        var parentPage = page._ancestors && page._ancestors[0] && page._ancestors[page._ancestors.length - 1];
        if (self.isAllowedChildType(parentPage, page.type)) {
          page.type = type;
        } else {
          page.type = self.allowedChildTypes(parentPage)[0];
        }
        // New page is not parked, clearing this eliminates problems with
        // missing schema fields for the new copy
        delete page.parked;
        var schema = self.allowedSchema(req, page, parentPage);

        // Force slug and title to be in sync again, otherwise copying the homepage is problematic
        // Also makes sense to reset this 'preference' for the new copy
        var slugComponents = page.slug.split('/');
        var currentSlugTitle = slugComponents.pop();

        if (currentSlugTitle !== self.apos.utils.slugify(page.title)) {
          slugComponents[slugComponents.length - 1] = self.apos.utils.slugify(page.title);
          page.slug = slugComponents.join('/');
        }

        // We modified it, we have to bless the new version
        self.apos.schemas.bless(req, schema);
        return next(null, { data: page, schema: schema });
      });
    });

    // Fetch data needed to insert a copied page. Currently identical to insert
    // except that the parent page id is determined differently

    self.apiRoute('post', 'copy', self.requireEditor, function(req, res, next) {
      var currentPageId = self.apos.launder.id(req.body.currentPageId);
      var page = req.body.page || {};
      if ((typeof page) !== 'object') {
        // cheeky
        return next('invalid');
      }
      var siblingPage, parentPage;
      var safePage;
      return async.series({
        findParentAndSibling: function(callback) {
          return self.find(req, { _id: currentPageId }).permission('publish-apostrophe-page').ancestors({ permission: false }).toObject(function(err, currentPage) {
            if (err) {
              return callback(err);
            }
            if (!currentPage) {
              return callback('notfound');
            }
            if (!currentPage._ancestors.length) {
              // currentPage is the root page, append the copied page as child
              parentPage = currentPage;
            } else {
              siblingPage = currentPage;
              parentPage = currentPage._ancestors[currentPage._ancestors.length - 1];
            }
            if (!parentPage._publish) {
              return callback('notfound');
            }

            safePage = self.newChild(parentPage, page.type);

            if (!safePage) {
              return callback('invalid');
            }
            return callback(null);
          });
        },
        convert: function(callback) {
          var manager = self.apos.docs.getManager(self.apos.launder.string(page.type));
          if (!manager) {
            // sneaky
            return callback('notfound');
          }
          // Base the allowed schema on a generic new child of the parent page, not
          // random untrusted stuff from the browser
          delete safePage.parked;
          if (self.isAllowedChildType(parentPage, page && page.type)) {
            safePage.type = page && page.type;
          } else {
            safePage.type = self.allowedChildTypes(parentPage)[0];
          }
          var schema = self.allowedSchema(req, safePage, parentPage);
          return self.apos.schemas.convert(req, schema, 'form', page, safePage, callback);
        },
        beforeCopy: function(callback) {
          // Copy top-level area properties which are not part of the schema
          // (introduced via apos.area)

          var workingPage;
          if (siblingPage) {
            workingPage = siblingPage;
          } else {
            workingPage = parentPage;
          }

          _.each(workingPage, function (val, key) {
            // Don't let typeof(null) === 'object' bite us
            if (val && (typeof (val) === 'object') && (val.type === 'area')) {
              safePage[key] = val;
            }
          });

          // Chance to override and copy more non-schema content
          self.callAllAndEmit('pageBeforeCopy', 'beforeCopy', req, workingPage, parentPage, safePage, callback);
        },
        insert: function(callback) {
          return self.insert(req, parentPage, safePage, callback);
        },
        find: function(callback) {
          // Fetch the page. Yes, we already have it, but this way all the cursor
          // filters run and we have access to ._url
          return self.find(req, { _id: safePage._id }).published(null).toObject(function(err, _safePage) {
            if (err) {
              return callback(err);
            }
            if (!_safePage) {
              return callback('notfound');
            }
            safePage = _safePage;
            return callback(null);
          });
        }
      }, function(err) {
        if (err) {
          return next(err);
        }
        return next(null, { url: safePage._url });
      });
    });

    self.apiRoute('post', 'move', self.requireEditor, function(req, res, next) {
      return self.move(req, self.apos.launder.id(req.body.movedId), self.apos.launder.id(req.body.targetId), self.apos.launder.string(req.body.position), function(err, changed) {
        if (err) {
          return next(err);
        }
        return next(null, { changed: self.mapMongoIdToJqtreeId(changed) });
      });
    });

    self.apiRoute('post', 'move-to-trash', self.requireEditor, function(req, res, next) {
      return self.moveToTrash(req, self.apos.launder.id(req.body._id), function(err, parentSlug, changed) {
        if (err) {
          return next(err);
        }
        return next(null, { changed: self.mapMongoIdToJqtreeId(changed), parentSlug: parentSlug });
      });
    });

    self.apiRoute('post', 'rescue-from-trash', self.requireEditor, function(req, res, next) {
      return self.rescueInTree(req, self.apos.launder.id(req.body._id), function(err, parentSlug, changed) {
        if (err) {
          return next(err);
        }
        return next(null, { changed: self.mapMongoIdToJqtreeId(changed), parentSlug: parentSlug });
      });
    });

    self.apiRoute('post', 'delete-from-trash', self.requireEditor, function(req, res, next) {
      return self.deleteFromTrash(req, self.apos.launder.id(req.body._id), function(err, parentSlug) {
        if (err) {
          return next(err);
        }
        return next(null, { parentSlug: parentSlug });
      });
    });

    self.apiRoute('post', 'get-jqtree', self.apos.docs.requireEditorOfSomething, function(req, res, next) {
      const children = {
        depth: 1000,
        orphan: null,
        areas: false
      };
      if (!req.body.chooser) {
        // When not functioning as a chooser for joins, we are functioning
        // as "Manage Pages," and we need to show pages we ordinarily wouldn't.
        // Also exclude pages we ordinarily wouldn't, and fetch pages
        // we can't necessarily edit in order to later work out which to
        // show as waypoints in the tree (ancestors of editable pages
        // the user should see to avoid confusion).
        children.published = null;
        children.trash = null;
        children.reorganize = true;
        children.permission = false;
      }
      const cursor = self.find(req, { level: 0 }).children(children);
      if (!req.body.chooser) {
        // See above.
        cursor.published(null).trash(null).reorganize(true).permission(false);
      }
      return cursor.toObject(function(err, page) {
        if (err) {
          return next(err);
        }

        if (!page) {
          return next('no home page');
        }

        var data = {
          label: page.title
        };

        // jqtree supports more than one top level node, so we have to pass an array
        data = [ pageToJqtree(page) ];
        if (!req.body.chooser) {
          // Prune pages we can't reorganize
          data = clean(data);
        }
        return next(null, { tree: data });

        // Recursively build a tree in the format jqtree expects
        function pageToJqtree(page) {
          var info = {
            label: page.title,
            slug: page.slug,
            id: page._id,
            // For icons
            type: page.type,
            // Also nice for icons and browser-side decisions about what's draggable where
            trash: page.trash,
            published: page.published,
            publish: (page.path === '/trash') || self.apos.permissions.can(req, 'publish-apostrophe-page', page),
            edit: self.apos.permissions.can(req, 'edit-apostrophe-page', page)
          };
          if (page._children && page._children.length) {
            info.children = [];
            // First non-trash, then .trash true,
            // then the conventional trashcan itself
            // to avoid presenting a confusing UI
            _.each(page._children, function(child) {
              if (!child.trash) {
                info.children.push(pageToJqtree(child));
              }
            });
            _.each(page._children, function(child) {
              if (child.trash && (!(child.type === 'trash'))) {
                info.children.push(pageToJqtree(child));
              }
            });
            _.each(page._children, function(child) {
              if (child.trash && (child.type === 'trash')) {
                var forJqtree = pageToJqtree(child);
                if (self.apos.docs.trashInSchema) {
                  forJqtree.label = req.__ns('apostrophe', 'Legacy Trash');
                }
                info.children.push(forJqtree);
              }
            });
          }
          return info;
        }

        // If I can't publish at least one of a node's
        // descendants, prune it from the tree. Returns
        // a pruned version of the tree

        function clean(nodes) {
          mark(nodes, []);
          return prune(nodes);
          function mark(nodes, ancestors) {
            _.each(nodes, function(node) {
              if (node.publish) {
                node.good = true;
                _.each(ancestors, function(ancestor) {
                  ancestor.good = true;
                });
              }
              mark(node.children || [], ancestors.concat([ node ]));
            });
          }
          function prune(nodes) {
            var newNodes = [];
            _.each(nodes, function(node) {
              node.children = prune(node.children || []);
              if (node.good) {
                newNodes.push(node);
              }
            });
            return newNodes;
          }
        }
      });
    });

    self.route('post', 'reorganize', self.requireEditor, function(req, res) {
      return self.renderAndSend(req, 'reorganize.html', {
        batchOperations: self.options.batchOperations,
        trashInSchema: self.apos.docs.trashInSchema
      });
    });

    self.renderRoute('post', 'chooser-modal', self.requireEditor, function(req, res, next) {
      return next(null, {
        template: 'chooserModal'
      });
    });

    self.apiRoute('post', 'info', self.apos.docs.requireEditorOfSomething, function(req, res, next) {
      var cursor = self.find(req, { _id: self.apos.launder.id(req.body._id) }).published(null).areas(false);
      self.setInfoProjection(req, cursor);
      return cursor.toObject(function(err, page) {
        if (err) {
          return next(err);
        }
        // Give everyone a chance to influence what is returned
        // by this API
        return self.callAllAndEmit('pageBeforeInfo', 'beforeInfo', req, page, function(err) {
          if (err) {
            return next(err);
          }
          return next(null, { page: page });
        });
      });
    });

    // Implement the publish route, which can publish
    // one page (via req.body._id) or many (via req.body.ids).
    // The `data` property of the API response will contain the page
    // only for the `req.body._id` case.

    self.route('post', 'publish', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'publish', function(req, page, data, callback) {
        page.published = true;
        return self.update(req, page, callback);
      });
    });

    // Implement the unpublish route, which can publish
    // one page (via req.body._id) or many (via req.body.ids).
    // The `data` property of the API response will contain the page
    // only for the `req.body._id` case.

    self.route('post', 'unpublish', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'unpublish', function(req, page, data, callback) {
        page.published = false;
        return self.update(req, page, callback);
      });
    });

    // Implement the tag route, which can tag
    // one page (via `req.body._id`) or many (via `req.body.ids`).
    // The tags to be added are in the `req.body.tags` array.

    self.route('post', 'tag', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'tag', function(req, page, data, callback) {
        if (!page.tags) {
          page.tags = [];
        }
        page.tags = _.uniq(page.tags.concat(data.tags));
        return self.update(req, page, callback);
      });
    });

    // Implement the untag route, which can untag
    // one page (via `req.body._id`) or many (via `req.body.ids`).
    // The tags to be removed are in `req.body.tags`.

    self.route('post', 'untag', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'untag', function(req, page, data, callback) {
        if (!page.tags) {
          return setImmediate(callback);
        }
        var removing = data.tags;
        page.tags = _.filter(page.tags, function(tag) {
          return !_.contains(removing, tag);
        });
        return self.update(req, page, callback);
      });
    });

    // Implement the batch trash route, which can trash
    // many pages (via req.body.ids) and responds with a job id.

    self.route('post', 'trash', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'trash', function(req, page, data, callback) {
        if (page.trash) {
          return setImmediate(callback);
        }
        if (self.apos.docs.trashInSchema) {
          return self.trashInSchema(req, page._id, true, callback);
        } else {
          return self.moveToTrash(req, page._id, function(err) {
            return callback(err);
          });
        }
      });
    });

    // Implement the batch rescue route, which can rescue
    // many pages (via req.body.ids) and responds with a job id.
    // Cannot be invoked when trashInSchema is false, as there
    // is no sensible way to place them when they return to
    // the tree - better to drag them out of the trash.

    self.route('post', 'rescue', self.requireEditor, function(req, res) {
      return self.batchSimpleRoute(req, 'rescue', function(req, page, data, callback) {
        if (!page.trash) {
          return setImmediate(callback);
        }
        if (self.apos.docs.trashInSchema) {
          return self.trashInSchema(req, page._id, false, callback);
        } else {
          return callback('invalid');
        }
      });
    });

  };

};
