apos.define('apostrophe-pieces-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  construct: function(self, options) {

    self.schema = options.schema;
    self._id = options._id;

    options.source = 'editor';

    self.beforeShow = function(callback) {
      self.$form = self.$el.find('[data-form]');
      if (self._id) {
        self.edit(self._id, callback);
      } else {
        self.create(callback);
      }
    };

    self.edit = function(_id, callback) {
      return self.open('retrieve', { _id: _id }, callback);
    };

    self.create = function(callback) {
      return self.open('insert', {}, callback);
    };

    self.open = function(verb, data, callback) {
      var url = self.options.action + '/' + verb;
      $.jsonCall(url, data, function(result) {
        if (result.status === 'notfound') {
          alert('That item does not exist.');
          return callback('error');
        } else if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return callback('error');
        }
        return self.populate(result.data, callback);
      }, function() {
        alert('An error occurred. Please try again.');
        return callback('network');
      });
    };

    self.populate = function(piece, callback) {
      return async.series({
        beforePopulate: function(callback) {
          return self.beforePopulate(piece, callback);
        },
        populate: function(callback) {
          return apos.schemas.populate(self.$form, self.schema, piece, callback);
        },
        afterPopulate: function(callback) {
          return self.afterPopulate(piece, callback);
        }
      }, callback);
    };

    self.beforePopulate = function(piece, callback) {
      return setImmediate(callback);
    };

    self.afterPopulate = function(piece, callback) {
      return setImmediate(callback);
    };

    self.save = function(callback) {
      var piece = {};

      return async.series({
        before: function(callback) {
          return self.beforeConvert(self, piece, callback);
        },
        convert: function(callback) {
          return apos.schemas.convert(self.$form, self.schema, piece, callback);
        },
        after: function(callback) {
          return self.afterConvert(self, piece, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        piece._id = self._id;
        $.jsonCall(self.options.action + '/update', piece, function(result) {
          if (result.status !== 'ok') {
            alert('An error occurred. Please try again.');
            return callback('error');
          }
          return callback(null);
        }, function() {
          alert('An error occurred. Please try again');
          return callback(err);
        });
      });
    };

    self.beforeConvert = function(piece, callback) {
      return setImmediate(callback);
    };

    self.afterConvert = function(piece, callback) {
      return setImmediate(callback);
    };

  }
});
