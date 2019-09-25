apos.define('apostrophe-array-editor-modal', {
  extend: 'apostrophe-modal',
  source: 'arrayEditor',
  transition: 'slide',
  chooser: true,
  construct: function(self, options) {

    self.error = options.error;
    self.errorPath = options.errorPath;

    // This method initializes the array editor and triggers either the creation
    // or the editing of the first item. In the latter case the list of items
    // is also implicitly loaded after first generating the item titles for the
    // list view. This method is invoked for you by `afterShow` and should not be
    // invoked again.

    self.load = function() {
      self.$arrayItems = self.$el.find('[data-apos-array-items]');
      self.$arrayItem = self.$el.find('[data-apos-array-item]');
      self.field = options.field;
      self.arrayItems = options.arrayItems || [];
      self.originalArrayItems = _.cloneDeep(self.arrayItems);
      if (self.errorPath && self.errorPath[0]) {
        self.active = parseInt(self.errorPath[0]);
      } else {
        self.active = 0;
      }
      if (!self.arrayItems.length) {
        return self.createItem();
      } else {
        self.setItemTitles();
        return self.editItem();
      }
    };

    self.beforeCancel = function(callback) {
      // We must modify arrayItems in place, the calling code expects us
      // to modify that array by reference and won't understand if we
      // just reassign to the property
      self.arrayItems.splice(0, self.arrayItems.length);
      _.each(self.originalArrayItems, function(item) {
        self.arrayItems.push(item);
      });
      return callback(null);
    };

    // This method is now a bc placeholder

    self.generateTitle = function(item) {
      return 'placeholder';
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
      self.saveItemState(function(err) {
        if (err) {
          return;
        }
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
        id: apos.utils.generateId()
      });
      self.arrayItems.push(item);
      self.active = self.arrayItems.length - 1;
      self.refresh();
    };

    // This method sets the titles in the list view for all of the
    // current items by invoking the `generateTitle` method.

    self.nextOrdinal = 1;

    // this method is now a bc placeholder, except that it
    // is still responsible for setting `_ordinal` to a unique
    // counting number for each item that does not yet have one
    self.setItemTitles = function() {
      _.each(self.arrayItems, function(item, i) {
        if (!item._ordinal) {
          item._ordinal = self.nextOrdinal++;
        }
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
      var $form = self.$arrayItem.find('[data-apos-form]');
      apos.schemas.populate($form, self.field.schema, self.arrayItems[self.active], function(err) {
        if (err) {
          apos.utils.error(err);
        }
        self.refresh();
        if (self.errorPath && (self.errorPath.length > 1)) {
          apos.schemas.returnToError($form, self.field.schema, self.errorPath.slice(1), self.error, function(err) {
            if (err) {
              apos.utils.error(err);
            }
          });
        }
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
          return callback(err);
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
      self.$el.on('click', '[data-apos-array-items-trigger]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var $trigger = $(this);

        var index = $trigger.data('apos-array-items-trigger');

        if (index === self.active) {
          // Nothing to be done, don't trigger scary schema error messages yet
          return;
        }

        self.saveItemState(function(err) {
          if (err) {
            return;
          }
          self.active = index;
          self.editItem();
        });
      });

      if (options.field.readOnly) {
        // Remove "Add item" and "Save Items" button
        self.$el.children().find('[data-apos-add-array-item]').remove();
        self.$el.parents('[data-modal]').find('[data-apos-save-array-items]').remove();
      } else {
        self.$el.on('click', '[data-apos-add-array-item]', function(e) {
          e.stopPropagation();
          e.preventDefault();
          self.saveItemState(function(err) {
            if (err) {
              return;
            }
            self.createItem();
          });
        });

        self.$el.on('click', '[data-apos-move-array-item]', function(e) {
          e.stopPropagation();
          e.preventDefault();
          var $el = $(this);

          self.saveItemState(function(err) {
            if (err) {
              return;
            }
            var id = $el.closest('[data-id]').attr('data-id');
            var direction = $el.data('apos-move-array-item');
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
          // If an active item in an array is last and delete an any item above the last item
          // Then the active item of an array to be resetted to the last item
          if (self.active === self.arrayItems.length) {
            self.active = self.active - 1;
          }
        });
      }
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
      return self.html('arrayItems', { active: self.active, arrayItems: self.arrayItems, field: self.field }, function(html) {
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
        apos.utils.error(err);
        self.decrementRefreshing();
        return callback && callback();
      });

    };

    // Invoked when the contents of the array have changed, after
    // a refresh of the display. Invokes the limit mechanism.

    self.onChange = function() {
      self.required();
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

    // Implements the `required` option by showing and hiding
    // save button.

    self.required = function() {
      if (!self.field.required) {
        return;
      }
      if (self.arrayItems.length) {
        self.$save.removeAttr('disabled');
        self.$save.removeClass('apos-button--disabled');
      } else {
        self.$save.attr('disabled', '');
        self.$save.addClass('apos-button--disabled');
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
