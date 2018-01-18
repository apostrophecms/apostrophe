apos.define('apostrophe-any-page-manager-chooser', {
  extend: 'apostrophe-doc-type-manager-chooser',
  browse: true,
  construct: function(self, options) {
    var superDecorateManager = self.decorateManager;
    self.decorateManager = function(manager, options) {
      superDecorateManager(manager, options);
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
      manager.afterHide = function() {
        // Don't redirect, we're operating as a normal modal
      };
    };
  }
});
