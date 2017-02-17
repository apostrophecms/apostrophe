// A "manage" modal for pieces, displaying them list and/or grid views and providing
// filtering and sorting features. The manager modal is also extended on the fly
// by the chooser for use as a more full-featured chooser when selecting pieces
// to appear in a widget, such as a slideshow.

apos.define('apostrophe-pieces-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'manager-modal',

  construct: function(self, options) {

    self.page = 1;
    self.schema = self.options.schema;

    self.decorate = function() {
      if (options.decorate) {
        options.decorate(self, options);
      }
    };

    // turn a filter config object into a working filter

    self.generateFilter = function(filter) {
      return {
        name: filter.name,
        setDefault: function() {
          self.currentFilters[filter.name] = stringify(filter.def);
        }
      };
      function stringify(def) {
        if (typeof(def) === 'string') {
          return def;
        }
        else if ((def === undefined) || (def === null)) {
          return 'any';
        } else if (def) {
          return '1';
        } else {
          return '0';
        }
      }
    };

    self.beforeShow = function(callback) {
      self.$manageView = self.$el.find('[data-apos-manage-view]');
      self.$filters = self.$el.find('[data-filters]');
      self.$batch = self.$el.find('[data-batch]');
      self.$batchOperation = self.$batch.find('[name="batch-operation"]');
      self.$pager = self.$el.find('[data-pager]');
      self.enableChooseViews();
      self.enableFilters();
      self.enableSorts();
      self.enableSearch();
      self.enableCheckboxEvents();
      self.enableBatchOperations();
      apos.on('change', self.onChange);
      self.refresh();
      return callback();
    };

    self.enableFilters = function() {

      self.filters = [
        {
          name: 'page',
          handler: function($el, value) {
            self.currentFilters.page = value;
            self.refresh();
          }
        }
      ];

      _.each(self.options.filters, function(filter) {
        return self.filterTo
      })
      var filterFields = _.filter(self.schema, function(field) {
        return !!(field.manage && field.manage.filter);
      });

      self.filters = self.filters.concat(_.map(self.options.filters, function(filterConfig) {
        return self.generateFilter(filterConfig);
      }));

      self.currentFilters = {};

      _.each(self.filters, function(filter) {
        filter.setDefault = filter.setDefault || function() {
          self.currentFilters[filter.name] = 1;
        };
        filter.handler = filter.handler || function($el, value) {
          self.currentFilters[filter.name] = value;
          self.currentFilters.page = 1;
          self.refresh();
        };
        filter.setDefault();
        // One step of indirection to make overrides after this point possible
        self.link('apos-' + filter.name, function($el, value) {
          filter.handler($el, value);
        });
      });

      // If the user toggles between viewing trash and viewing live items,
      // clear the current selection so that we don't wind up trying to trash
      // what is already in the trash or vice versa
      var trashFilter = _.find(self.filters, { name: 'trash' });
      if (trashFilter) {
        var superTrashHandler = trashFilter.handler;
        trashFilter.handler = function($el, value) {
          self.choices = [];
          superTrashHandler($el, value);
        }
      }

    };
    
    // Enables batch operations, such as moving every selected
    // item to the trash. Maps the operations found in options.batchOperations
    // to methods, for instance `{ name: 'trash'}` maps to
    // a call to `self.batchTrash()`. Also implements the UI for
    // selecting and invoking a batch operation.
    
    self.enableBatchOperations = function(callback) {
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

      var val = self.$batchOperation.val();

      var disabled = [];

      _.each(self.batchOperations, function(batchOperation) {
        var $option = self.$batch.find('option[value="' + batchOperation.name + '"]');
        _.each(batchOperation.unlessFilter, function(val, key) {
          if (val === true) {
            if (self.currentFilters[key] === '1') {
              disabled.push(batchOperation.name);
            }
          } else if (val === false) {
            if (self.currentFilters[key] === '0') {
              disabled.push(batchOperation.name);
            }
          } else if (val === null) {
            if (self.currentFilters[key] === 'any') {
              disabled.push(batchOperation.name);
            }
          } else if (val === self.currentFilters[key]) {
            disabled.push(batchOperation.name);
          }
        });
      });
      
      self.$batch.find('option').prop('disabled', false);
      _.each(disabled, function(name) {
        self.$batch.find('option[value="' + name + '"]').prop('disabled', true);
      });
      
      if ((!val) || _.contains(disabled, val)) {
        self.$batchOperation.val(self.$batchOperation.find('option:enabled').val());
        val = self.$batchOperation.val();
      }

      self.$batch.find('[data-apos-batch-operation-form]').removeClass('apos-active');
      self.$batch.find('[data-apos-batch-operation-form="' + val + '"]').addClass('apos-active');
      self.$batch.find('[data-apos-batch-operation]').hide();
      self.$batch.find('[data-apos-batch-operation="' + val + '"]').show();
    };
    
    self.batchOperations = {};

    // Preps for supporting a single batch operation, matching the operation name
    // to a method name such as `batchTrash` via the `name` property.
    // Also populates the subform for it, if any. Requires callback.
    // Invoked for you by `enableBatchOperations`. Do not invoke directly.
    
    self.enableBatchOperation = function(batchOperation, callback) {
      self.batchOperations[batchOperation.name] = batchOperation;
      batchOperation.handler = self['batch' + apos.utils.capitalizeFirst(batchOperation.name)];
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
      return self.batchSimple(
        'trash',
        "Are you sure you want to trash " + self.choices.length + " item(s)?",
        {}
      );
    };

    // Rescues all selected items (`self.choices`) from the trash, after
    // asking for user confirmation.
    
    self.batchRescue = function() {
      return self.batchSimple(
        'rescue',
        "Are you sure you want to rescue " + self.choices.length + " item(s) from the trash?",
        {}
      );
    };
    
    self.batchPublish = function() {
      return self.batchSimple(
        'publish',
        "Are you sure you want to publish " + self.choices.length + " items?",
        {}
      );
    };

    self.batchUnpublish = function() {
      return self.batchSimple(
        'unpublish',
        "Are you sure you want to unpublish " + self.choices.length + " items?",
        {}
      );
    };

    self.batchTag = function() {
      return self.batchSimple(
        'tag',
        "Are you sure you want to tag " + self.choices.length + " items?",
        {}
      );
    };

    self.batchUntag = function() {
      return self.batchSimple(
        'untag',
        "Are you sure you want to untag " + self.choices.length + " items?",
        {}
      );
    };

    // Carry out a named batch operation, such as `trash`, displaying the
    // provided prompt and, if confirmed by the user, invoking the
    // corresponding verb in this module's API

    self.batchSimple = function(operationName, confirmationPrompt, options) {

      if (!confirm(confirmationPrompt)) {
        return;
      }

      var data = {
        ids: self.choices
      };

      return async.series([ convert, save ], function(err) {
        if (err) {
          if (Array.isArray(err)) {
            // Schemas module already highlighted it
            return;
          }
          alert(err);
          return;
        }
        self.choices = [];
        self.refresh();
      });
      
      function convert(callback) {
        if (!self.batchOperations[operationName].schema) {
          return callback(null);
        }
        return apos.schemas.convert(
          self.$batch.find('[data-apos-batch-operation-form="' + operationName + '"]'),
          self.batchOperations[operationName].schema,
          data,
          {},
          callback
        );
      }
      
      function save(callback) {
        apos.ui.globalBusy(true);

        return self.api(operationName, data, function(result) {
          apos.ui.globalBusy(false);
          if (result.status !== 'ok') {
            return callback('An error occurred. Please try again.');
          }
          return callback(null);
        }, function() {
          apos.ui.globalBusy(false);
          return callback('An error occurred. Please try again.');
        });
      }

    };

    // Rescues all selected items (`self.choices`) from the trash, after
    // asking for user confirmation.
    
    self.batchRescue = function() {

      if (!confirm("Are you sure you want to rescue " + self.choices.length + " item(s) from the trash?")) {
        return;
      }

      apos.ui.globalBusy(true);

      return self.api('rescue', { ids: self.choices }, function(result) {
        apos.ui.globalBusy(false);
        if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.choices = [];
        self.refresh();
      }, function() {
        apos.ui.globalBusy(false);
        alert('An error occurred. Please try again.');
        return;
      });

    };

    self.enableSorts = function() {
      self.$el.on('change', '[name="sort"]', function() {
        self.sort = JSON.parse(self.$el.find('[name="sort"]').val());
        self.refresh();
      });
    };

    self.enableChooseViews = function() {
      self.link('apos-choose-manage-view', function($el, value) {
        self.viewName = value;
        self.refresh();
      });
    }

    self.enableSearch = function() {
      self.$el.on('change', '[name="search-'+self.options.name+'"]', function() {
        self.search = $(this).val();
        self.refresh( function() {
          var $input = self.$el.find('[name="search-'+self.options.name+'"]');
          // refocus input element after search
          $input.focus();
          // put the search query before the cursor
          $input.val($input.val());
        });
      });
    };
    
    self.choices = [];

    // Enable checkbox selection of pieces. The ids of the chosen pieces are added
    // to `self.choices`. This mechanism is used for ordinary manager modals and their
    // bulk features, like "Trash All Selected". The chooser used for selecting
    // pieces for joins overrides this with an empty method and substitutes its
    // own implementation.

    self.enableCheckboxEvents = function() {
      self.$el.on('change', '[data-piece] input[type="checkbox"]', function(e) {
        var $box = $(this);
        var id = $box.closest('[data-piece]').attr('data-piece');
        if ($box.prop('checked')) {
          if (!_.contains(self.choices, id)) {
            self.choices.push(id);
          }
          self.reflectChoiceCount();
        } else {
          self.choices = _.filter(self.choices, function(_id) {
            return id !== _id;
          });
          if (!self.choices.length) {
            self.$el.removeClass('apos-manager-modal--has-choices');
            self.$el.addClass('apos-manager-modal--has-no-choices');
          }
          self.reflectChoiceCount();
        }
      });
    };
    
    // Reflect existing choices in checkboxes. Invoked by `self.refresh` after
    // the main view is refreshed. Important when the user is selecting items
    // while paginating. This mechanism is used for ordinary manager modals and their
    // bulk features, like "Trash All Selected". The chooser used for selecting
    // pieces for joins overrides this with an empty method and substitutes its
    // own implementation.

    self.reflectChoicesInCheckboxes = function() {
      _.each(self.choices, function(id) {
        self.$el.find('[data-piece="' + id + '"]').prop('checked', true);
      });
      self.reflectChoiceCount();
    };
    
    self.reflectChoiceCount = function() {
      var count = self.choices.length;
      var $buttons = self.$batch.find('.apos-button');
      if (count) {
        $buttons.removeClass('apos-button--disabled');
      } else {
        $buttons.addClass('apos-button--disabled');
      }
      self.$batch.find('[name="batch-operation"] option').each(function() {
        var $option = $(this);
        $option.text($option.text().replace(/\([\d]+\)/, '(' + count + ')'));
      });
    };

    self.refresh = function(callback) {
      var listOptions = {
        format: 'managePage'
      };

      _.extend(listOptions, self.currentFilters);
      listOptions.sort = self.sort;
      listOptions.search = self.search;
      listOptions.manageView = self.viewName;
      self.beforeList(listOptions);

      return self.api('list', listOptions, function(response) {
        if (!response.status === 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$filters.html(response.data.filters);
        self.$manageView.html(response.data.view);
        self.$pager.html(response.data.pager);
        apos.emit('enhance', self.$filters);
        apos.emit('enhance', self.$manageView);
        apos.emit('enhance', self.$pager);
        self.resizeContentHeight();
        self.afterRefresh();
        self.reflectChoicesInCheckboxes();
        self.reflectBatchOperation();

        if (callback) {
          return callback(response);
        }
      });
    };

    self.beforeList = function(listOptions) {
      // Overridable hook
    };

    self.afterRefresh = function() {
      // Overridable hook
    };

    self.onChange = function(type) {
      if (type === self.options.name) {
        self.refresh();
      }
    };

    self.afterHide = function() {
      // So we don't leak memory and keep refreshing
      // after we're gone
      apos.off('change', self.onChange);
    };

    // Decorate at the end of the construct method, so that we can override
    // methods that were added by the decorator in subclasses.
    self.decorate();
  }
});
