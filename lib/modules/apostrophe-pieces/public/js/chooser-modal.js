apos.define('apostrophe-pieces-chooser-modal', {
  extend: 'apostrophe-pieces-manager-modal',
  source: 'chooser',
  transition: 'slide',
  beforeConstruct: function(self, options) {
    options.body = options.body || {};
    options.body.chooser = true;
  },

  construct: function(self, options) {
    self.parentChooser = self.options.chooser;

    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      return superBeforeShow(function() {
        return self.enableChooser(callback);
      });
    };

    self.enableChooser = function(callback) {
      if (!self.parentChooser) {
        return setImmediate(callback);
      }
      self.enableCheckboxEventsForChooser();
      return self.parentChooser.clone(
        { $el: self.$el.find('[data-chooser]'), browse: false, autocomplete: false, change: self.reflectChooserInCheckboxes },
        function(err, chooser) {
          if (err) {
            return callback(err);
          }
          self.chooser = chooser;
          return callback(null);
        }
      );
    };

    self.reflectChooserInCheckboxes = function() {
      if (!self.chooser) {
        return;
      }
      return self.chooser.get(function(err, choices) {
        if (err) {
          return;
        }
        self.$el.find('[data-piece] input[type="checkbox"]').each(function() {
          var $box = $(this);
          var id = $box.closest('[data-piece]').attr('data-piece');
          $box.prop('checked', !!_.find(choices, { value: id }));
        });
      });
    };

    self.enableCheckboxEventsForChooser = function() {
      self.$el.on('change', '[data-piece] input[type="checkbox"]', function() {
        // in rare circumstances, might not be ready yet, don't crash
        if (!self.chooser) {
          return;
        }
        var method = $(this).prop('checked') ? self.chooser.add : self.chooser.remove;
        method($(this).closest('[data-piece]').attr('data-piece'));
      });
    };

    self.saveContent = function(callback) {
      if (!self.chooser) {
        // This should not happen, but be graceful
        return callback(null);
      }
      // Pass our choices back to the chooser hanging out in a schema form that
      // initially triggered us via "browse"
      return self.chooser.get(function(err, choices) {
        if (err) {
          return callback(err);
        }
        self.parentChooser.set(choices);
        return callback(null);
      });
    };

    self.afterRefresh = function() {
      self.reflectChooserInCheckboxes();
    }
  }

});
