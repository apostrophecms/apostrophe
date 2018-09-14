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
    var jobs = apos.modules['apostrophe-jobs'];

    self.decorate = function() {
      if (options.decorate) {
        options.decorate(self, options);
      }
    };

    // turn a filter config object into a working filter

    self.generateFilter = function(filter) {
      return {
        name: filter.name,
        multiple: filter.multiple,
        setDefault: function() {
          self.currentFilters[filter.name] = filter.def;
        }
      };
    };

    self.beforeShow = function(callback) {
      self.$manageView = self.$el.find('[data-apos-manage-view]');
      self.$filters = self.$modalFilters.find('[data-filters]');
      self.$batch = self.$el.find('[data-batch]');
      self.$batchOperation = self.$batch.find('[name="batch-operation"]');
      self.$pager = self.$el.find('[data-pager]');
      self.enableChooseViews();
      self.enableFilters();
      self.enableSorts();
      self.enableSearch();
      self.enableCheckboxEvents();
      self.enableBatchOperations();
      self.enableInsertViaUpload();
      self.enableSelectEverything();
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

      self.filters = self.filters.concat(_.map(self.options.filters, function(filterConfig) {
        return self.generateFilter(filterConfig);
      }));

      self.currentFilters = {};

      _.each(self.filters, function(filter) {
        filter.setDefault = filter.setDefault || function() {
          self.currentFilters[filter.name] = 1;
        };
        filter.handler = filter.handler || function($el, value) {
          if (filter.multiple) {
            // Multiple select requires that we look at the
            // checkboxes of the existing selections plus the
            // value of the select element
            var vals = [];
            self.$filters.findByName(filter.name).each(function() {
              var $el = $(this);
              if ($el.is('[type="checkbox"]') && (!$el.prop('checked'))) {
                // skip, this was just unchecked
              } else {
                // An existing checkbox, or a new choice from the select element
                var val = $(this).val();
                if (val !== '**CHOOSE**') {
                  vals.push($(this).val());
                }
              }
            });
            self.currentFilters[filter.name] = vals;
            self.currentFilters.page = 1;
            self.refresh();
          } else {
            if (value === '**ANY**') {
              value = null;
            }
            self.currentFilters[filter.name] = value;
            self.currentFilters.page = 1;
            self.refresh();
          }
        };
        filter.setDefault();
        // One step of indirection to make overrides after this point possible
        self.link('apos-' + filter.name, function($el, value) {
          // For pill button links
          filter.handler($el, value);
        });
        self.$filters.on('change', '[name="' + filter.name + '"]', function() {
          // For select elements
          filter.handler($(this), $(this).val());
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
        };
      }

    };

    // Enables batch operations, such as moving every selected
    // item to the trash. Maps the operations found in options.batchOperations
    // to methods, for instance `{ name: 'trash'}` maps to
    // a call to `self.batchTrash()`. Also implements the UI for
    // selecting and invoking a batch operation.

    self.enableBatchOperations = function(callback) {
      if (self.parentChooser || self.options.liveChooser) {
        // It would make sense for decorateManager to just kill this method,
        // except that would break bc for anyone who already
        // overrode that. As the newcomer we're responsible for
        // playing nice and recognizing batch operations are
        // incompatible with the chooser. -Tom
        return;
      }
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

      self.$batchOperation.find('option').remove();
      _.each(self.batchOperations, function(batchOperation) {
        var disable = false;
        var $option;
        _.each(batchOperation.unlessFilter, function(val, key) {
          var filterVal = self.currentFilters[key];
          if (val === true) {
            if ((filterVal === true) || (filterVal === '1')) {
              disable = true;
            }
          } else if (val === false) {
            if ((filterVal === false) || (filterVal === '0')) {
              disable = true;
            }
          } else if (val === null) {
            if (filterVal === 'any') {
              disable = true;
            }
          } else if (val === filterVal) {
            disable = true;
          }
        });
        if (!disable) {
          $option = self.$batchOperationTemplate.find('[value="' + batchOperation.name + '"]').clone();
          self.$batchOperation.append($option);
        }
      });
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

    self.enableInsertViaUpload = function() {
      if (!self.options.insertViaUpload) {
        return;
      }
      // Additional parameters to be passed to the route. Used to ensure
      // we get things like `minSize` via the override the chooser puts in place
      var query = {};
      self.beforeList(query);
      // The actual input element, hidden, which gets clicked by the button
      // (see below).

      getUploader().fileupload({
        dataType: 'json',
        dropZone: self.$el,
        formData: {
          // Because jquery fileupload is not smart enough to serialize
          // arrays and objects by itself
          filters: JSON.stringify(query)
        },
        url: self.action + '/insert-via-upload',
        start: function (e) {
          // Only way to know this is the beginning of the whole show
          if (!getUploader().fileupload('active')) {
            busy(true);
            self.insertViaUploadStatus = { total: 0, unsuitable: 0, errors: 0 };
          }
        },
        // Even on an error we should note we're not spinning anymore
        always: function (e, data) {
          // Asinine but this still returns 1 as of when always is invoked
          if (getUploader().fileupload('active') <= 1) {
            busy(false);
          }
        },
        fail: function (e, data) {
          self.insertViaUploadStatus.errors++;
          feedback();
        },
        done: function (e, data) {
          if (data.result.status === 'ok') {
            self.addChoice(data.result.piece._id);
            // Refreshing after each one gives a sense of activity
            apos.change(self.options.name);
            self.insertViaUploadStatus.total++;
          } else if (data.result.status === 'unsuitable') {
            self.insertViaUploadStatus.unsuitable++;
          } else {
            self.insertViaUploadStatus.errors++;
          }
          feedback(data);
        },
        add: function(e, data) {
          return data.submit();
        }
      });

      self.$controls.on('click', '[data-apos-upload-' + self.options.name + ']', function() {
        // For bc we have to be able to deal with the possibility the uploader is
        // replaced after each use
        getUploader().click();
        return false;
      });

      function feedback(data) {
        if (getUploader().fileupload('active') <= 1) {
          if (self.insertViaUploadStatus.errors) {
            apos.notify('Some files were damaged, of an unsuitable type or too large to be uploaded.', { type: 'error' });
          } else if (self.insertViaUploadStatus.unsuitable) {
            apos.notify('Some uploaded files were unsuitable for the current placement.', { type: 'error' });
          } else {
            // If we only tried to upload one and it worked, trigger the schema modal next per Stuart
            if (self.insertViaUploadStatus.total === 1) {
              self.options.manager.edit(data.result.piece._id);
            }
          }
        }
      }

      function busy(state) {
        apos.ui.globalBusy(state);
      }

      function getUploader() {
        return self.$controls.find('[data-apos-uploader-' + self.options.name + ']');
      }
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
          return;
        }
        self.choices = [];
        self.refresh();
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
            return jobs.progress(result.jobId, {
              success: function(result) {
                if (options.success) {
                  return options.success(result, callback);
                } else {
                  return callback(null);
                }
              },
              change: self.options.name
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
    };

    self.enableSearch = function() {
      self.$filters.on('change', '[name="search-' + self.options.name + '"]', function() {
        self.search = $(this).val();
        self.currentFilters.page = 1;
        self.refresh(function() {
          var $input = self.$filters.find('[name="search-' + self.options.name + '"]');
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

      if (!$.contains(self.$el[0], self.$filters[0])) {
        self.$filters.on('change', 'input[type="checkbox"][name="select-all"]', selectAllHandler);
      }
      self.$el.on('change', 'input[type="checkbox"][name="select-all"]', selectAllHandler);
      function selectAllHandler(e) {
        var checked = $(this).prop('checked');
        var $pieces = self.$el.find('[data-piece]');
        if (checked) {
          $pieces.each(function() {
            self.addChoice($(this).attr('data-piece'));
          });
        } else {
          $pieces.each(function() {
            self.removeChoice($(this).attr('data-piece'));
          });
        }
        self.reflectChoiceCount();
      }

      self.$el.on('change', '[data-piece] input[type="checkbox"]', function(e) {
        var $box = $(this);
        var id = $box.closest('[data-piece]').attr('data-piece');
        if ($box.prop('checked')) {
          self.addChoice(id);
        } else {
          self.removeChoice(id);
        }
      });
    };

    // shrink and grow make visual reflectments to accommodate the the new Select Everything element
    self.shrinkGrid = function() {
      self.$el.find('.apos-modal-footer').css('bottom', '72px');
      self.$el.find('.apos-modal-body, .apos-chooser').css('height', 'calc(100% - 144px)');
    };

    self.growGrid = function() {
      self.$el.find('.apos-modal-footer').css('bottom', '0px');
      self.$el.find('.apos-modal-body, .apos-chooser').css('height', 'calc(100% - 72px)');
    };

    // reflect the modal's layout and size in response to
    // whether the select everything box should appear
    // at this time. Also reflect the state of the select
    // everything checkbox based on what is actually selected

    self.reflectSelectEverything = function () {
      var $pieces = self.$el.find('[data-piece]');
      var $checked = $pieces.find('input[type="checkbox"]:checked');
      var $selectEverything = self.getSelectEverything();
      if ($pieces.length === $checked.length) {
        self.getSelectAll().prop('checked', true);
        self.shrinkGrid();
        if (!$selectEverything.hasClass('apos-active')) {
          // We need to asynchronously go get all ids at this point
          // before actually showing it
          self.refreshSelectEverything();
        }
        // We will call reflectSelectEverythingCheckbox after we have allIds
      } else {
        self.getSelectAll().prop('checked', false);
        self.growGrid();
        $selectEverything.removeClass('apos-active');
        self.reflectSelectEverythingCheckbox();
      }
    };

    self.reflectSelectEverythingCheckbox = function() {
      var checkIt = (self.getIds().length && self.allIds && (self.allIds.length === self.getIds().length));
      self.getSelectEverything().find('input[name="select-everything"]').prop('checked', checkIt);
    };

    self.getSelectAll = function() {
      return self.$el.find('input[type="checkbox"][name="select-all"]').add(self.$filters.find('input[type="checkbox"][name="select-all"]'));
    };

    self.enableSelectEverything = function() {
      self.$el.add(self.$filters).on('change', 'input[name="select-everything"]', function() {
        var checked = $(this).prop('checked');
        if (checked) {
          _.each(self.allIds, function(id) {
            self.addChoice(id);
          });
        } else {
          self.clearEverythingChoices();
        }
      });
    };

    self.addChoice = function(id) {
      self.addChoiceToState(id);
      self.reflectChoiceInCheckbox(id);
      self.reflectChoiceCount();
    };

    self.addChoiceToState = function(id) {
      if (!_.contains(self.choices, id)) {
        self.choices.push(id);
      }
    };

    self.removeChoice = function(id) {
      self.removeChoiceFromState(id);
      self.reflectChoiceInCheckbox(id);
      self.reflectChoiceCount();
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
      self.$el.removeClass('apos-manager-modal--has-choices');
      self.$el.addClass('apos-manager-modal--has-no-choices');
      self.reflectChoiceCount();
    };

    // When the "select everything" checkbox is cleared,
    // we go back to selecting just the current page
    // of content
    self.clearEverythingChoices = function() {
      var $pieces = self.$el.find('[data-piece]');

      self.clearChoices();

      var ids = $pieces.map(function() {
        if ($(this).find('input[type="checkbox"]').is(':checked')) {
          return $(this).attr('data-piece');
        }
      }).get();

      _.each(ids, function(id) {
        self.addChoice(id);
      });

      self.reflectChoiceCount();

    };

    self.refreshSelectEverything = function() {
      var listOptions = self.getListOptions({ format: 'allIds' });
      apos.ui.globalBusy(true);
      return self.api('list', listOptions, function(response) {
        apos.ui.globalBusy(false);
        if (response.status !== 'ok') {
          return;
        }
        self.allIds = response.data.ids;
        self.getSelectEverything().find('[data-label]').text(response.data.label);
        self.getSelectEverything().addClass('apos-active');
        self.reflectSelectEverythingCheckbox();
      });
    };

    self.getSelectEverything = function() {
      return self.$el.find('[data-result-select-everything]').add(self.$filters.find('[data-result-select-everything]')).first();
    };

    // Reflect existing choices in checkboxes. Invoked by `self.refresh` after
    // the main view is refreshed. Important when the user is selecting items
    // while paginating. This mechanism is used for ordinary manager modals and their
    // bulk features, like "Trash All Selected". The chooser used for selecting
    // pieces for joins overrides this with an empty method and substitutes its
    // own implementation.

    self.reflectChoicesInCheckboxes = function() {

      _.each(self.getVisibleIds(), function(id) {
        self.reflectChoiceInCheckbox(id);
      });
      self.reflectChoiceCount();
    };

    // Reflect the current selection state of the given id
    // by checking or unchecking the relevant box based on
    // whether it is included in `self.getIds()`

    self.reflectChoiceInCheckbox = function(id) {
      var state = _.includes(self.getIds(), id);
      self.displayChoiceInCheckbox(id, state);
    };

    // Return a jquery object referencing the checkbox for the given piece id
    self.getCheckbox = function(id) {
      return self.$el.find('[data-piece="' + id + '"] input[type="checkbox"]');
    };

    // Return array of ids corresponding to the items currently visible
    // in the modal's list view, whether checked or not

    self.getVisibleIds = function() {
      var ids = [];
      self.$el.find('[data-piece]').each(function() {
        ids.push($(this).attr('data-piece'));
      });
      return ids;
    };

    // Set the display state of the given checkbox. returns
    // a jQuery object referencing the checkbox, for the convenience
    // of subclasses that extend this
    self.displayChoiceInCheckbox = function(id, checked) {
      var $checkbox = self.getCheckbox(id);
      $checkbox.prop('checked', checked);
      return $checkbox;
    };

    self.reflectChoiceCount = function() {
      self.reflectBatchOperation();
      self.reflectSelectEverything();
      self.reflectHasChoices();
    };

    self.reflectHasChoices = function() {
      if (!self.getIds().length) {
        self.$el.removeClass('apos-manager-modal--has-choices');
        self.$el.addClass('apos-manager-modal--has-no-choices');
      } else {
        self.$el.addClass('apos-manager-modal--has-choices');
        self.$el.removeClass('apos-manager-modal--has-no-choices');
      }
    };

    // Given an options object, returns a new object with
    // those options plus standard options for the list API,
    // such as `sort`, `search` and `manageView`. Also invokes
    // `self.beforeList`. Called by `refresh`.

    self.getListOptions = function(options) {
      var listOptions = _.assign({}, options);

      _.extend(listOptions, self.currentFilters);
      listOptions.sort = self.sort;
      listOptions.search = self.search;
      listOptions.manageView = self.viewName;
      self.beforeList(listOptions);

      return listOptions;
    };

    self.refresh = function(callback) {
      var listOptions = self.getListOptions({ format: 'managePage' });

      return self.api('list', listOptions, function(response) {
        if (!response.status === 'ok') {
          apos.notify('An error occurred. Please try again.', { type: 'error', dismiss: true });
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

        if (callback) {
          return callback(response);
        }
      });
    };

    // An initially empty method you can override to add properties to the
    // query object sent to the server to fetch another page of results. Also
    // used to build the query that goes to the server in a insert-via-upload
    // operation in order to make sure things like the `minSize` filter
    // of `apostrophe-images` are honored.
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
