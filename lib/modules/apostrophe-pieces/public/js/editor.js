apos.define('apostrophe-pieces-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  construct: function(self, options) {
    console.log(options);
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
      console.log('IN CREATE');
      var piece = apos.schemas.newInstance(self.schema);
      return self.populate(piece, callback);
    };

    self.open = function(verb, data, callback) {
      console.log('IN OPEN');
      console.log(arguments);
      var url = self.options.action + '/' + verb;
      $.jsonCall(url, data, function(result) {
        if (result.status === 'notfound') {
          alert('That item does not exist.');
          return callback('error');
        } else if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return callback('error');
        }
        self._id = result.data._id;
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
      var piece = {
        _id: self._id
      };

      return async.series({
        before: function(callback) {
          return self.beforeConvert(piece, callback);
        },
        convert: function(callback) {
          return apos.schemas.convert(self.$form, self.schema, piece, callback);
        },
        after: function(callback) {
          return self.afterConvert(piece, callback);
        }
      }, function(err) {
        if (err) {
          console.log(err);
          return callback(err);
        }
        var verb = piece._id ? 'update' : 'insert';
        $.jsonCall(self.options.action + '/' + verb, piece, function(result) {
          if (result.status !== 'ok') {
            alert('An error occurred. Please try again.');
            return callback('error');
          }
          apos.change(result.data);
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
