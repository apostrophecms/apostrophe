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
    string: function(req, data, name, object, field, callback) {
      // TODO would be interesting to support filenames mapped to a
      // configurable folder, with sanitization
      return setImmediate(callback);
    },
    form: function(req, data, name, object, field, mainCallback) {
      var info = data[name];
      if (typeof (info) !== 'object') {
        info = {};
      }
      info = _.pick(info, '_id', 'crop');
      info._id = self.apos.launder.id(info._id);
      if (!info._id) {
        object[name] = null;
        return setImmediate(mainCallback);
      }
      info.crop = info.crop ? self.sanitizeCrop(info.crop) : undefined;
      return async.series({
        find: function(callback) {
          return self.db.findOne({ _id: info._id }, function(err, trueInfo) {
            if (err) {
              return callback(err);
            }
            if (!trueInfo) {
              object[name] = null;
              return setImmediate(mainCallback);
            }
            _.assign(info, _.omit(trueInfo, 'crop'));
            if (!self.acceptableExtension(field, info)) {
              return callback('invalid');
            }
            if (info.crop) {
              if (!_.find(info.crops, info.crop)) {
                info.crop = null;
              }
            }
            return callback(null);
          });
        },
        update: function(callback) {
          info.used = true;
          return self.db.update({ _id: info._id }, info, callback);
        }
      }, function(err) {
        if (err) {
          return mainCallback(err);
        }
        object[name] = info;
        return mainCallback(null);
      });
    }
  };

  self.indexer = function(value, field, texts) {
    var silent = (field.silent === undefined) ? true : field.silent;
    texts.push({ weight: field.weight || 15, text: value.title, silent: silent });
  };

  self.acceptableExtension = function(field, attachment) {
    var groups = field.fileGroups || (field.fileGroup && [ field.fileGroup ]);
    var extensions;
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
