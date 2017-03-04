apos.define('apostrophe-array-editor-modal', {
  extend: 'apostrophe-modal',
  source: 'arrayEditor',
  transition: 'slide',
  chooser: true,
  construct: function(self, options) {

    // This method initializes the array editor and triggers either the creation
    // or the editing of the first item. In the latter case the list of items
    // is also implicitly loaded after first generating the item titles for the
    // list view. This method is invoked for you by `afterShow` and should not be
    // invoked again.

    self.load = function() {
      self.$arrayItems  = self.$el.find('[data-apos-array-items]');
      self.$arrayItem   = self.$el.find('[data-apos-array-item]');
      self.field        = options.field;
      self.arrayItems   = options.arrayItems || [];
      self.active       = 0;

      if (!self.arrayItems.length) {
        return self.createItem();
      } else {
        self.setItemTitles();
        return self.editItem();
      }
    };

    // This method generates the list view title for a single item, based
    // on the `titleField` property of the field. If there is none,
    // item._ordinal (the index of the item when it was first added
    // to the array during this editing session) is displayed.

    self.generateTitle = function(item) {
      return item[self.field.titleField] || ('#' + (item._ordinal));
    };


    // This method, called for you when the modal is about to display,
    // binds the various click handlers.

    self.beforeShow = function(callback) {
      self.bindClickHandlers();
      self.addSaveHandler();
      return callback(null);
    };

    // This method removes the "save" click handler after the modal is hidden,
    // necessary to ensure it does not fire again when a parent array is saved.
    
    self.afterHide = function() {
      self.removeSaveHandler();
    };

    // This method installs the `saveHandler` method as the click handler for
    // the outer modal's "save" button. It is invoked for you during `beforeShow`.

    self.addSaveHandler = function() {
      self.$save = self.$el.parents('[data-modal]').find('[data-apos-save-array-items]');
      self.$save.on('click', self.saveHandler);
    };
    
    // This method removes the save button handler. It is invoked for you
    // during `afterHide`.

    self.removeSaveHandler = function() {
      self.$save.off('click', self.saveHandler);
    };

    // This method saves the item state for the current item, then saves the
    // array as a whole and dismisses the modal via `hide`. It is invoked for
    // you when save is clicked.

    self.saveHandler = function() {
      self.saveItemState(function() {
        self.saveArray();
      });
    };

    // This method invokes the `load` method to populate the array and
    // prepare for editing. It is invoked for you as the modal becomes visible.

    self.afterShow = function() {
      self.load();
    };

    // This method adds a new item to the array. It is invoked
    // by `createItem`, which should be called instead if your intention
    // is to immediately display the new item in the item editor.

    self.addToItems = function() {
      var item = apos.schemas.newInstance(self.field.schema);
      _.assign(item, {
        _title: "New Item",
        id: apos.utils.generateId()
      });
      self.arrayItems.push(item);
      self.active = self.arrayItems.length - 1;
      self.refresh();
    };

    // This method sets the titles in the list view for all of the
    // current items by invoking the `generateTitle` method.

    self.nextOrdinal = 1;
    
    self.setItemTitles = function() {
      _.each(self.arrayItems, function(item, i) {
        if (!item._ordinal) {
          item._ordinal = self.nextOrdinal++;
        }
        // Pass the index for bc, but we don't really use that anymore,
        // we use item._ordinal
        item._title = self.generateTitle(item, i);
      });
    };

    // bc wrapper. This method was redundant. See `refresh`
    self.refreshItems = function() {
      return self.refresh();
    };

    // Adds a new item to the array, populating the form with its
    // initial default values from the schema. The list view is refreshed.

    self.createItem = function() {
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.addToItems();
        self.populateItem();
      });
    };

    // Like `createItem`, this method  asks the server for a
    // empty form; however, it then populates it with the currently
    // active item's content. The list view is refreshed.

    self.editItem = function() {
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.populateItem();
      });
    };

    // This method populates the editing form with the content of the
    // currently active item as determined by the array index `self.active`.
    // The list view is also refreshed.

    self.populateItem = function() {
      apos.schemas.populate(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err) {
        if (err) {
          console.error(err)
        }
        self.refresh();
      });
    };

    // This method saves the content of the currently active item
    // back to `self.arrayItems[self.active]` by invoking `convert` for
    // the schema fields, and also updates the `_title` property for the
    // list view.

    self.saveItemState = function(callback) {
      if (self.active === -1) {
        // We currently don't have an actively selected item to convert.
        return setImmediate(callback);
      }
      apos.schemas.convert(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err) {
        if (err) {
          console.error(err);
        }
        self.setItemTitles();
        return callback();
      });
    };

    // This method invokes `options.save` and passes `self.arrayItems` to it,
    // then dismisses the modal via `hide`.

    self.saveArray = function() {
      options.save(_.map(self.arrayItems, function(item) {
        return _.omit(item, '_ordinal');
      }));
      self.hide();
    };

    // This method binds click handlers for all elements inside
    // `self.$el`, the modal itself. The save handler is bound elsewhere
    // because it may reside in a parent modal.
    
    self.bindClickHandlers = function() {

      self.$el.on('click', '[data-apos-add-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        self.saveItemState(function(){
          self.createItem();
        });
      });

      self.$el.on('click', '[data-apos-array-items-trigger]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var $self = $(this);

        self.saveItemState(function() {
          self.active = $self.data('apos-array-items-trigger');
          self.editItem();
        });
      });

      self.$el.on('click', '[data-apos-move-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var $el = $(this);

        self.saveItemState(function() {
          var id = $el.closest('[data-id]').attr('data-id');
          var direction = $el.data('apos-move-array-item');
          var item = _.find(self.arrayItems, {id: id});
          var index = _.findIndex(self.arrayItems, {id: id});
          var newIndex;

          if (direction === 'up') {
            if (index <= 0) {
              return;
            }
            newIndex = index - 1;
          } else if (direction === 'down') {
            if (index >= self.arrayItems.length - 1) {
              return;
            }
            newIndex = index + 1;
          }
          var temp = self.arrayItems[index];
          self.arrayItems[index] = self.arrayItems[newIndex];
          self.arrayItems[newIndex] = temp;
          self.active = newIndex;
          self.editItem();
          self.setItemTitles();
          self.refresh();
        });
      });

      self.$el.on('click', '[data-apos-delete-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();

        var $self = $(this);
        var id = $self.closest('[data-id]').attr('data-id');

        if (id) {
          self.remove(id);
        }
        // If there are no array items left, go blank
        if (!self.arrayItems.length) {
          self.active = -1;
          return self.$arrayItem.html('');
        }
        // If we just removed the active array item, switch to the one
        // before this one.
        if (self.active === parseInt($self.closest('[data-apos-array-items-trigger]').attr('data-apos-array-items-trigger'))) {
          self.active = Math.max(parseInt(self.active) - 1, 0);
          self.editItem();
        }
      });
    };

    // This method removes the item with the specified `id` property from the
    // array. 

    self.remove = function(id) {
      self.arrayItems = _.filter(self.arrayItems, function(choice) {
        return choice.id !== id;
      });
      return self.refresh();
    };

    self.refreshing = 0;
    self.last = [];

    // Refresh (re-render) the list of items, then invoke the `onChange` method
    // if they differ from the previous set. This method is debounced. If calls to
    // this method are nested only two refreshes will take place: the initial one
    // and also the last one, to ensure the impact of any changes made in nested
    // function calls is seen. As a further optimization, only the last one actually
    // updates the markup in the browser.
    //
    // If a callback is passed, it is always invoked, even if this
    // refresh is being skipped as an optimization due to nesting.

    self.refresh = function(callback) {
      if (self.refreshing) {
        self.refreshing++;
        return callback && callback();
      }
      self.refreshing++;
      self.$arrayItems.html('');
      return self.html('arrayItems', { arrayItems: self.arrayItems, field: self.field }, function(html) {
        // If calls are nested make sure only the last one actually updates the
        // markup, as a visual optimization
        if (self.refreshing === 1) {
          self.$arrayItems.html(html);
        }
        self.decrementRefreshing();
        var compare = JSON.stringify(self.arrayItems);
        if (self.last !== compare) {
          self.last = compare;
          self.onChange();
        }
        return callback && callback();
      }, function(err) {
        self.decrementRefreshing();
        return callback && callback();
      });

    };
    
    // Invoked when the contents of the array have changed, after
    // a refresh of the display. Invokes the limit mechanism.

    self.onChange = function() {
      self.limit();
    };
    
    // Implements the `limit` option by showing and hiding
    // the limit message and the add button, respectively.

    self.limit = function() {
      if (!self.field.limit) {
        return;
      }
      if (self.arrayItems.length >= self.field.limit) {
        self.$el.find('[data-apos-add-array-item]').hide();
        self.$el.find('[data-apos-array-limit-reached]').show();
      } else {
        self.$el.find('[data-apos-add-array-item]').show();
        self.$el.find('[data-apos-array-limit-reached]').hide();
      }
    };

    // Invoked by `refresh` to decrement the count of nested
    // `refresh` calls. Nested `refresh` calls are automatically
    // debounced for performance, however the first and last both
    // result in actual renders by the server to ensure all
    // changes made in between are reflected.

    self.decrementRefreshing = function() {
      self.refreshing--;
      // If one or more additional refreshes have been requested, carrying out
      // one more is sufficient
      if (self.refreshing > 0) {
        self.refreshing = 0;
        self.refresh();
      }
    };
  }
});
