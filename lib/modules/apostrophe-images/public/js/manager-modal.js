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

      self.$el.on('change', 'input[type="checkbox"]', function(e) {
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
      
      // set checkbox to :checked, and trigger change event
      var $checkbox = $el.find('input[type="checkbox"]');

      // only toggle if either the checkbox is already checked
      // or the chooser is not full. Always release a checked box
      if ($checkbox.prop('checked') || (!(self.chooser && self.chooser.full))) {
        $el.toggleClass('apos-focus');
        $checkbox.prop('checked', function(i, currentState) { return !currentState; });
        $checkbox.trigger('change');
        $el.toggleClass('apos-focus', $checkbox.prop('checked'))
      }
    };

    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function() {
      self.$gridView = self.$el.find('.apos-manage-view');
      self.$gridItems = self.$el.find('.apos-manage-grid-piece');
      superAfterRefresh();
    };

    self.reflectChoiceInCheckbox = function(id) {
      self.$el.find('[data-piece="' + id + '"]').click();
    };

  }
});
