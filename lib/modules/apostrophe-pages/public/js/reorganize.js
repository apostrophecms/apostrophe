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
	        }
	        $li.find('.jqtree-element').append($('<span class="apos-reorganize-controls"></span>'));
	        // Append a link to the jqtree-element div.
	        // The link has a url '#node-[id]' and a data property 'node-id'.
	        var link = $('<a class="apos-visit" target="_blank"></a>');
	        link.attr('data-node-id', node.id);
	        link.attr('data-visit', '1');
	        link.attr('href', '#');
	        // link.text('»');
	        link.append('<i class="icon icon-external-link"></i>');
	        $li.find('.jqtree-element .apos-reorganize-controls').append(link);

	        if (node.publish) {
	          link = $('<a class="apos-delete"></a>');
	          link.attr('data-node-id', node.id);
	          link.attr('data-delete', '1');
	          link.attr('href', '#');
	          // link.text('x');
	          link.append('<i class="icon icon-trash"></i>');
	        }

	        $li.find('.jqtree-element .apos-reorganize-controls').append(link);
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

	    self.$tree.on('tree.move', function(e) {
	      self.move(e);
	      return false;
	    });

	    self.reload(callback);
    };

    // After a reorg the page URL may have changed, be prepared to
	  // navigate there or to the home page or just refresh to reflect
	  // possible new tabs
    self.afterHide = function(callback) {
      var page = apos.pages.options.page;
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
        self.$tree.tree('moveNode', node, trash, 'inside');
        _.each(data.changed, function(info) {
          var node = self.$tree.tree('getNodeById', info.id);
          if (node) {
            node.slug = info.slug;
          }
        });
      });
      return false;
  	};

  	self.move = function(e){
  		e.preventDefault();
      self.$el.find('.apos-reorganize-progress').fadeIn();
      var data = {
        movedId: e.move_info.moved_node.id,
        targetId: e.move_info.target_node.id,
        position: e.move_info.position
      };

      self.api('move', data, function(data){
      	if(data.status === 'ok'){
      		// Reflect changed slugs
	        _.each(data.changed, function(info) {
	          var node = self.$tree.tree('getNodeById', info.id);
	          if (node) {
	            node.slug = info.slug;
	          }
	        });
	        e.move_info.do_move();
	        self.$el.find('.apos-reorganize-progress').fadeOut();
      	} else{
      		self.errorOnMove();
      	}
      }, function(){
      	self.errorOnMove();
      });
  	};

  	self.reload = function(callback){
  		self.api('get-jqtree', {}, function(data){
  			if(data.status === 'ok'){
  				self.$tree.tree('loadData', data.tree);
			    if (callback) {
			      return callback();
			    }
  			} else {
  				self.errorOnReload();
  			}
  		}, function(){
  			self.errorOnReload();
  		});
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
