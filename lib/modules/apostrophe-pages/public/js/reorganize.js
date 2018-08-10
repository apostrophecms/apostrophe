/*
  This is a moog modal for the reorganize pages feature
*/

apos.define('apostrophe-pages-reorganize', {
  extend: 'apostrophe-modal',
  source: 'reorganize',
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

      self.reload(callback);
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
        var $link;
        $link = $('<a class="apos-edit" target="_blank"></a>');
        $link.attr('data-node-id', node.id);

        $link.attr('data-edit', '1');
        $link.append('Settings');
        // add published indicator
        $li.find('.jqtree-element .apos-reorganize-controls--published').append('<span class="apos-reorganize-published apos-reorganize-published--' + node.publish + '"></span>');

        $link.attr('href', '#');
        $li.find('.jqtree-element .apos-reorganize-controls--edit').append($link);
        self.addVisitLink(node, $li);

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

      return async.series([
        move,
        trash
      ], function(err) {
        if (err) {
          self.errorOnMove();
        }
        // Reflect changed slugs as needed
        _.each(data.changed, function(info) {
          var node = self.$tree.tree('getNodeById', info.id);
          if (node) {
            node.slug = info.slug;
          }
        });
        e.move_info.do_move();
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
          return apos.pages.trash(node.id, callback);
        } else {
          return apos.pages.rescue(node.id, callback);
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
      self.api('get-jqtree', {}, function(data) {
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
      self.$el.on('change', 'input[type="checkbox"]', function(e) {
        var $box = $(this);
        var id = $box.attr('value');
        if ($box.prop('checked')) {
          self.addChoice(id);
        } else {
          self.removeChoice(id);
        }
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
    };

    self.removeChoice = function(id) {
      self.removeChoiceFromState(id);
      self.reflectChoiceInCheckbox(id);
    };

    self.removeChoiceFromState = function(id) {
      self.choices = _.filter(self.choices, function(_id) {
        return id !== _id;
      });
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
      self.$el.find('input[type="checkbox"]').each(function() {
        ids.push($(this).attr('value'));
      });
      return ids;
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

    // Decorate at the end of the construct method, so that we can override
    // methods that were added by the decorator in subclasses.
    self.decorate();

  }
});
