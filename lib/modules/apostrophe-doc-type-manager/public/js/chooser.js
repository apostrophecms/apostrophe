apos.define('apostrophe-doc-type-manager-chooser', {
  extend: 'apostrophe-context',
  beforeConstruct: function(self, options) {
    self.manager = options.manager;
    self.field = options.field;
    self.$el = options.$el;
    self.$el.data('aposChooser', self);
    if (self.field.type === 'joinByOne') {
      self.limit = 1;
    } else {
      self.limit = (self.field.hints && self.field.hints.limit) || self.field.limit;
    }
    self.choices = [];
  },
  afterConstruct: function(self, callback) {
    self.removed = self.options.field.removedIdsField;
    self.enableInlineSchema();

    return async.series([
      self.load
    ], function(err) {
      if (err) {
        return callback(err);
      }
      self.enableLinks();
      self.enableAutocomplete();
      self.enableSortable();
      return callback(null);
    });
  },
  construct: function(self, options) {
    self.load = function(callback) {
      var args = {
        field: self.field
      };
      // browse button can be shut off, for instance if we're already appearing in
      // a manage modal in response to a browse button
      if (options.browse !== false) {
        args.browse = true;
      }
      if (options.autocomplete !== false) {
        args.autocomplete = true;
      }
      if (self.removed) {
        args.removed = true;
      }
      // do not display "Browse" button and autocomplete input if readOnly field
      if (options.field.readOnly) {
        args.browse = false;
        args.autocomplete = false;
      }
      return self.html('chooser', args, function(html) {
        self.$el.html(html);
        self.$choices = self.$el.find('[data-choices]:first');
        self.set([]);
        return callback(null);
      }, function(err) {
        return callback(err);
      });
    };
    // Set a new array of currently selected choices. Each should have
    // label and value properties at a minimum
    self.set = function(choices) {
      self.choices = choices;
      return self.refresh({ ignoreCurrentRelationships: true });
    };
    self.get = function(callback) {
      if (!self.refreshing) {
        return self.convertInlineRelationships(function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, self.choices);
        });
      }
      setTimeout(function() {
        return self.get(callback);
      }, 50);
    };
    self.getFinal = function(callback) {
      return self.finalize(function(err) {
        if (err) {
          return callback(err);
        }
        return self.get(callback);
      });
    };
    self.finalize = function(callback) {
      // A hook to implement things like minimums, autocropping, etc.
      return setImmediate(callback);
    };
    self.add = function(_id) {
      var existing = _.find(self.choices, { value: _id });
      if (existing) {
        if (existing.__removed) {
          delete existing.__removed;
        }
      } else {
        if ((self.limit === 1) && (self.choices.length === 1)) {
          // When the limit is 1, a new selection should just blow out the old one,
          // that is standard practice
          self.choices = [];
        }
        if ((!self.limit) || (self.choices.length < self.limit)) {
          self.choices.push({ value: _id });
        }
      }
      self.refresh();
      return true;
    };
    self.clear = function() {
      self.choices = [];
      self.refresh();
      return true;
    };
    self.remove = function(_id, refresh) {
      if (self.removed) {
        // We are striking things through, not forgetting about them
        var removed = _.find(self.choices, { value: _id });
        if (removed) {
          removed.__removed = !removed.__removed;
        }
      } else {
        self.choices = _.filter(self.choices, function(choice) {
          return choice.value !== _id;
        });
      }
      if (refresh !== false) {
        self.refresh();
      }
      return true;
    };
    self.refreshing = 0;
    self.last = [];
    self.refresh = function(options) {
      options = options || {};
      if (self.refreshing) {
        self.refreshing++;
        return;
      }
      self.refreshing++;
      var $currentInlineRelationships;
      if (options.ignoreCurrentRelationships) {
        $currentInlineRelationships = $();
      } else {
        $currentInlineRelationships = self.$choices.find('[data-relationship-inline]');
      }
      self.$choices.html('');
      return self.api('chooser-choices', { choices: self.choices, field: self.field, validate: true }, function(result) {
        // If we're not going to make another API call in a moment and blow this one out anyway,
        // display and accept the validated results. If we are, don't do that, because it's a waste
        // of time and because accepting the validated results would sabotage the *next* refresh. -Tom

        if (self.refreshing > 1) {
          // We're superfluous, the last guy matters
          self.decrementRefreshing();
          return;
        }

        if (result.status !== 'ok') {
          self.decrementRefreshing();
          return;
        }

        self.choices = result.choices;
        self.$choices.html(result.html);
        return async.eachSeries(self.choices || [], function(choice, callback) {
          var $current = $currentInlineRelationships.filter('[data-relationship-inline="' + choice.value + '"]');
          var $new = self.$choices.find('[data-relationship-inline="' + choice.value + '"]');
          if ($current.length) {
            // Don't blow out the relationship forms for items already among the choices as that would
            // lose work in progress when we're just adding another choice
            $new.replaceWith($current);
            return setImmediate(callback);
          }
          return apos.schemas.populate(self.$choices.find('[data-relationship-inline="' + choice.value + '"]'), self.inlineSchema, choice, callback);
        }, function(err) {
          if (err) {
            // Ouch
            apos.notify('Unable to populate form correctly, try again later', { type: 'error', dismiss: true });
            self.decrementRefreshing();
            return;
          }
          var compare = JSON.stringify(self.choices);
          if (self.last !== compare) {
            self.last = compare;
            self.onChange();
          }
          self.decrementRefreshing();
        });

      }, function(err) {
        if (err) {
          apos.utils.error(err);
        }
        self.decrementRefreshing();
      });
    };

    self.convertInlineRelationships = function(callback) {
      return async.eachSeries(self.choices, function(choice, callback) {
        var $relationship = self.$choices.find('[data-relationship-inline="' + choice.value + '"]');
        return apos.schemas.convert($relationship, self.inlineSchema, choice, callback);
      }, callback);
    };

    self.decrementRefreshing = function() {
      self.refreshing--;
      // If one or more additional refreshes have been requested, carrying out
      // one more is sufficient
      if (self.refreshing > 0) {
        self.refreshing = 0;
        self.refresh();
      }
    };

    self.enableLinks = function() {
      self.$el.on('mouseover', '[data-apos-tooltip]', apos.ui.createTooltip);
      self.$el.on('mouseleave click', '[data-apos-tooltip]', apos.ui.removeTooltip);
      self.link('apos-delete', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { value: _id });
        if (index === -1) {
          return;
        }
        self.remove(_id, false);
        var $choices = self.$el.find('[data-choices]>.apos-chooser-choice');
        if (self.removed || (!$choices.length)) {
          // Markup is too custom, just re-render
          return self.refresh();
        }
        $choices.eq(index).remove();
      });
      self.link('apos-raise', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { value: _id });
        if (index === -1) {
          return;
        }
        if (index === 0) {
          return;
        }
        var tmp = self.choices[index - 1];
        self.choices[index - 1] = self.choices[index];
        self.choices[index] = tmp;
        var $choices = self.$el.find('[data-choices]>.apos-chooser-choice');
        if (!$choices.length) {
          // Markup is too custom, just re-render
          return self.refresh();
        }
        $choices.eq(index - 1).before($choices.eq(index));
      });
      self.link('apos-lower', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { value: _id });
        if (index === -1) {
          return;
        }
        if (index === (self.choices.length - 1)) {
          return;
        }
        var tmp = self.choices[index + 1];
        self.choices[index + 1] = self.choices[index];
        self.choices[index] = tmp;
        var $choices = self.$el.find('[data-choices]>.apos-chooser-choice');
        if (!$choices.length) {
          // Markup is too custom, just re-render
          return self.refresh();
        }
        $choices.eq(index + 1).after($choices.eq(index));
      });
      self.link('apos-relate', 'item', function($button, _id) {
        var choice = _.find(self.choices, { value: _id });
        if (!choice) {
          return;
        }
        var editorType = self.field.relationshipEditor || self.manager.getToolType('relationship-editor');
        apos.create(editorType, {
          choice: choice,
          field: self.field,
          action: self.action,
          chooser: self
        });
      });
      self.link('apos-edit', 'item', function($button, _id) {
        self.manager.edit(_id, function() {});
      });
      self.link('apos-browse', function() {
        self.launchBrowser();
      });
    };

    self.enableAutocomplete = function() {
      self.$autocomplete = self.$el.find('[data-autocomplete]');
      if (self.options.pluralLabel) {
        var placeholder = self.$autocomplete.attr('placeholder');
        if (placeholder) {
          self.$autocomplete.attr('placeholder', placeholder.substring(0, placeholder.length - 3) + ' ' + self.options.pluralLabel + '...');
        }
      }
      self.$autocomplete.autocomplete({
        source: function(request, response) {
          return self.api('autocomplete', {
            term: request.term,
            field: self.field
          }, response);
        },
        minLength: 1,
        // Stomp out suggestions of choices already made
        response: function(event, ui) {
          var content = ui.content;
          var filtered = _.filter(content, function(datum) {
            return !_.find(self.choices, { value: datum.value });
          });
          // "Why don't you just assign to ui.content?" jquery.ui.autocomplete
          // is holding a reference to the original array. If I assign to ui.content
          // I'm not changing that original array and jquery.ui.autocomplete ignores me.
          content.length = 0;
          $.each(filtered, function(i, datum) {
            content.push(datum);
          });
        },
        focus: function(event, ui) {
          self.$autocomplete.val(ui.item.label);
          return false;
        },
        select: function(event, ui) {
          self.$autocomplete.val('');
          self.add(ui.item.value);
          return false;
        },
        position: { collision: 'flip' }
      });
    };

    self.enableSortable = function () {
      var sortableOptions = {
        cancel: false,
        handle: '[data-apos-sort-item]',
        update: function(event, ui) {
          var $choices = self.$el.find('[data-chooser-choice]');

          if ($choices.length !== self.choices.length) {
            apos.notify('Something went wrong, reverting changes', { type: 'error' });
            return self.$choices.sortable('cancel');
          }

          self.choices = [];

          $choices.each(function () {
            self.choices.push({ value: $(this).attr('data-chooser-choice') });
          });

          if (!$choices.length) {
            // Markup is too custom, just re-render
            return self.refresh();
          }
        }
      };
      self.$choices.sortable(sortableOptions);
    };

    self.getBrowserType = function() {
      return self.manager.getToolType('manager-modal');
    };

    self.launchBrowser = function() {
      return self.convertInlineRelationships(function(err) {
        if (err) {
          apos.notify('Please address errors first.', { type: 'error' });
          return;
        }
        return self.manager.getTool('manager-modal', {
          decorate: self.decorateManager,
          chooser: self,
          source: 'chooser-modal',
          body: {
            limit: self.limit,
            field: self.field
          },
          transition: 'slide'
        });
      });
    };

    // Create a new chooser with the same data and options, merging in any
    // additional options from the first argument. Async because
    // the constructor is async. Delivers (err, newChooser)
    self.clone = function(options, callback) {
      var _options = {};
      _.assign(_options, self.options);
      _.assign(_options, options);
      return apos.create(self.__meta.name, _options, function(err, chooser) {
        if (err) {
          return callback(err);
        }
        return self.get(function(err, data) {
          if (err) {
            return callback(err);
          }
          chooser.set(data);
          return callback(null, chooser);
        });
      });
    };

    self.onChange = function() {
      if ((self.limit > 1) && self.choices.length >= self.limit) {
        self.$el.addClass('apos-chooser-full');
        if (self.options.managerModal) {
          self.options.managerModal.$el.addClass('apos-chooser-full');
        }
        self.$autocomplete.prop('disabled', true);
        self.full = true;
      } else {
        self.$el.removeClass('apos-chooser-full');
        self.$autocomplete.prop('disabled', false);
        if (self.options.managerModal) {
          self.options.managerModal.$el.removeClass('apos-chooser-full');
        }
        self.full = false;
      }
      if (self.options.change) {
        self.options.change();
      }
    };

    self.enableInlineSchema = function() {
      self.inlineSchema = _.filter(self.field.relationship || [], { inline: true });
    };

    // Adds and overrides methods of the apostrophe-pieces-manager-modal to
    // accommodate its use as a full-featured selection tool for the chooser,
    // including the ability to create new items on the fly and choose them

    self.decorateManager = function(manager, options) {

      manager.parentChooser = options.chooser;

      // TODO make this actually detect changes properly
      manager.unsavedChanges = true;

      var superBeforeShow = manager.beforeShow;
      manager.beforeShow = function(callback) {
        return superBeforeShow(function() {
          return manager.enableChooser(callback);
        });
      };

      manager.enableChooser = function(callback) {
        if (manager.options.liveChooser) {
          manager.afterEnableChooser();
          return setImmediate(callback);
        }
        if (!manager.parentChooser) {
          return setImmediate(callback);
        }

        return manager.parentChooser.clone(
          {
            $el: manager.$el.find('[data-chooser]'),
            browse: false,
            autocomplete: false,
            change: manager.reflectChoicesInCheckboxes,
            managerModal: manager
          },
          function(err, chooser) {
            if (err) {
              return callback(err);
            }
            manager.chooser = chooser;
            apos.on('pieceInserted', chooser.pieceInsertedListener);
            manager.afterEnableChooser();
            return callback(null);
          }
        );
      };

      var superEnableCheckboxEvents = manager.enableCheckboxEvents;
      // Would run too soon, wait for chooser to load
      manager.enableCheckboxEvents = function() {
      };

      manager.afterEnableChooser = function() {
        superEnableCheckboxEvents();
      };

      manager.addChoiceToState = function(id) {
        manager.chooser.add(id);
      };

      manager.removeChoiceFromState = function(id) {
        manager.chooser.remove(id);
      };

      manager.getIds = function() {
        return _.pluck(manager.chooser.choices, 'value');
      };

      var superReflectChoicesInCheckboxes = manager.reflectChoicesInCheckboxes;
      manager.reflectChoicesInCheckboxes = function() {
        if (!manager.chooser) {
          // Not ready yet
          return setTimeout(manager.reflectChoicesInCheckboxes, 50);
        }
        superReflectChoicesInCheckboxes();
      };

      manager.clearChoices = function() {
        self.clear();
      };

      manager.saveContent = function(callback) {
        if (!manager.chooser) {
          // This should not happen, but be graceful
          return callback(null);
        }
        // Pass our choices back to the chooser hanging out in a schema form that
        // initially triggered us via "browse"
        return manager.chooser.get(function(err, choices) {
          if (err) {
            return callback(err);
          }
          manager.parentChooser.set(choices);
          return callback(null);
        });
      };

      var superManagerSave = manager.save;
      manager.save = function(callback) {
        return superManagerSave(function(err) {
          if (err) {
            return callback && callback(err);
          }
          manager.parentChooser.afterManagerSave();
          return callback && callback(null);
        });
      };

      var superManagerCancel = manager.cancel;
      manager.cancel = function(callback) {
        return superManagerCancel(function(err) {
          if (err) {
            return callback && callback(err);
          }
          manager.parentChooser.afterManagerCancel();
          return callback && callback(null);
        });
      };

      manager.getConfirmCancelText = function() {
        if (options.pluralLabel) {
          return 'Are you sure you want to discard unsaved changes to this selection of ' +
            options.pluralLabel.toLowerCase() + '?';
        } else {
          return 'Are you sure you want to discard unsaved changes?';
        }
      };

      manager.beforeList = function(listOptions) {
        // The `limit` hint would break normal pagination in the manage view; the
        // chooser handles that one on its own. -Tom
        //
        // Support the new .filters property, but with bc.
        _.extend(listOptions.filters || listOptions, _.omit(self.field.hints, 'limit'), { chooser: true });
      };

    };
    self.afterManagerSave = function() {
      apos.off('pieceInserted', self.pieceInsertedListener);
    };
    self.afterManagerCancel = function() {
      apos.off('pieceInserted', self.pieceInsertedListener);
    };
    // This listener only actually gets installed for a chooser appearing in a manager
    self.pieceInsertedListener = function(piece) {
      if (!self.pieceIsRelevant(piece)) {
        return;
      }
      self.add(piece._id);
    };
    self.pieceIsRelevant = function(piece) {
      if (Array.isArray(self.field.withType)) {
        return _.contains(self.field.withType, piece.type);
      } else {
        return piece.type === self.field.withType;
      }
    };
  }
});
