// Image Gallery

apos.define('apostrophe-images-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',

  construct: function(self, options) {

    // save manager so we can call edit() later
    self.manager = apos.docs.getManager(options.name);

    // variables for select mode
    self.selectCount = 0;

    var superEnableButtonEvents = self.enableButtonEvents;
    self.enableButtonEvents = function() {
      // focus on single click
      self.$el.on('click', '[data-focus-' + options.name + ']', function() {
        if (!self.selectCount) {
          return self.focusElement( $(this) );
        } else {
          self.selectCount = ($(this).is('.apos-selected')) ? self.selectCount-1 : self.selectCount+1
          $(this).toggleClass('apos-selected');

          if (self.selectCount > 0) {
            self.enterSelectionMode();
          } else {
            self.exitSelectionMode();
          }
        }
      });

      // edit on dobule click
      self.$el.on('dblclick', '[data-edit-dbl-' + options.name + ']', function() {
        var id = $(this).attr('data-edit-dbl-' + options.name);
        self.manager.edit(id);
      });

      // checkbox
      self.$el.on('change', '[name="'+ options.name+'-select"]', function(){
        // add selected state to parent
        $(this).parents('.apos-manage-grid-piece').toggleClass('apos-selected');

        if ($(this).is(':not(.apos-selected)') && $(this).is(':checked')) {
          self.selectCount++;
        } else {
          self.selectCount--;
        }

        if (self.selectCount > 0) {
          self.enterSelectionMode();
        } else {
          self.exitSelectionMode();
        }
      });

      // toggle selection mode on checkmark select
      superEnableButtonEvents();
    };

    self.focusElement = function($focusedElm) {
      // self.$gridItems.removeClass('apos-focus');
      $focusedElm.toggleClass('apos-focus');
    };

    self.enterSelectionMode = function(){
        // toggle sidebar selection view
        // self.$gridView.addClass('apos-selection-mode');

        // toggle focus state for all elms
        self.$gridItems.addClass('apos-focus');
    };

    self.exitSelectionMode = function() {
      // toggle sidebar selection view
      self.$gridView.removeClass('apos-selection-mode');
      // toggle focus state for all elms
      self.$gridItems.removeClass('apos-focus');
      // toggle selected state for all elms
      self.$gridItems.removeClass('apos-selected');
      // uncheck all checkboxes
      self.$gridItems.find('input[type="checkbox"]').attr('checked', false);

    };

    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function() {
      self.$gridView = self.$el.find('.apos-manage-view');
      self.$gridItems = self.$el.find('.apos-manage-grid-piece');
      superAfterRefresh();
    };

  }
});
