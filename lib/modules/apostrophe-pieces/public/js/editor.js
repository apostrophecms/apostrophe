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
      self.link('trash', function($el) {
        self.trash($el);
      });
    };

    self.edit = function(_id, callback) {
      return self.open('retrieve', { _id: _id }, callback);
    };

    self.create = function(callback) {
      var piece = apos.schemas.newInstance(self.schema);
      return self.populate(piece, callback);
    };

    self.open = function(verb, data, callback) {
      self.api(verb, data, function(result) {
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
        self.api(verb, piece, function(result) {
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

    self.trash = function($el, next) {
      if (self.trashing || !confirm("Are you sure you want to trash this " + self.options.label + "?")) {
        return;
      }

      var piece = {
        _id: self._id
      };

      self.trashing = true;
      $el.addClass('apos-busy');

      self.api('trash', piece, function(result) {
        self.trashing = false;
        $el.removeClass('apos-busy');
        if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          if (next) {
            return next('error');
          }
          return;
        }
        apos.modalSupport.closeTopModal();
        if (next) {
          return next(null);
        }
        return;
      }, function() {
        self.trashing = false;
        $el.removeClass('apos-busy');
        alert('An error occurred. Please try again');
        if (next) {
          return next(err);
        }
        return;
      });
    };
  }
});
