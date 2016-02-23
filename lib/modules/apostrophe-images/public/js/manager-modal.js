// Image Gallery

apos.define('apostrophe-images-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',

  construct: function(self, options) {

    // save manager so we can call edit() later
    self.manager = apos.docs.getManager(options.name);


    var superEnableButtonEvents = self.enableButtonEvents;
    self.enableButtonEvents = function() {
      // focus on single click
      self.$el.on('click', '[data-focus-' + options.name + '], input[type="checkbox"]', function(e) {
        e.preventDefault();
        self.focusElement( $(this) );
      });

      // edit on dobule click
      self.$el.on('dblclick', '[data-edit-dbl-' + options.name + ']', function() {
        var id = $(this).attr('data-edit-dbl-' + options.name);
        self.manager.edit(id);
      });

      // toggle selection mode on checkmark select
      superEnableButtonEvents();
    };

    self.focusElement = function($focusedElm) {
      // self.$gridItems.removeClass('apos-focus');
      $focusedElm.toggleClass('apos-focus');

      // set checkbox to :checked, and trigger change event
      var checkbox = $focusedElm.find('input[type="checkbox"]');
      checkbox.prop('checked', function(i, currentState) { return !currentState; });
      checkbox.trigger('change');
    };


    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function() {
      self.$gridView = self.$el.find('.apos-manage-view');
      self.$gridItems = self.$el.find('.apos-manage-grid-piece');
      superAfterRefresh();
    };

  }
});
