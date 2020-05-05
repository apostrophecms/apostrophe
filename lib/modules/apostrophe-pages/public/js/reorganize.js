/*
  This is a moog modal for the reorganize pages feature
*/

apos.define('apostrophe-pages-reorganize', {
  extend: 'apostrophe-modal',
  source: 'reorganize',
  // options to be POSTed to get-jqtree, empty in the base class
  jqtree: {},
  construct: function(self, options) {

    self.choices = [];

    self.beforeShow = function(callback) {
      self.$tree = self.$el.find('[data-tree]');
      self.$tree.tree({
        data: [],
        autoOpen: 0,
        openFolderDelay: 2500,
        dragAndDrop: true,
        onCanMoveTo: function(movedNode, targetNode, position) {
          // Cannot create peers of root
          if ((targetNode.slug === '/') && (position !== 'inside')) {
            return false;
          }
          return true;
        },
        onCreateLi: function(node, $li) {
          self.enhanceNode(node, $li);
        }
      });

      self.$tree.on('click', '[data-visit]', function() {
        self.visit($(this));
        return false;
      });

      self.$tree.on('click', '[data-edit]', function() {
        self.edit($(this));
        self.updateVirtualTrashcans();
        return false;
      });

      self.$tree.on('click', '[data-delete]', function() {
        self.delete($(this));
        return false;
      });

      self.$tree.on('click', '[data-delete-from-trash]', function() {
        self.deleteFromTrash($(this));
        return false;
      });

      self.$tree.on('tree.click', function(e) {

        // Disable single selection, which we don't use for anything right now
        e.preventDefault();

      });

      self.$tree.on('tree.move', function(e) {
        self.move(e);
        return false;
      });

      self.enableCheckboxEvents();
      self.enableSelectAll();
      self.$batch = self.$el.find('[data-batch]');
      self.$batchOperation = self.$batch.find('[name="batch-operation"]');
      return async.series([ self.enableBatchOperations, self.reload ], callback);
    };

    // Enhance a node in the tree with additional elements.
    // jqtree doesn't template these, and running nunjucks for
    // each one would be a big perf hit with big trees anyway.
    // So we add controls directly to `$li` as needed.

    self.enhanceNode = function(node, $li) {
      // Identify the root trashcan and add a class to its li so that we
      // can hide inappropriate controls within the trash
      // TODO: do we want to make this slug a constant forever?
      if (node.type === 'trash') {
        $li.addClass('apos-trash');
      } else if (node.virtualTrashcan) {
        $li.addClass('apos-trash');
      }

      self.configureTitleContainer(node, $li);
      self.indentLevel(node, $li);

      if (!node.virtualTrashcan) {
        self.addControlGroupToNode(node, $li);

        // Add a checkbox for selection.
        var $checkbox = $('<input type="checkbox" name="selected" value="' + node.id + '" />');
        $li.find('.jqtree-element .apos-reorganize-title').before($checkbox);

        var $link;
        $link = $('<a class="apos-edit" target="_blank"></a>');
        $link.attr('data-node-id', node.id);

        $link.attr('data-edit', '1');
        $link.append('Settings');
        // add published indicator
        $li.find('.jqtree-element .apos-reorganize-controls--published').append('<span class="apos-reorganize-published apos-reorganize-published--' + node.published + '"></span>');

        $link.attr('href', '#');
        $li.find('.jqtree-element .apos-reorganize-controls--edit').append($link);
        self.addVisitLink(node, $li);

        // node.publish means we CAN PUBLISH IT, not that it IS PUBLISHED.
        // See node.published. -Tom
        if (node.publish) {
          // Regular "to the trash" button. CSS hides when
          // already in the trash
          $link = $('<a class="apos-delete"></a>');
          $link.attr('data-node-id', node.id);
          $link.attr('data-delete', '1');
          $link.attr('href', '#');
          $link.append('Move to Trash');
          $li.find('.jqtree-element .apos-reorganize-controls--trash').append($link);

          if (self.options.deleteFromTrash) {
            // "Destroy forever" button. CSS reveals when
            // already in the trash
            $link = $('<a class="apos-delete-from-trash"></a>');
            $link.attr('data-node-id', node.id);
            $link.attr('data-delete-from-trash', '1');
            $link.attr('href', '#');
            $link.append('Delete from Trash');
            $li.find('.jqtree-element .apos-reorganize-controls--trash').append($link);
          }
        }
      }
    };

    self.addControlGroupToNode = function(node, $li) {
      $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls apos-reorganize-controls--published"></span>'));
      $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls apos-reorganize-controls--edit"></span>'));
      $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls apos-reorganize-controls--link"></span>'));
      $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls apos-reorganize-controls--trash"></span>'));
    };

    self.indentLevel = function(node, $li) {
      // add page depth as data attr
      $li.attr('data-apos-reorganize-depth', node.getLevel());
      if (node.getLevel() !== 1) {
        $li.find('.apos-reorganize-title').css('padding-left', 15 * node.getLevel() + 'px');
      }
    };

    self.configureTitleContainer = function(node, $li) {
      var $titleContainer = $('<span class="apos-reorganize-title"></span>');
      $titleContainer.append($li.find('.jqtree-title'));
      if ($li.find('.jqtree-toggler').length === 0) {
        $titleContainer.addClass('apos-reorganize-title--no-toggle');
      } else {
        $titleContainer.prepend($li.find('.jqtree-toggler'));
      }

      $li.find('.jqtree-element').prepend($titleContainer);
    };

    // Add button used to visit the page
    self.addVisitLink = function(node, $li) {
      // Append a link to the jqtree-element div.
      // The link has a url '#node-[id]' and a data property 'node-id'.
      var $link = $('<a class="apos-visit" target="_blank"></a>');
      $link.attr('data-node-id', node.id);
      $link.attr('data-visit', '1');
      $link.attr('href', '#');
      // link.text('»');
      // $link.append('<i class="fa fa-external-link"></i>');
      $link.append('Link');
      $li.find('.jqtree-element .apos-reorganize-controls--link').append($link);
    };

    // After a reorg the page URL may have changed, be prepared to
    // navigate there or to the home page or just refresh to reflect
    // possible new tabs
    self.afterHide = function() {
      var page = apos.pages.page;
      var _id = page._id;
      self.api('info', { _id: _id }, function(data) {
        if (data.status !== 'ok') {
          // WTF, go home
          apos.ui.redirect('/');
        }
        var newPathname = data.page.slug.replace(/^\/\//, '/');
        apos.ui.redirect(newPathname);
      }, function() {
        // If the page no longer exists, navigate away to home page
        apos.ui.redirect('/');
      });
    };

    self.visit = function($node) {
      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);
      var tab = window.open(apos.prefix + node.slug, '_blank');
      tab.focus();
    };

    self.edit = function($node) {
      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);
      var isTrash = node.trash;
      apos.create('apostrophe-pages-editor-update', {
        action: self.options.action,
        page: { type: node.type, _id: node.id },
        afterSave: function(page, callback) {
          // Update the node and reflect any change in trash status.
          var node = self.$tree.tree('getNodeById', page._id);
          if (node) {
            var newNode = _.pick(node, 'children', 'id');
            _.assign(newNode, _.pick(page, 'slug', 'type', 'trash'));
            newNode.label = page.title;
            self.$tree.tree('updateNode', node, newNode);
            if (isTrash && (!newNode.trash)) {
              // Ceased to be trash, move it out of virtual trashcan
              self.$tree.tree('moveNode', node, node.parent.parent, 'inside');
            } else if (newNode.trash && (!isTrash)) {
              // Became trash, move it into virtual trashcan
              var parent = node.parent;
              var virtualTrashcan = _.find(parent.children, { virtualTrashcan: true });
              self.$tree.tree('moveNode', node, virtualTrashcan, 'inside');
            }
          }
          return callback(null);
        },
        redirectIfSamePage: false
      });
    };

    self.delete = function($node) {
      if (!confirm('Are you sure you want to move this page to the trash?')) {
        return false;
      }

      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);
      var parent = node.parent;
      // Find the trashcan so we can mirror what happened on the server
      var trash;
      if (apos.docs.trashInSchema) {
        trash = parent.children[parent.children.length - 1];
      } else {
        _.each(self.$tree.tree('getTree').children[0].children, function(node) {
          if (node.trash) {
            trash = node;
          }
        });
      }
      if (!trash) {
        apos.notify('No trashcan.', { type: 'error', dismiss: true });
        return false;
      }

      apos.pages.trash(node.id, function(err, parentSlug, changed) {
        if (err) {
          apos.notify('An error occurred.', { type: 'error', dismiss: true });
          return;
        }
        if (apos.docs.trashInSchema) {
          self.$tree.tree('moveNode', node, trash, 'inside');
          self.updateVirtualTrashcans();
        } else {
          self.$tree.tree('moveNode', node, trash, 'inside');
          _.each(changed, function(info) {
            var node = self.$tree.tree('getNodeById', info.id);
            if (node) {
              node.slug = info.slug;
            }
          });
        }
      });
      return false;
    };

    self.deleteFromTrash = function($node) {

      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);

      var warning = 'Are you sure you want to DESTROY THIS PAGE FOREVER? This CANNOT BE UNDONE.';
      if (node.children && node.children.length) {
        warning = 'Are you sure you want to DESTROY THIS PAGE AND ALL OF ITS CHILD PAGES FOREVER? This CANNOT BE UNDONE.';
      }
      if (!confirm(warning)) {
        return false;
      }

      apos.pages.deleteFromTrash(node.id, function(err, parentSlug) {
        if (err) {
          apos.notify('An error occurred.', { type: 'error', dismiss: true });
          return;
        }
        self.$tree.tree('removeNode', node);
        self.updateVirtualTrashcans();
      });
      return false;
    };

    self.move = function(e) {
      var trashing;
      e.preventDefault();
      self.$el.find('.apos-reorganize-progress').fadeIn();
      var data = {
        movedId: e.move_info.moved_node.id,
        targetId: e.move_info.target_node.id,
        position: e.move_info.position
      };

      // Refuse requests to move something before the
      // home page, or after it (as a peer). Inside it is fine
      var target = e.move_info.target_node;
      if ((!target.parent.parent) && (e.move_info.position !== 'inside')) {
        return;
      }
      // You also can't move something after the conventional trashcan
      if ((target.type === 'trash') && (!target.virtualTrashcan) && (e.move_info.position === 'after')) {
        return;
      }

      if (apos.docs.trashInSchema) {
        if (e.move_info.target_node.virtualTrashcan) {
          if ((e.move_info.position === 'before') || (e.move_info.position === 'after')) {
            var after = e.move_info.target_node.getPreviousSibling();
            if (after) {
              data.position = 'after';
              data.targetId = after.id;
            } else {
              data.position = 'inside';
              data.targetId = e.move_info.target_node.parent.id;
            }
          } else {
            // "inside" case
            // Actually moves into the parent, but also needs to get marked as trash
            data.targetId = e.move_info.target_node.parent.id;
            trashing = true;
          }
        } else if (e.move_info.moved_node.trash && (!e.move_info.target_node.trash)) {
          // Moving out of a virtual trashcan
          trashing = false;
        }
      }

      var changed = [];

      return async.series([
        move,
        trash
      ], function(err) {
        if (err) {
          self.errorOnMove();
        }
        e.move_info.do_move();

        _.each(changed, function(doc) {
          var node = self.$tree.tree('getNodeById', doc.id);
          if (node) {
            node.slug = doc.slug;
            node.trash = doc.trash;
          }
        });

        self.updateVirtualTrashcans();
        self.$el.find('.apos-reorganize-progress').fadeOut();
      });

      function move(callback) {
        if ((data.position === 'inside') && (data.targetId === trueParentId(e.move_info.moved_node))) {
          // It's just a change of trash status
          return callback(null);
        }
        return self.api('move', data, function(data) {
          if (data.status === 'ok') {
            changed = changed.concat(data.changed);
            return callback(null);
          } else {
            return callback(data.status);
          }
        }, function(err) {
          return callback(err);
        });
      }

      function trash(callback) {
        if (trashing === undefined) {
          return callback(null);
        }
        var node = e.move_info.moved_node;
        if (trashing) {
          return apos.pages.trash(node.id, function(err, parentSlug, _changed) {
            changed = changed.concat(_changed);
            return callback(err);
          });
        } else {
          return apos.pages.rescue(node.id, function(err, parentSlug, _changed) {
            changed = changed.concat(_changed);
            return callback(err);
          });
        }
      }

      function trueParentId(node) {
        if (!node.parent) {
          return;
        }
        if (!node.parent.virtualTrashcan) {
          return node.parent.id;
        }
        return trueParentId(node.parent);
      }

    };

    self.reload = function(callback) {
      self.api('get-jqtree', options.jqtree, function(data) {
        if (data.status === 'ok') {
          if (apos.docs.trashInSchema) {
            // Remove the standard Apostrophe trash can from the displayed tree,
            // unless it already has content
            var trashIndex = _.findIndex(data.tree[0].children, { slug: '/trash' });
            if (trashIndex !== -1) {
              var trash = data.tree[0].children[trashIndex];
              if (!trash.children.length) {
                data.tree[0].children.splice(trashIndex, 1);
              }
            }
            addVirtualTrashcan(data.tree[0]);
          }
          self.$tree.tree('loadData', data.tree);
          self.updateVirtualTrashcans();
          if (callback) {
            return callback();
          }
        } else {
          self.errorOnReload();
        }
      }, function() {
        self.errorOnReload();
      });

      function addVirtualTrashcan(node) {
        var trashed = _.filter(node.children || [], { trash: true });
        var regular = _.filter(node.children || [], function(node) {
          return !node.trash;
        });
        if (trashed.length || regular.length) {
          var trashcan = {
            label: 'Trash',
            id: apos.utils.generateId(),
            virtualTrashcan: true,
            children: trashed
          };
          node.children = regular.concat([ trashcan ]);
        }
        _.each(regular, addVirtualTrashcan);
      }

    };

    self.updateVirtualTrashcans = function() {
      self.updateVirtualTrashcan(self.$tree.tree('getTree').children[0]);
    };

    self.updateVirtualTrashcan = function(node) {
      if (!apos.docs.trashInSchema) {
        return;
      }
      var trashcan = _.find(node.children || [], { virtualTrashcan: true });
      var trashed = _.filter(node.children || [], { trash: true });
      var regular = _.filter(node.children || [], function(node) {
        return !(node.trash || node.virtualTrashcan);
      });
      if (trashcan && (!trashcan.children.length) && (!regular.length)) {
        self.$tree.tree('removeNode', trashcan);
      } else if ((!trashcan) && (trashed.length || regular.length)) {
        trashcan = {
          label: 'Trash',
          id: apos.utils.generateId(),
          virtualTrashcan: true
        };
        self.$tree.tree('appendNode', trashcan, node);
        trashcan = self.$tree.tree('getNodeById', trashcan.id);
        // Reverse the array, otherwise "inside" will put the
        // last first
        trashed.reverse();
        _.each(trashed, function(child) {
          self.$tree.tree('moveNode', child, trashcan, 'inside');
        });
      }
      _.each(node.children || [], function(node) {
        if (node.virtualTrashcan) {
          return;
        }
        self.updateVirtualTrashcan(node);
      });
    };

    self.errorOnReload = function() {
      apos.notify('The server did not respond or you do not have the appropriate privileges.', { type: 'error' });
      self.hide();
    };

    self.errorOnMove = function() {
      apos.notify('You may only move pages you are allowed to publish. If you move a page to a new parent, you must be allowed to edit the new parent.', { type: 'error' });

      setImmediate(function() {
        self.reload(function() {
          self.$el.find('.apos-reorganize-progress').fadeOut();
        });
      });
    };

    self.decorate = function() {
      if (options.decorate) {
        options.decorate(self, options);
      }
    };

    // Currently called by chooser, later perhaps used
    // to manage pages too

    self.enableCheckboxEvents = function() {

      self.$el.on('change', 'input[name="selected"][type="checkbox"]', function(e) {
        var $box = $(this);
        var id = $box.attr('value');
        if ($box.prop('checked')) {
          self.addChoice(id);
        } else {
          self.removeChoice(id);
        }
      });

      // Add ability to select multiple checkboxes (Using Left Shift)
      var lastChecked;
      self.$el.on('click', 'input[name="selected"][type="checkbox"]', function (e) {

        // Store a variable called lastchecked to point to the last checked checkbox. If it is undefined it's the first checkbox that's selected.
        if (!lastChecked) {
          lastChecked = this;
          return;
        }

        // If shift key is pressed and the checkbox is checked.
        if (e.shiftKey && this.checked) {
          // Get the siblings for the checkboxes that are being checked.
          var $checkboxesInScope = $(this).closest('ul.jqtree_common').find('input') || [];
          // Get the Index of the currently selected checkbox. (The one checked with holiding shift)
          var startIndex = $checkboxesInScope.index(this);
          // Get the index of the previously selected checkbox.
          var endIndex = $checkboxesInScope.index(lastChecked);
          // Get a list of all checkboxes inbetween both the indexes and make them checked.
          $checkboxesInScope.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1).each(function (i, el) {
            $(el).prop('checked', true);
            $(el).trigger('change');
          });
        }
        lastChecked = this;
      });

    };

    self.addChoice = function(id) {
      self.addChoiceToState(id);
      self.reflectChoiceInCheckbox(id);
    };

    self.addChoiceToState = function(id) {
      if (!_.contains(self.choices, id)) {
        self.choices.push(id);
      }
      self.reflectChoiceCount();
    };

    self.removeChoice = function(id) {
      self.removeChoiceFromState(id);
      self.reflectChoiceInCheckbox(id);
    };

    self.removeChoiceFromState = function(id) {
      self.choices = _.filter(self.choices, function(_id) {
        return id !== _id;
      });
      self.reflectChoiceCount();
    };

    // Return just the ids of the choices. Subclasses
    // might need to extend this to avoid returning
    // other data associated with a choice. Unlike get()
    // this does not require a callback
    self.getIds = function() {
      return self.choices;
    };

    self.clearChoices = function() {
      self.choices = [];
      self.reflectChoiceCount();
    };

    // Reflect existing choices in checkboxes.

    self.reflectChoicesInCheckboxes = function() {
      _.each(self.getVisibleIds(), function(id) {
        // Trigger click to do the right thing if progressive
        // enhancement is in play.
        self.reflectChoiceInCheckbox(id);
      });
    };

    self.getVisibleIds = function() {
      var ids = [];
      self.$el.find('input[name="selected"][type="checkbox"]').each(function() {
        ids.push($(this).attr('value'));
      });
      return ids;
    };

    self.enableSelectAll = function() {
      self.$el.on('change', '[name="select-all"]', function() {
        var checked = $(this).prop('checked');
        var ids = self.getVisibleIds();
        if (checked) {
          _.each(ids, function(id) {
            self.addChoiceToState(id);
          });
        } else {
          self.clearChoices();
        }
        self.reflectChoicesInCheckboxes();
      });
    };

    self.reflectSelectAll = function() {
      var $selectAll = self.$el.find('[name="select-all"]');
      if (self.getVisibleIds().length === self.choices.length) {
        $selectAll.prop('checked', true);
      } else {
        $selectAll.prop('checked', false);
      }
    };

    // Reflect the current selection state of the given id
    // by checking or unchecking the relevant box, if
    // currently visible

    self.reflectChoiceInCheckbox = function(id) {
      var state = _.includes(self.getIds(), id);
      self.displayChoiceInCheckbox(id, state);
    };

    // Return a jquery object referencing the checkbox for the given piece id
    self.getCheckbox = function(id) {
      return self.$el.find('input[type="checkbox"][value="' + id + '"]');
    };

    // Set the display state of the given checkbox. returns
    // a jQuery object referencing the checkbox, for the convenience
    // of subclasses that extend this
    self.displayChoiceInCheckbox = function(id, checked) {
      var $checkbox = self.getCheckbox(id);
      $checkbox.prop('checked', checked);
      return $checkbox;
    };

    self.reflectChoiceCount = _.debounce(function() {
      // indirection so overrides work
      self.reflectChoiceCountBody();
    });

    self.reflectChoiceCountBody = function() {
      self.reflectBatchOperation();
      self.reflectSelectAll();
    };

    // Enables batch operations, such as moving every selected
    // item to the trash. Maps the operations found in options.batchOperations
    // to methods, for instance `{ name: 'trash'}` maps to
    // a call to `self.batchTrash()`. Also implements the UI for
    // selecting and invoking a batch operation.

    self.enableBatchOperations = function(callback) {
      self.$batchOperationTemplate = self.$batchOperation.clone();
      self.batchOperations = self.options.batchOperations;
      self.reflectBatchOperation();
      self.$batchOperation.on('change', function() {
        self.reflectBatchOperation();
      });
      self.link('apos-batch-operation', function($el, action) {
        self.batchOperations[action].handler();
        return false;
      });
      return async.eachSeries(self.batchOperations, function(batchOperation, callback) {
        return self.enableBatchOperation(batchOperation, callback);
      }, callback);
    };

    // Invoked when a new batch operation is chosen to reflect it in the UI
    // by displaying the appropriate button and, where relevant, the
    // appropriate string field. Also invoked when the manage view is refreshed,
    // so that filters can impact which operations are currently enabled.

    self.reflectBatchOperation = function() {

      if (!self.$batchOperation.length) {
        // Batch operations not present
        return;
      }

      // We just want to hide the options you can't pick right now,
      // but that's not possible with option elements, so we have to
      // rebuild the list each time this is an issue and then remove
      // the inappropriate items. What a PITA.

      var val = self.$batchOperation.val();

      // TODO bring back code from manager-modal that determines which

      var $selected = self.$batchOperation.find('[value="' + val + '"]');
      if ($selected.length) {
        self.$batchOperation.val(val);
      } else {
        self.$batchOperation[0].selectedIndex = 0;
        val = self.$batchOperation.val();
      }

      self.$batch.find('[data-apos-batch-operation-form]').removeClass('apos-active');
      self.$batch.find('[data-apos-batch-operation-form="' + val + '"]').addClass('apos-active');
      self.$batch.find('[data-apos-batch-operation]').addClass('apos-hidden');
      self.$batch.find('[data-apos-batch-operation="' + val + '"]').removeClass('apos-hidden');

      // Reflect current count of selected items
      var count = self.getIds().length;
      self.$batch.find('[name="batch-operation"] option').each(function() {
        var $option = $(this);
        $option.text($option.text().replace(/\([\d]+\)/, '(' + count + ')'));
      });

      // Availability based on whether there is a selection

      var $buttons = self.$batch.find('.apos-button');
      if (count) {
        $buttons.removeClass('apos-button--disabled');
      } else {
        $buttons.addClass('apos-button--disabled');
      }

    };

    self.batchOperations = {};

    // Preps for supporting a single batch operation, matching the operation name
    // to a method name such as `batchTrash` via the `name` property.
    // Also populates the subform for it, if any. Requires callback.
    // Invoked for you by `enableBatchOperations`. Do not invoke directly.

    self.enableBatchOperation = function(batchOperation, callback) {
      self.batchOperations[batchOperation.name] = batchOperation;
      batchOperation.handler = self['batch' + apos.utils.capitalizeFirst(apos.utils.camelName(batchOperation.name))];
      if (!batchOperation.schema) {
        return setImmediate(callback);
      }
      var data = apos.schemas.newInstance(batchOperation.schema);
      return apos.schemas.populate(
        self.$batch.find('[data-apos-batch-operation-form="' + batchOperation.name + '"]'),
        batchOperation.schema,
        data,
        callback
      );
    };

    // Moves all selected items (`self.choices`) to the trash, after
    // asking for user confirmation.

    self.batchTrash = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'trash',
          'Are you sure you want to trash ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + '?',
          {}
        );
      }
    };

    // Rescues all selected items (`self.choices`) from the trash, after
    // asking for user confirmation.

    self.batchRescue = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'rescue',
          'Are you sure you want to rescue ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + ' from the trash?',
          {}
        );
      }
    };

    // Publishes all selected items (`self.choices`), after asking for
    // user confirmation.

    self.batchPublish = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'publish',
          'Are you sure you want to publish ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + '?',
          {}
        );
      }
    };

    // Unpublishes all selected items (`self.choices`), after asking for
    // user confirmation.

    self.batchUnpublish = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'unpublish',
          'Are you sure you want to unpublish ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + '?',
          {}
        );
      }
    };

    // Tags all selected items (`self.choices`), after asking for
    // user confirmation.

    self.batchTag = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'tag',
          'Are you sure you want to tag ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + '?',
          {}
        );
      }
    };

    // Untags all selected items (`self.choices`), after asking for
    // user confirmation.

    self.batchUntag = function() {
      if (self.choices.length > 0) {
        return self.batchSimple(
          'untag',
          'Are you sure you want to untag ' + self.choices.length + ' item' + (self.choices.length !== 1 ? 's' : '') + '?',
          {}
        );
      }
    };

    // Carry out a named batch operation, such as `trash`, displaying the
    // provided prompt and, if confirmed by the user, invoking the
    // corresponding verb in this module's API.
    //
    // `options.dataSource` can be used to specify a function
    // to be invoked to gather more input before calling the API.
    // It receives `(data, callback)`, where `data.ids` and any
    // input gathered from the schema are already present, and
    // should update `data` and invoke `callback` with
    // null on success or with an error on failure.
    //
    // `options.success` is invoked only if the operation
    // succeeds. It receives `(result, callback)` where
    // `result` is the response from the API and `callback`
    // *must* be invoked by the success function after
    // completing its additional operations, even if the user
    // chooses to cancel or skip those operations.

    self.batchSimple = function(operationName, confirmationPrompt, options) {

      var operation = self.batchOperations[operationName];

      if (!confirm(confirmationPrompt)) {
        return;
      }

      var data = {
        ids: self.choices,
        job: true
      };

      // So we don't still say "unpublish (4)" when there are
      // now 0 visible things after unpublishing all 4
      self.clearChoices();

      return async.series([ convert, dataSource, save ], function(err) {
        if (err) {
          if (Array.isArray(err)) {
            // Schemas module already highlighted it
            return;
          }
          apos.notify(err, { type: 'error' });
          self.reflectChoicesInCheckboxes();
          self.reload();
          return;
        }
        self.reflectChoicesInCheckboxes();
        self.reload();
      });

      function convert(callback) {
        if (!operation.schema) {
          return callback(null);
        }
        return apos.schemas.convert(
          self.$batch.find('[data-apos-batch-operation-form="' + operationName + '"]'),
          operation.schema,
          data,
          {},
          callback
        );
      }

      function dataSource(callback) {
        if (!options.dataSource) {
          return callback(null);
        }
        return options.dataSource(data, callback);
      }

      function save(callback) {
        apos.ui.globalBusy(true);
        return self.api(operation.route || operationName, data, function(result) {
          apos.ui.globalBusy(false);
          if (result.status !== 'ok') {
            return callback('An error occurred. Please try again.');
          }
          if (result.jobId) {
            var jobs = apos.modules['apostrophe-jobs'];
            return jobs.progress(result.jobId, {
              success: function(result) {
                if (options.success) {
                  return options.success(result, callback);
                } else {
                  return callback(null);
                }
              },
              change: 'apostrophe-page'
            });
          }
          if (options.success) {
            return options.success(result, callback);
          } else {
            return callback(null);
          }
        }, function() {
          apos.ui.globalBusy(false);
          return callback('An error occurred. Please try again.');
        });
      }

    };

    // Decorate at the end of the construct method, so that we can override
    // methods that were added by the decorator in subclasses.
    self.decorate();

  }
});
