let _ = require('lodash');

module.exports = function(self, options) {

  // Render the editor for page settings. Expects
  // req.body.type, req.body.verb (update or insert or copy),
  // req.body._id (only for update or copy)

  self.apiRoute('post', 'editor', async function(req) {
    const type = self.apos.launder.string(req.body.type);
    const verb = self.apos.launder.string(req.body.verb);
    const _id = self.apos.launder.id(req.body._id);
    const manager = self.apos.docs.getManager(type);
    if (!manager) {
      throw 'notfound';
    }
    let schema;
    let parentPage;
    if (verb === 'update') {
      const trash = self.apos.docs.trashInSchema ? null : false;
      const page = await self.find(req, { _id: _id }).ancestors(true).permission('edit-doc').trash(trash).toObject();
      if (!page) {
        throw 'notfound';
      }
      parentPage = page._ancestors && page._ancestors.length && page._ancestors[page._ancestors.length - 1];
      if (!parentPage) {
        // convert 0 to null
        parentPage = null;
      }
      schema = self.allowedSchema(req, page, parentPage);
      // We modified it, we have to bless the new version
      self.apos.schemas.bless(req, schema);
    } else if (verb === 'copy') {
      // id supplied was that of a peer
      const peerPage = await self.find(req, { _id: _id }).ancestors(true).toObject();
      if (!peerPage) {
        throw 'notfound';
      }
      parentPage = peerPage._ancestors && peerPage._ancestors[0] && peerPage._ancestors[peerPage._ancestors.length - 1];
      let child = self.newChild(parentPage);
      if (!child) {
        throw 'invalid';
      }
      schema = self.allowedSchema(req, child, parentPage);
    } else {
      // id supplied was that of the parent
      parentPage = await self.find(req, { _id: _id }).permission('edit-doc').toObject();
      if (!parentPage) {
        throw 'notfound';
      }
      let child = self.newChild(parentPage);
      if (!child) {
        throw 'invalid';
      }
      schema = self.allowedSchema(req, child, parentPage);
    }
    return self.render(req, 'editor', { schema: schema, verb: verb, trashInSchema: self.apos.docs.trashInSchema });
  });

  // Fetch data needed to edit and ultimately insert a page.
  // Expects `req.body._id`, returns an object with `page`
  // and `schema` properties

  self.apiRoute('post', 'fetch-to-insert', async function(req) {
    // parent id
    const _id = req.body._id;
    const type = self.apos.launder.string(req.body.type);
    if (!self.apos.docs.getManager(type)) {
      throw 'notfound';
    }
    const parentPage = await self.find(req, { _id: _id }).permission('edit-apostrophe-page').toObject();
    if (!parentPage) {
      throw 'notfound';
    }
    let child = self.newChild(parentPage);
    if (!child) {
      throw 'invalid';
    }
    return {
      page: child,
      schema: self.allowedSchema(req, child, parentPage)
    };
  });

  // API route to actually insert the page. Page data should
  // be in `req.body`, with the special property `req.body._parentId`
  // indicating the parent page. Returns the inserted page

  self.apiRoute('post', 'insert', async function(req) {
    const parentId = self.apos.launder.id(req.body._parentId);
    const page = req.body;
    if ((typeof page) !== 'object') {
      // cheeky
      throw 'notfound';
    }
    const parentPage = await self.find(req, { _id: parentId }).permission('edit-apostrophe-page').toObject();
    let safePage = self.newChild(parentPage);
    if (!safePage) {
      throw 'invalid';
    }
    const manager = self.apos.docs.getManager(self.apos.launder.string(page.type));
    if (!manager) {
      // sneaky
      throw 'notfound';
    }
    // Base the allowed schema on a generic new child of the parent page, not
    // random untrusted stuff from the browser
    let schema = self.allowedSchema(req, safePage, parentPage);
    await self.apos.schemas.convert(req, schema, 'form', page, safePage);
    await self.insert(req, parentPage, safePage);
    // Refind it to get properties like `_url` etc.
    return self.find(req, { _id: safePage._id }).published(null).toObject();
  });

  // Fetch data needed to edit and ultimately update a page.
  // Expects req.body._id, req.body.type. Returns an object
  // with `page` and `schema` properties.

  self.apiRoute('post', 'fetch-to-update', async function(req) {
    let _id = self.apos.launder.id(req.body._id);
    let type = self.apos.launder.string(req.body.type);
    if (!self.apos.docs.getManager(type)) {
      throw 'notfound';
    }
    const page = await self.find(req, { _id: _id }).ancestors(true).permission('edit-apostrophe-page').trash(self.apos.docs.trashInSchema ? null : false).toObject();
    if (!page) {
      throw 'notfound';
    }
    let parentPage = page._ancestors && page._ancestors.length && page._ancestors[page._ancestors.length - 1];
    if (!parentPage) {
      // convert 0 to null
      parentPage = null;
    }
    let schema = self.allowedSchema(req, page, parentPage);
    // We modified it, we have to bless the new version
    self.apos.schemas.bless(req, schema);
    return {
      page,
      schema
    };
  });

  // Updates a page. Page data should be in `req.body`.
  // Returns the updated page object.

  self.apiRoute('post', 'update', async function(req) {
    const _id = self.apos.launder.id(req.body.currentPageId);
    let page = req.body;
    if ((typeof page) !== 'object') {
      // cheeky
      throw 'notfound';
    }
    const existingPage = await self.find(req, { _id: page._id }).ancestors(true).permission('edit-apostrophe-page').trash(self.apos.docs.trashInSchema ? null : false).toObject();
    if (!existingPage) {
      throw 'notfound';
    }
    const parentPage = existingPage._ancestors && existingPage._ancestors.length && existingPage._ancestors[existingPage._ancestors.length - 1];
    const manager = self.apos.docs.getManager(self.apos.launder.string(page.type || existingPage.type));
    if (!manager) {
      throw 'notfound';
    }
    let schema = self.allowedSchema(req, page, parentPage);
    schema = self.addApplyToSubpagesToSchema(schema);
    schema = self.removeParkedPropertiesFromSchema(existingPage, schema);
    await self.apos.schemas.convert(req, schema, 'form', page, existingPage);
    await self.update(req, existingPage);
    // Fetch the page. Yes, we already have it, but this way all the cursor
    // filters run and we have access to ._url
    return self.find(req, { _id: existingPage._id }).published(null).trash(self.apos.docs.trashInSchema ? null : false).toObject();
  });

  // Fetch data needed to copy a page.

  self.apiRoute('post', 'fetch-to-copy', async function(req) {
    const _id = self.apos.launder.id(req.body._id);
    const type = self.apos.launder.string(req.body.type);
    const manager = self.apos.docs.getManager(type);
    if (!manager) {
      throw 'notfound';
    }
    const page = await self.find(req, { _id: _id }).ancestors(true).permission('edit-apostrophe-page').toObject();
    const parentPage = page._ancestors && page._ancestors[0] && page._ancestors[page._ancestors.length - 1];
    const schema = self.allowedSchema(req, page, parentPage);
    // We modified it, we have to bless the new version
    self.apos.schemas.bless(req, schema);
    return {
      page,
      schema
    };
  });

  // Fetch data needed to insert a copied page. Currently identical to insert
  // except that the parent page id is determined differently

  self.apiRoute('post', 'copy', async function(req) {
    const currentPageId = self.apos.launder.id(req.body.currentPageId);
    const page = req.body.page || {};
    if ((typeof page) !== 'object') {
      // cheeky
      throw 'notfound';
    }
    const currentPage = await self.find(req, { _id: _id }).permission('edit-apostrophe-page').ancestors({ permission: false }).toObject();
    if (!currentPage) {
      throw 'notfound';
    }
    if (!currentPage._ancestors.length) {
      throw 'notfound';
    }
    const siblingPage = currentPage;
    const parentPage = currentPage._ancestors[currentPage._ancestors.length - 1];
    if (!parentPage._publish) {
      throw 'notfound';
    }
    const safePage = self.newChild(parentPage);
    if (!safePage) {
      throw 'invalid';
    }
    // Base the allowed schema on a generic new child of the parent page, not
    // random untrusted stuff from the browser
    const schema = self.allowedSchema(req, safePage, parentPage);
    await self.apos.schemas.convert(req, schema, 'form', page, safePage);
    // Copy top-level area properties which are not part of the schema
    // (introduced via apos.area)
    _.each(siblingPage, function(val, key) {
      // Don't let typeof(null) === 'object' bite us
      if (val && (typeof (val) === 'object') && (val.type === 'area')) {
        safePage[key] = val;
      }
    });
    // Chance to override and copy more non-schema content
    await self.emit('beforeCopy', req, siblingPage, parentPage, safePage);
    await self.insert(req, parentPage, safePage);
    // Fetch the page. Yes, we already have it, but this way all the cursor
    // filters run and we have access to ._url
    return self.find(req, { _id: safePage._id }).published(null).toObject();
  });

  self.apiRoute('post', 'move', async function(req) {
    const changed = await self.move(req, self.apos.launder.id(req.body.movedId), self.apos.launder.id(req.body.targetId), self.apos.launder.string(req.body.position));
    return {
      changed: self.mapMongoIdToJqtreeId(changed)
    };
  });

  self.apiRoute('post', 'move-to-trash', async function(req) {
    const { parentSlug, changed } = await self.moveToTrash(req, self.apos.launder.id(req.body._id));
    return {
      changed: self.mapMongoIdToJqtreeId(changed),
      parentSlug
    };
  });

  self.apiRoute('post', 'rescue-from-trash', async function(req) {
    const { parentSlug, changed } = await self.rescueInTree(req, self.apos.launder.id(req.body._id));
    return {
      changed: self.mapMongoIdToJqtreeId(changed),
      parentSlug
    };
  });

  self.apiRoute('post', 'delete-from-trash', async function(req) {
    // TODO this API must be touched up to return a suitable object
    return self.deleteFromTrash(req, self.apos.launder.id(req.body._id));
  });

  self.apiRoute('post', 'get-jqtree', async function(req) {
    const page = await self.find(req, { level: 0 }).children({ depth: 1000, published: null, trash: null, orphan: null, reorganize: true, areas: false, permission: false }).published(null).trash(null).reorganize(true).toObject();
    if (!page) {
      throw 'notfound';
    }
    // jqtree supports more than one top level node, so we have to pass an array
    let data = [ pageToJqtree(page) ];
    // Prune pages we can't reorganize
    data = clean(data);
    return {
      tree: data
    };

    // Recursively build a tree in the format jqtree expects
    function pageToJqtree(page) {
      let info = {
        label: page.title,
        slug: page.slug,
        id: page._id,
        // For icons
        type: page.type,
        // Also nice for icons and browser-side decisions about what's draggable where
        trash: page.trash,
        published: page.published,
        publish: (page.path === '/trash') || self.apos.permissions.can(req, 'edit-apostrophe-page', page),
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
            let forJqtree = pageToJqtree(child);
            if (self.apos.docs.trashInSchema) {
              forJqtree.label = self.apos.i18n.__('Legacy Trash');
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
        let newNodes = [];
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

  // REST-like API returning basic information about the page,
  // no joins or area loading
  self.apiRoute('post', 'info', async function(req) {
    return self.find(req, { _id: self.apos.launder.id(req.body._id) }).published(null).areas(false).trash(null).joins(false).toObject();
  });

  // Implement the publish route, which can publish
  // one page (via req.body._id) or many (via req.body.ids).
  // The `page` property of the API response will contain the page
  // only for the `req.body._id` case. This does not insert new]
  // pages, it marks existing pages as published.

  self.apiRoute('post', 'publish', async function(req) {
    return self.batchSimpleRoute(req, 'publish', async function(req, page, data) {
      page.published = true;
      // Returning the promise to be awaited is a little faster than awaiting it
      // and then being awaited ourselves
      return self.update(req, page);
    });
  });

  // Implement the unpublish route, which can publish
  // one page (via req.body._id) or many (via req.body.ids).

  self.route('post', 'unpublish', async function(req) {
    return self.batchSimpleRoute(req, 'unpublish', function(req, page, data) {
      page.published = false;
      return self.update(req, page);
    });
  });

  // Implement the tag route, which can tag
  // one page (via `req.body._id`) or many (via `req.body.ids`).
  // The tags to be added are in the `req.body.tags` array.

  self.route('post', 'tag', async function(req) {
    return self.batchSimpleRoute(req, 'tag', function(req, page, data) {
      if (!page.tags) {
        page.tags = [];
      }
      page.tags = _.uniq(page.tags.concat(data.tags));
      return self.update(req, page);
    });
  });

  // Implement the untag route, which can untag
  // one page (via `req.body._id`) or many (via `req.body.ids`).
  // The tags to be removed are in `req.body.tags`.

  self.route('post', 'untag', async function(req) {
    return self.batchSimpleRoute(req, 'untag', function(req, page, data) {
      if (!page.tags) {
        return;
      }
      let removing = data.tags;
      page.tags = _.filter(page.tags, function(tag) {
        return !_.includes(removing, tag);
      });
      return self.update(req, page);
    });
  });

  // Implement the batch trash route, which can trash
  // many pages (via req.body.ids) and responds with a job id.

  self.route('post', 'trash', async function(req) {
    return self.batchSimpleRoute(req, 'trash', async function(req, page, data) {
      if (page.trash) {
        return;
      }
      if (self.apos.docs.trashInSchema) {
        return self.trashInSchema(req, page._id, true);
      } else {
        return self.moveToTrash(req, page._id);
      }
    });
  });

  // Implement the batch rescue route, which can rescue
  // many pages (via req.body.ids) and responds with a job id.
  // Cannot be invoked when trashInSchema is false, as there
  // is no sensible way to place them when they return to
  // the tree - better to drag them out of the trash.

  self.route('post', 'rescue', async function(req, res) {
    return self.batchSimpleRoute(req, 'rescue', function(req, page, data) {
      if (!page.trash) {
        return;
      }
      if (self.apos.docs.trashInSchema) {
        return self.trashInSchema(req, page._id, false);
      } else {
        throw 'invalid';
      }
    });
  });

};
