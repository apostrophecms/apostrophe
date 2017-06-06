apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
    self.action = options.action;
  },
  construct: function(self, options) {
    self.managers = {};

    self.getManager = function(type) {
      return self.managers[type];
    };

    self.setManager = function(type, manager) {
      self.managers[type] = manager;
    };

    // A mixin that adds the "in the trash" checkbox UI to any modal
    // that wants it, such as the page editor or pieces editor. 
    // Requires a context object (the modal itself) and a doc.
    // Adds an `inTrash` method to the modal which can be used to
    // determine the user's choice. The initial choice is determined
    // by the value of `doc.trash`.
    
    self.inTrashMixin = function(context, doc) {
      context.$inTrash = context.$el.find('[data-apos-in-trash]');
      context.$inTrashCheckbox = context.$inTrash.find('[name="trash"]');
      context.inTrash = function() {
        return context.$inTrashCheckbox.prop('checked');
      };
      if (apos.pages.options.trashInTree) {
        context.$inTrash.show();
      }
      context.$inTrashCheckbox.on('change', function() {
        if ($(this).prop('checked')) {
          context.$inTrash.addClass('apos-in-trash--active');
        } else {
          context.$inTrash.removeClass('apos-in-trash--active');
        }
      });
      if (doc.trash) {
        context.$inTrashCheckbox.prop('checked', true);
      }
      context.$inTrashCheckbox.trigger('change');
    };
    
    apos.docs = self;
  }
});
