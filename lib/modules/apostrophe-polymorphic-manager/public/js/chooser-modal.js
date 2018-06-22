// A "chooser" modal for multiple doc types simultaneously.

// Type name is `-manager` so that subclassing doc-type-manager will
// automatically gives us plumbing to create one.

apos.define('apostrophe-polymorphic-manager-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'polymorphic-chooser-modal',

  construct: function(self, options) {

    self.chooserViews = [];

    self.parentChooser = options.chooser;

    self.enableChooserViews = function() {
      _.each(self.options.chooser.field.withType, function(type) {
        var view = apos.docs.getManager(type).getTool('manager-modal', {
          decorate: self.decorateManager,
          liveChooser: self.chooser,
          source: 'chooser-modal',
          // source: 'chooser-view',
          transition: 'slide',
          $view: self.$el.find('[data-tab="' + type + '"]')
        });
        self.chooserViews.push(view);
      });
      self.$el.find('[data-tab-button]').removeClass('apos-active');
      self.$el.find('[data-tab-button]:first').addClass('apos-active');
      self.$el.on('click', '[data-tab-button]', function() {
        var tabName = $(this).attr('data-tab-button');
        self.$el.find('[data-tab-button]').removeClass('apos-active');
        $(this).addClass('apos-active');

        self.$el.find('[data-tab]').removeClass('apos-chooser-tab--active');
        self.$el.find('[data-tab="' + tabName + '"]').addClass('apos-chooser-tab--active');
        return false;
      });
      self.hideOthers();
    };

    self.hideOthers = function() {
      // Work around semantics of views
      self.$el.find('[data-tab]').hide();
      // self.$el.find('[data-tab]:first').show();
    };

    self.beforeShow = function(callback) {
      return self.enableChooser(function(err) {
        if (err) {
          return callback(err);
        }
        self.enableChooserViews();
        return callback(null);
      });
    };

    self.enableChooser = function(callback) {
      return self.parentChooser.clone(
        {
          $el: self.$el.find('[data-chooser]'),
          browse: false,
          autocomplete: false,
          change: self.reflectChoicesInCheckboxes,
          managerModal: self
        },
        function(err, chooser) {
          if (err) {
            return callback(err);
          }
          self.chooser = chooser;
          apos.on('pieceInserted', self.chooser.pieceInsertedListener);
          return callback(null);
        }
      );
    };

    self.saveContent = function(callback) {
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

    var superAfterHide = self.afterHide;
    self.afterHide = function() {
      apos.off('pieceInserted', self.chooser.pieceInsertedListener);
      return superAfterHide();
    };

    self.reflectChoicesInCheckboxes = function() {
      _.each(self.chooserViews, function(chooserView) {
        chooserView.reflectChoicesInCheckboxes();
      });
    };

    self.decorateManager = function(manager, options) {

      var superBeforeShow = manager.beforeShow;
      manager.beforeShow = function(callback) {
        manager.$el.find('.apos-chooser').remove();
        return superBeforeShow(callback);
      };

      manager.addChoiceToState = function(id) {
        self.chooser.add(id);
      };

      manager.removeChoiceFromState = function(id) {
        self.chooser.remove(id);
      };

      manager.getIds = function() {
        return _.pluck(self.chooser.choices, 'value');
      };

      var superReflectChoicesInCheckboxes = manager.reflectChoicesInCheckboxes;
      manager.reflectChoicesInCheckboxes = function() {
        superReflectChoicesInCheckboxes();
      };

      manager.clearChoices = function() {
        self.clear();
      };

      manager.saveContent = function(callback) {
        // We will wait for our own save operation as the
        // parent modal
        return callback(null);
      };

      manager.getConfirmCancelText = function() {
        return 'Are you sure you want to discard unsaved changes?';
      };

      // For page manager/chooser
      manager.enhanceNode = function(node, $li) {
        manager.addControlGroupToNode(node, $li);
        manager.configureTitleContainer(node, $li);
        manager.indentLevel(node, $li);
        // Add a checkbox for selection.
        var $checkbox = $('<input type="checkbox" name="selected" value="' + node.id + '" />');
        $li.find('.jqtree-element .apos-reorganize-title').before($checkbox);
        manager.addVisitLink(node, $li);

        // should disable actually reorganizing the page tree -stuart
      };

    };

  }
});
