// A "chooser" modal for multiple doc types simultaneously.

apos.define('apostrophe-polymorphic-chooser-modal', {
  extend: 'apostrophe-modal',
  source: 'polymorphic-chooser-modal',

  construct: function(self, options) {

    self.chooserViews = [];

    self.enableChooserViews = function() {
      _.each(self.chooser.field.withType, function(type) {
        self.chooserViews.push(apos.docs.getManager(type).getTool('manager-modal', {
          decorate: options.decorate,
          chooser: self.chooser,
          source: 'chooser-view',
          transition: 'slide',
          $view: self.$el.find('[data-tab][data-type="' + type + '"]')
        }));
      });
    };

    self.beforeShow = function(callback) {
      self.enableChooserViews();
      return callback();
    };

  }
});
