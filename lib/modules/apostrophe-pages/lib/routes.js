var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  // Render the editor for page settings
  self.route('post', 'editor', function(req, res) {
    var type = req.body.type;
    var verb = req.body.verb;
    var manager = self.apos.docs.getManager(type);
    if (!manager) {
      res.statusCode = 404;
      return res.send('not found');
    }
    var schema = manager.allowedSchema(req);
    if (verb === 'update') {
      schema = self.addApplyToSubpagesToSchema(schema);
      // We modified it, we have to bless the new version
      self.apos.schemas.bless(req, schema);
    }
    return res.send(self.render(req, 'editor', { schema: schema, verb: verb }));
  });

  // Fetch data needed to edit and ultimately insert a page
  self.route('post', 'fetch-to-insert', function(req, res) {
    // parent id
    var _id = req.body._id;
    var type = self.apos.launder.string(req.body.type);
    var manager = self.apos.docs.getManager(type);
    if (!manager) {
      return res.send({ status: 'notfound' });
    }
    return self.find(req, { _id: _id }).permission('publish-doc').toObject(function(err, parentPage) {
      if (err) {
        console.error(err);
        return res.send({ status: 'error' });
      }
      if (!parentPage) {
        return res.send({ status: 'notfound' });
      }
      var child = self.newChild(parentPage);
      return res.send({ status: 'ok', data: child, schema: manager.allowedSchema(req) });
    });
  });

  self.route('post', 'insert', function(req, res) {
    var parentId = self.apos.launder.id(req.body.currentPageId);
    var page = req.body.page || {};
    if (typeof(page) !== 'object') {
      // cheeky
      return res.send({ status: 'notfound' });
    }
    var parentPage;
    var safePage;
    return async.series({
      findParent: function(callback) {
        return self.find(req, { _id: parentId }).permission('publish-page').toObject(function(err, _parentPage) {
          if (err) {
            return callback(err);
          }
          if (!_parentPage) {
            return callback('notfound');
          }
          parentPage = _parentPage;
          safePage = self.newChild(parentPage);
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
        var schema = manager.allowedSchema(req);
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
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', url: safePage._url });
    });
  });

  // Fetch data needed to edit and ultimately update a page

  self.route('post', 'fetch-to-update', function(req, res) {
    var _id = self.apos.launder.id(req.body._id);
    var type = self.apos.launder.string(req.body.type);
    var manager = self.apos.docs.getManager(type);
    if (!manager) {
      return res.send({ status: 'notfound' });
    }
    return self.find(req, { _id: _id }).permission('publish-doc').toObject(function(err, page) {
      if (err) {
        console.error(err);
        return res.send({ status: 'error' });
      }
      if (!page) {
        return res.send({ status: 'notfound' });
      }
      var schema = manager.allowedSchema(req);
      schema = self.addApplyToSubpagesToSchema(schema);
      // We modified it, we have to bless the new version
      self.apos.schemas.bless(req, schema);
      return res.send({ status: 'ok', data: page, schema: schema });
    });
  });

  self.route('post', 'update', function(req, res) {
    var id = self.apos.launder.id(req.body.currentPageId);
    var page = req.body.page || {};
    if (typeof(page) !== 'object') {
      // cheeky
      return res.send({ status: 'notfound' });
    }
    var existingPage;
    return async.series({
      find: function(callback) {
        return self.find(req, { _id: id }).permission('publish-page').toObject(function(err, _page) {
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
        var manager = self.apos.docs.getManager(self.apos.launder.string(page.type));
        if (!manager) {
          // sneaky
          console.error('no manager for type');
          return callback('notfound');
        }
        var schema = manager.allowedSchema(req);
        schema = self.addApplyToSubpagesToSchema(schema);
        // overwrite fields that are in the schema
        return self.apos.schemas.convert(req, schema, 'form', page, existingPage, callback);
      },
      update: function(callback) {
        return self.update(req, existingPage, callback);
      },
      findAgain: function(callback) {
        // Fetch the page. Yes, we already have it, but this way all the cursor
        // filters run and we have access to ._url
        return self.find(req, { _id: existingPage._id }).published(null).toObject(function(err, _page) {
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
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', url: existingPage._url });
    });
  });

  // Fetch data needed to copy a page. Currently identical to fetch-to-update

  self.route('post', 'fetch-to-copy', function(req, res) {
    var _id = self.apos.launder.id(req.body._id);
    var type = self.apos.launder.string(req.body.type);
    var manager = self.apos.docs.getManager(type);
    if (!manager) {
      return res.send({ status: 'notfound' });
    }
    return self.find(req, { _id: _id }).permission('publish-doc').toObject(function(err, page) {
      if (err) {
        console.error(err);
        return res.send({ status: 'error' });
      }
      if (!page) {
        return res.send({ status: 'notfound' });
      }
      var schema = manager.allowedSchema(req);
      schema = self.addApplyToSubpagesToSchema(schema);
      // We modified it, we have to bless the new version
      self.apos.schemas.bless(req, schema);
      return res.send({ status: 'ok', data: page, schema: schema });
    });
  });

  // Fetch data needed to insert a copied page. Currently identical to insert
  // except that the parent page id is determined differently

  self.route('post', 'copy', function(req, res) {
    var currentPageId = self.apos.launder.id(req.body.currentPageId);
    var page = req.body.page || {};
    if (typeof(page) !== 'object') {
      // cheeky
      return res.send({ status: 'notfound' });
    }
    var siblingPage, parentPage;
    var safePage;
    return async.series({
      findParentAndSibling: function(callback) {
        return self.find(req, { _id: currentPageId }).permission('publish-page').ancestors({ permission: false }).toObject(function(err, currentPage) {
          if (err) {
            return callback(err);
          }
          if (!currentPage) {
            return callback('notfound');
          }
          if (!currentPage._ancestors.length) {
            return callback('notfound');
          }
          siblingPage = currentPage;
          parentPage = currentPage._ancestors[currentPage._ancestors.length - 1];
          if (!parentPage._publish) {
            return callback('notfound');
          }
          safePage = self.newChild(parentPage);
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
        var schema = manager.allowedSchema(req);
        return self.apos.schemas.convert(req, schema, 'form', page, safePage, callback);
      },
      beforeCopy: function(callback) {
        // Copy top-level area properties which are not part of the schema
        // (introduced via apos.area)
        _.each(siblingPage, function(val, key) {
          // Don't let typeof(null) === 'object' bite us
          if (val && (typeof(val) === 'object') && (val.type === 'area')) {
            safePage[key] = val;
          }
        });
        // Chance to override and copy more non-schema content
        self.apos.callAll('pageBeforeCopy', req, siblingPage, parentPage, safePage, callback);
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
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', url: safePage._url });
    });
  });

  self.route('post', 'move', function(req, res) {
    return self.move(req, self.apos.launder.id(req.body.movedId), self.apos.launder.id(req.body.targetId), self.apos.launder.string(req.body.position), function(err, changed) {
      if (err) {
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', changed: self.mapMongoIdToJqtreeId(changed) });
    });
  });

  self.route('post', 'move-to-trash', function(req, res) {
    return self.moveToTrash(req, self.apos.launder.id(req.body._id), function(err, parentSlug, changed) {
      if (err) {
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', changed: self.mapMongoIdToJqtreeId(changed), parentSlug: parentSlug });
    });
  });

  self.route('post', 'delete-from-trash', function(req, res) {
    return self.deleteFromTrash(req, self.apos.launder.id(req.body._id), function(err, parentSlug) {
      if (err) {
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', parentSlug: parentSlug });
    });
  });

  self.route('post', 'get-jqtree', function(req, res) {
    return self.find(req, { slug: '/' }).children({ depth: 1000, published: null, trash: null, orphan: null, reorganize: true, areas: false, permission: false }).published(null).trash(null).reorganize(true).toObject(function(err, page) {
      if (err) {
        console.error(err);
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }

      if (!page) {
        return res.send({status: 'no home page' });
      }

      var data = {
        label: page.title
      };

      var util = require('util');
      // jqtree supports more than one top level node, so we have to pass an array
      data = [ pageToJqtree(page) ];
      // Prune pages we can't reorganize
      data = clean(data);
      res.send({ status: 'ok', tree: data });

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
          publish: (page.path === '/trash') || self.apos.permissions.can(req, 'publish-page', page),
          edit: self.apos.permissions.can(req, 'edit-page', page)
        };
        if (page._children && page._children.length) {
          info.children = [];
          // Sort trash after non-trash
          _.each(page._children, function(child) {
            if (!child.trash) {
              info.children.push(pageToJqtree(child));
            }
          });
          _.each(page._children, function(child) {
            if (child.trash) {
              info.children.push(pageToJqtree(child));
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

  self.route('post', 'reorganize', function(req, res) {
    return res.send(self.render(req, 'reorganize.html', {}));
  });

  self.route('post', 'info', function(req, res) {
    return self.find(req, { _id: self.apos.launder.id(req.body._id) }).published(null).areas(false).toObject(function(err, page) {
      if (err) {
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      // Give everyone a chance to influence what is returned
      // by this API
      return self.apos.callAll('pageBeforeInfo', req, page, function(err) {
        if (err) {
          return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
        }
        return res.send({ status: 'ok', page: page });
      });
    });
  });
};
