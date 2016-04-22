// Image Gallery

apos.define('apostrophe-images-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',

  construct: function(self, options) {

    // save manager so we can call edit() later
    self.manager = apos.docs.getManager(options.name);

    var superEnableButtonEvents = self.enableButtonEvents;
    self.enableButtonEvents = function() {
      // focus on single click
      self.$el.on('click', '[data-focus-' + options.name + ']', function(e) {
        e.preventDefault();
        self.focusElement( $(this) );
      });

      self.$el.on('afterChange', 'input[type="checkbox"]', function(e) {
        $(this).parent('label').toggleClass('apos-focus', $(this).prop('checked'))
      });

      // edit on dobule click
      self.$el.on('dblclick', '[data-edit-dbl-' + options.name + ']', function() {
        var id = $(this).attr('data-edit-dbl-' + options.name);
        self.manager.edit(id);
      });

      // toggle selection mode on checkmark select
      superEnableButtonEvents();
    };

    self.focusElement = function($el) {
      $el.toggleClass('apos-focus');

      // set checkbox to :checked, and trigger change event
      var $checkbox = $el.find('input[type="checkbox"]');
      $checkbox.prop('checked', function(i, currentState) { return !currentState; });
      $checkbox.trigger('change');
      $el.toggleClass('apos-focus', $checkbox.prop('checked'))
      // $checkbox.trigger('afterChange');
    };


    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function() {
      self.$gridView = self.$el.find('.apos-manage-view');
      self.$gridItems = self.$el.find('.apos-manage-grid-piece');
      superAfterRefresh();
    };

  }
});
