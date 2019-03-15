
var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.createRoutes = function() {
    self.apiRoute('post', 'list', self.routes.listTags);
    self.apiRoute('post', 'add', self.routes.addTag);
    self.apiRoute('post', 'rename', self.routes.renameTag);
    self.apiRoute('post', 'delete', self.routes.deleteTag);
  };

  self.routes = {};

  // API returns an object with a `tags` array property.
  //
  // You may filter the list via `req.body.contains`,
  // `req.body.prefix`, `req.body.tags` (which will return
  // the same tags, less any that no longer exist in
  // the system) or `req.body.all` (the default).
  //
  // Useful for "manage tags" implementations and for
  // autocomplete.

  self.routes.listTags = async function(req) {
    const options = {
      contains: self.launder(req.body.contains),
      prefix: self.launder(req.body.prefix),
      tags: self.apos.launder.tags(req.body.tags),
      all: self.apos.launder.boolean(req.body.all)
    };
    const data = {};
    await self.emit('beforeListTags', req, options);
    data.tags = await self.listTags(req, options);
    await self.emit('afterListTags', req, options);
    return data;
  };

  // Adds the tag in `req.body.tag` if it does not already exist.
  self.routes.addTag = async function(req) {
    const tag = self.launder(req.body.tag);
    if (!tag.length) {
      throw 'invalid';
    }
    await self.emit('beforeAddTag', req, tag);
    await self.addTag(req, tag);
    await self.emit('afterAddTag', req, tag);
  };

  // Renames `req.body.tag` to `req.body.newTag`.
  self.routes.renameTag = async function(req, res) {
    var tag = self.launder(req.body.tag);
    var newTag = self.launder(req.body.newTag);
    if (!tag.length || !newTag.length) {
      throw 'invalid';
    }
    await self.emit('beforeRenameTag', req, tag, newTag);
    await self.renameTag(req, tag, newTag);
    await self.emit('afterRenameTag', req, tag, newTag);
  };

  // Deletes tag specified by `req.body.tag`.
  self.routes.deleteTag = async function(req) {
    const tag = self.launder(req.body.tag);
    if (!tag.length) {
      throw 'invalid';
    }
    await self.emit('beforeDeleteTag', req, tag);
    await self.deleteTag(req, tag);
    await self.emit('afterDeleteTag', req, tag);
  };

};
