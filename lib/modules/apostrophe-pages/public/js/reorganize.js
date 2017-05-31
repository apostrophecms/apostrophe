/*
  This is a moog modal for the reorganize pages feature
*/

apos.define('apostrophe-pages-reorganize', {
  extend: 'apostrophe-modal',
  source: 'reorganize',
  construct: function(self, options) {
    self.beforeShow = function(callback) {
      self.$tree = self.$el.find('[data-tree]');
      self.$tree.tree({
        data: [],
        autoOpen: 0,
        openFolderDelay: 2500,
        dragAndDrop: true,
        onCanMoveTo: function(moved_node, target_node, position) {
          // Cannot create peers of root
          if ((target_node.slug === '/') && (position !== 'inside')) {
            return false;
          }
          return true;
        },
        onCreateLi: function(node, $li) {
          // Identify the root trashcan and add a class to its li so that we
          // can hide inappropriate controls within the trash
          // TODO: do we want to make this slug a constant forever?
          if (node.slug == '/trash') {
            $li.addClass('apos-trash');
            if (self.options.trashInTree) {
              // Hide this node altogether, we're displaying trash "in place"
              $li.css('display', 'none');
            }
          }
          $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls"></span>'));
          // Append a link to the jqtree-element div.
          // The link has a url '#node-[id]' and a data property 'node-id'.
          var $link = $('<a class="apos-visit" target="_blank"></a>');
          $link.attr('data-node-id', node.id);
          $link.attr('data-visit', '1');
          $link.attr('href', '#');
          // link.text('»');
          $link.append('<i class="fa fa-external-link"></i>');
          $li.find('.jqtree-element .apos-reorganize-controls').append($link);
          if (node.publish) {
            // Regular "to the trash" button. CSS hides when
            // already in the trash
            $link = $('<a class="apos-delete"></a>');
            $link.attr('data-node-id', node.id);
            $link.attr('data-delete', '1');
            $link.attr('href', '#');
            $link.append('<i class="fa fa-trash"></i>');
            $li.find('.jqtree-element .apos-reorganize-controls').append($link);

            if (self.options.deleteFromTrash) {
              // "Destroy forever" button. CSS reveals when
              // already in the trash
              $link = $('<a class="apos-delete-from-trash"></a>');
              $link.attr('data-node-id', node.id);
              $link.attr('data-delete-from-trash', '1');
              $link.attr('href', '#');
              $link.append('<i class="fa fa-times"></i>');
              $li.find('.jqtree-element .apos-reorganize-controls').append($link);
            }
          }
        }
      });

      self.$tree.on('click', '[data-visit]', function() {
        self.visit($(this));
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

      self.$tree.on('tree.move', function(e) {
        self.move(e);
        return false;
      });

      self.reload(callback);
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

    self.visit = function($node){
      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);
      var tab = window.open(apos.prefix + node.slug, '_blank');
      tab.focus();
    };

    self.delete = function($node){
      if (!confirm('Are you sure you want to move this page to the trash?')) {
        return false;
      }

      var nodeId = $node.attr('data-node-id');
      var node = self.$tree.tree('getNodeById', nodeId);
      // Find the trashcan so we can mirror what happened on the server
      var trash;
      _.each(self.$tree.tree('getTree').children[0].children, function(node) {
        if (node.trash) {
          trash = node;
        }
      });
      if (!trash) {
        alert('No trashcan.');
        return false;
      }

      apos.pages.trash(node.id, function(err, parentSlug, changed) {
        if (err) {
          alert('An error occurred.');
          return;
        }
        if (self.options.trashInTree) {
          var parent = node.parent;
          self.$tree.tree('moveNode', node, parent.children[parent.children.length - 1], 'inside');
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
          alert('An error occurred.');
          return;
        }
        self.$tree.tree('removeNode', node);
      });
      return false;
    };

    self.move = function(e) {
      var trashing = false;
      e.preventDefault();
      self.$el.find('.apos-reorganize-progress').fadeIn();
      var data = {
        movedId: e.move_info.moved_node.id,
        targetId: e.move_info.target_node.id,
        position: e.move_info.position
      };

      if (e.move_info.target_node.virtualTrashcan) {
        // Actually moves into the parent, but also needs to get marked as trash
        data.targetId = e.move_info.target_node.parent;
      }
      
      return async.series([
        trash,
        move
      ], function(err) {
        if (err) {
          self.errorOnMove();
        }
        // Reflect changed slugs
        _.each(data.changed, function(info) {
          var node = self.$tree.tree('getNodeById', info.id);
          if (node) {
            node.slug = info.slug;
          }
        });
        e.move_info.do_move();
        self.$el.find('.apos-reorganize-progress').fadeOut();
      });
      
      function trash(callback) {
        if (!trashing) {
          return callback(null);
        }
        return apos.pages.trash(node.id, callback);
      }

      function move(callback) {
        return self.api('move', data, function(data) {
          if (data.status === 'ok') {
            changed = data.changed;
            return callback(null);
          } else {
            return callback(data.status);
          }
        }, function(err) {
          return callback(err);
        });
    };

    self.reload = function(callback){
      self.api('get-jqtree', {}, function(data) {
        if (data.status === 'ok') {
          if (self.options.trashInTree) {
            self.addVirtualTrashcans(data.tree);
          }
          self.$tree.tree('loadData', data.tree);
          console.log(data.tree);
          if (callback) {
            return callback();
          }
        } else {
          self.errorOnReload();
        }
      }, function() {
        self.errorOnReload();
      });
    };
    
    self.addVirtualTrashcans = function(tree) {
      _.each(tree, function(node) {
        self.addVirtualTrashcanIfNeeded(node);
      });
    };
    
    self.addVirtualTrashcanIfNeeded = function(node) {
      if (node.children && node.children.length) {
        var trashed = _.filter(node.children, { trash: true });
        var trash = {
          label: '🗑️',
          virtualTrashcan: true,
          children: trashed
        };
        node.children = _.filter(node.children, function(child) {
          return !child.trash;
        });
        _.each(node.children, function(child) {
          self.addVirtualTrashcanIfNeeded(child);
        });
        node.children.push(trash);
      }
    };

    self.errorOnReload = function(){
      alert('The server did not respond or you do not have the appropriate privileges.');
      self.hide();
    };

    self.errorOnMove = function(){
      alert('You may only move pages you are allowed to publish. If you move a page to a new parent, you must be allowed to edit the new parent.');

      setImmediate(function() {
        self.reload(function() {
          self.$el.find('.apos-reorganize-progress').fadeOut();
        });
      });
    };
  }
});
