// A "chooser" modal for multiple doc types simultaneously.

// Type name is `-manager` so that subclassing doc-type-manager will
// automatically gives us plumbing to create one.

apos.define('apostrophe-polymorphic-manager-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'polymorphic-chooser-modal',

  construct: function(self, options) {

    self.chooserViews = [];

    self.chooser = options.chooser;

    self.enableChooserViews = function() {
      _.each(self.options.chooser.field.withType, function(type) {
        var $view = apos.docs.getManager(type).getTool('manager-modal', {
          decorate: options.decorate,
          chooser: self.chooser,
          // source: 'chooser-view',
          transition: 'slide',
          $view: self.$el.find('[data-tab="' + type + '"]')
        });
        self.chooserViews.push($view);
      });
      self.$el.find('[data-tab-button]').removeClass('apos-active');
      self.$el.find('[data-tab-button]:first').addClass('apos-active');
      self.$el.on('click', '[data-tab-button]', function() {
        console.log('click');
        var tabName = $(this).attr('data-tab-button');
        self.$el.find('[data-tab-button]').removeClass('apos-active');
        $(this).addClass('apos-active');
        self.$el.find('[data-tab]').hide();
        self.$el.find('[data-tab="' + tabName + '"]').show();
        return false;
      });
      self.hideOthers();
    };

    self.hideOthers = function() {
      // Work around semantics of views
      self.$el.find('[data-tab]').hide();
      self.$el.find('[data-tab]:first').show();
    };

    self.beforeShow = function(callback) {
      self.enableChooserViews();
      return callback();
    };

  }
});
