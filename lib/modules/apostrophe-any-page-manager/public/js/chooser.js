apos.define('apostrophe-any-page-manager-chooser', {
  extend: 'apostrophe-doc-type-manager-chooser',
  browse: true,
  construct: function(self, options) {
    var superDecorateManager = self.decorateManager;
    self.decorateManager = function(manager, options) {
      superDecorateManager(manager, options);
      // Don't bomb if reorganize was overridden fully before this option was added
      manager.options.jqtree = manager.options.jqtree || {};
      // Don't cause "oops, reference to same object" problems for the next instantiation
      manager.options.jqtree = _.clone(manager.options.jqtree);
      // tell get-jqtree we want all the choices we can see (operating
      // as a chooser for a join), not just stuff we should be able to move around
      manager.options.jqtree.chooser = true;
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
