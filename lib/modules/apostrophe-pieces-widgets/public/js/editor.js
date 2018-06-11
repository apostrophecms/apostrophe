apos.define('apostrophe-pieces-widgets-editor', {
  extend: 'apostrophe-widgets-editor',
  construct: function(self, options) {

    // Clone two levels deep so we can add hints without modifying original
    self.schema = _.map(self.schema, function(field) {
      return _.clone(field);
    });

    var join = _.find(self.schema, { name: '_pieces' });
    if (join) {
      _.defaults(join, { hints: {} });
      _.defaults(join.hints, { limit: options.limit });
    }

    self.shouldSkipModal = function() {
      return (self.schema.length === 2) && (self.schema[0].name === 'by') && (self.schema[1].name === '_pieces');
    };

    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      return superBeforeShow(function(err) {
        if (err) {
          return callback(err);
        }
        if (self.shouldSkipModal()) {
          // We're not visible but we still have a role to play. We don't want to rewrite
          // all of the chooser logic for orchestrating "browse" to work without us
          self.$el.css('opacity', 0);
          // TODO: better support for "nominal" modals in modal.js so that we don't have to
          // kill the ability to have the manage modal slide in over whatever preceded this
          self.$el.removeClass('apos-modal-slideable');
          self.chooser = self.$el.find('[data-chooser]:first').data('aposChooser');
        }
        return callback(null);
      });
    };

    var superAfterShow = self.afterShow;
    self.afterShow = function() {
      superAfterShow();
      if (self.shouldSkipModal()) {
        var superAfterManagerSave = self.chooser.afterManagerSave;
        self.chooser.afterManagerSave = function() {
          superAfterManagerSave();
          self.save();
        };
        var superAfterManagerCancel = self.chooser.afterManagerCancel;
        self.chooser.afterManagerCancel = function() {
          superAfterManagerCancel();
          self.$el.css('opacity', 1);
          self.cancel();
        };
        self.chooser.launchBrowser();
      }
    };
  }
});
