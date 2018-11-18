var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function(self, options) {

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: self.name,
      partial: self.fieldTypePartial,
      converters: self.converters
    });
  };

  self.fieldTypePartial = function(data) {
    return self.partial('attachment', data);
  };

  self.converters = {
    string: async function(req, data, name, object, field) {
      // TODO would be interesting to support filenames mapped to a
      // configurable folder, with sanitization
    },
    form: async function(req, data, name, object, field) {
      let info = data[name];
      if (typeof (info) !== 'object') {
        info = {};
      }
      info = _.pick(info, '_id', 'crop');
      info._id = self.apos.launder.id(info._id);
      if (!info._id) {
        object[name] = null;
      }
      info.crop = info.crop ? self.sanitizeCrop(info.crop) : undefined;
      const dbInfo = await self.db.findOne({ _id: info._id });
      if (!dbInfo) {
        object[name] = null;
        return;
      }
      _.assign(info, _.omit(dbInfo, 'crop'));
      if (!self.acceptableExtension(field, info)) {
        throw 'invalid';
      }
      if (info.crop) {
        if (!_.find(info.crops, info.crop)) {
          info.crop = null;
        }
      }
      info.used = true;
      await self.db.updateOne({ _id: info._id }, info);
      object[name] = info;
    }
  };

  self.indexer = function(value, field, texts) {
    const silent = (field.silent === undefined) ? true : field.silent;
    texts.push({ weight: field.weight || 15, text: value.title, silent: silent });
  };

  self.acceptableExtension = function(field, attachment) {
    const groups = field.fileGroups || (field.fileGroup && [ field.fileGroup ]);
    let extensions;
    if (groups) {
      if (!_.contains(groups, attachment.group)) {
        extensions = [];
        _.each(groups, function(group) {
          var groupInfo = _.find(self.options.fileGroups, { name: group });
          if (!groupInfo) {
            return;
          }
          extensions = extensions.concat(groupInfo.extensions);
        });
        return false;
      }
    }
    extensions = field.extensions || (field.extension && [ field.extension ]);
    if (extensions) {
      if (!_.contains(extensions, attachment.extension)) {
        return false;
      }
    }
    return true;
  };

};
