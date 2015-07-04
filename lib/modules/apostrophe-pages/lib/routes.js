var async = require('async');

module.exports = function(self, options) {

  self.route('post', 'editor', function(req, res) {
    var def = self.typeChoices[0];
    var manager = self.apos.docs.getManager(def.name);
    return res.send(self.render(req, 'editor', { schema: manager.schema }));
  });

  self.route('post', 'fetch-to-insert', function(req, res) {
    // parent id
    var _id = req.body._id;
    return self.find(req, { _id: _id }).permission('publish-doc').toObject(function(err, parentPage) {
      if (err) {
        console.error(err);
        return res.send({ status: 'error' });
      }
      if (!parentPage) {
        return res.send({ status: 'notfound' });
      }
      var child = self.newChild(parentPage);
      return res.send({ status: 'ok', data: child, schema: self.apos.docs.getManager(child.type).schema });
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
    var safePage = {};
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
          return callback(null);
        });
      },
      convert: function(callback) {
        var manager = self.getManager(self.apos.launder.string(page.type));
        if (!manager) {
          // sneaky
          return callback('notfound');
        }
        var schema = manager.schema;
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

};
