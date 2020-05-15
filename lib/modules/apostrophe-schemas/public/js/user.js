// The browser-side singleton corresponding to the [apostrophe-schemas](/reference/modules/apostrophe-schemas/) module.

apos.define('apostrophe-schemas', {

  extend: 'apostrophe-context',

  construct: function(self, options) {

    self.fieldTypes = {};

    // Populate form elements corresponding to a set of fields as
    // specified in a schema (the schema argument). The inverse of
    // self.convert.
    //
    // Must be called only once for a given set of elements. However,
    // you can call `convert` many times. Typical practice is to
    // create a modal, populate it with existing data, and then
    // attempt to convert it on save. If a conversion fails it is
    // OK to try again after the user corrects errors such as
    // absent required fields.

    self.populate = function($el, schema, object, callback) {

      self.enableGroupTabs($el);

      return async.series([
        _.partial(self.beforePopulate, $el, schema, object),
        populate,
        _.partial(self.afterPopulate, $el, schema, object)
      ], callback);

      function populate(callback) {
        return async.eachSeries(schema, function(field, callback) {

          // Utilized by simple displayers that use a simple HTML
          // element with a name attribute
          var $field = self.findField($el, field.name);
          if (field.contextual) {
            return setImmediate(callback);
          }

          var fieldType = self.fieldTypes[field.type];

          return fieldType.populate(object, field.name, $field, $el, field, function() {
            if (field.autocomplete === false) {
              $field.attr('autocomplete', 'off');
            }
            // By popular demand fields can be distinguished as required
            // before any input actually takes place, without calling
            // showError, which implies the user already did something bad
            // apos.utils.log(field);
            if (field.required === true) {
              self.findFieldset($el, field.name).addClass('apos-required');
            }
            return setImmediate(callback);
          });
        }, function() {
          self.enableSlugSuggestions($el, schema, object);
          return callback();
        });
      }
    };

    // Invoked at the start of `populate`. Does nothing by default.
    // Provides a convenient way to extend the behavior of all
    // schemas. When implementing custom field types you should
    // not need to override this method, however it is sometimes useful for
    // concerns that cut across multiple methods.

    self.beforePopulate = function($el, schema, object, callback) {
      return callback(null);
    };

    // Invoked at the end of `populate`. Does nothing by default.
    // Provides a convenient way to extend the behavior of all
    // schemas. When implementing custom field types you should
    // not need to override this method, however it is sometimes useful for
    // concerns that cut across multiple methods.

    self.afterPopulate = function($el, schema, object, callback) {
      return callback(null);
    };

    // If the schema contains both `title` and `slug` fields, begin
    // monitoring `title` and updating `slug` as the user types,
    // provided it reflects the previous content of `title`.

    self.enableSlugSuggestions = function($el, schema, object) {
      var title = _.find(schema, { name: 'title' });
      var slug = _.find(schema, { name: 'slug', type: 'slug' });

      if (!(title && slug)) {
        return;
      }

      var $title = self.findField($el, 'title');
      var $slug = self.findField($el, 'slug');

      if (slug.prefix) {
        $slug.data('prefix', slug.prefix);
      }

      self.enableSlug($title, $slug, title, slug);
      self.watchSlugConflicts($title, $slug, title, slug, object);
    };

    // Gather data from form elements and push it into properties of the data
    // object, as specified by the schema provided. The inverse of
    // self.populate. Errors, if any, are passed as an array to
    // the callback; if the first parameter is null all is well. In the
    // event of errors this method will still convert as many fields
    // as it can.
    //
    // The options argument can be completely omitted.
    //
    // By default, any errors are highlighted via showError().
    // If you explicitly set options.showErrors to false, errors are
    // not highlighted (but are still reported). This is useful
    // for autosave and similar operations.

    self.convert = function($el, schema, data, options, callback) {
      if (arguments.length === 4) {
        callback = options;
        options = {};
      }

      var showErrors = true;
      if (options.showErrors !== undefined) {
        showErrors = options.showErrors;
      }

      // remove any class names beginning with apos-error, which
      // cleans up apos-error, apos-error-required, etc. from
      // a previous convert run. -Tom

      self.findSafe($el, '[data-name]').each(function() {
        var $fieldset = $(this);
        var classes = $fieldset[0].className.split(/\s+/);
        _.each(classes, function(c) {
          if (c.match(/^apos-error/)) {
            $fieldset.removeClass(c);
          }
        });
        self.findSafe($fieldset, '[data-apos-fix-error]').remove();
      });

      var errors = [];

      return async.eachSeries(schema, function(field, callback) {
        if (field.contextual || field.readOnly) {
          return setImmediate(callback);
        }
        // This won't be enough for every type of field, so we pass $el too
        var $field = self.findField($el, field.name);
        if ((!$field.length) && field.legacy) {
          $field = self.findField($el, field.legacy);
        }
        var $fieldset = self.findFieldset($el, field.name);

        return self.fieldTypes[field.type].convert(data, field.name, $field, $el, field, function(err) {
          if (err) {
            if ($fieldset.hasClass('apos-hidden')) {
              // If this field is hidden by toggleHiddenFields, the user is not expected to
              // populate it, even if it would otherwise be required. This allows showFields to
              // function as intended, and as seen in A2 0.5. However if the converter
              // succeeds we do allow that to complete so that data is not lost if,
              // for instance, an option with a great deal of completed configuration
              // is temporarily toggled off via showFields. Just let it go.
              return setImmediate(callback);
            }

            // error can be an object, with field and type properties
            // (and room for expansion), or it can be a simple string,
            // in which case we invoke self.error to make an error object
            if (typeof (err) === 'string') {
              err = self.error(field, err);
            }
            if (showErrors) {
              self.showError($el, err);
              self.scrollToError($el);
            }
            errors.push(err);
          }
          return setImmediate(callback);
        });
      }, function() {
        return callback(errors.length ? errors : null);
      });
    };

    self.returnToError = function($el, schema, errorPath, error, callback) {
      var first = errorPath.shift();
      var $field = self.findField($el, first);
      var field = _.find(schema, { name: first });
      if (!field) {
        return setImmediate(callback);
      }
      var fieldType = self.fieldTypes[field.type];
      if (fieldType.returnToError) {
        return fieldType.returnToError(first, $field, $el, field, errorPath, error, callback);
      } else {
        self.showError($el, self.error(field, error));
      }
      return callback(null);
    };

    // Create a valid error object to be reported from a converter.
    // You can also report a string as an error in which case self.convert
    // creates one of these for you. The object is nice if you want to
    // extend it with extra properties

    self.error = function(field, type) {
      var error = {
        field: field,
        type: type
      };
      switch (type) {
        case 'required':
          error.message = 'Required';
          break;
        case 'min':
          error.message = 'Min. permitted value is: ' + field.min;
          break;
        case 'max':
          error.message = 'Max. permitted value is: ' + field.max;
          break;
        case 'invalid':
          error.message = 'Value is not valid';
          break;
        case 'taken':
          error.message = 'Already taken';
          break;
        case 'mandatory':
          if (typeof (field.mandatory) === 'string') {
            error.message = field.mandatory;
          } else {
            error.message = 'Consent is required to continue';
          }
          break;
      }
      return error;
    };

    // Add click handlers for group tabs
    self.enableGroupTabs = function($el) {
      $el.on('click', '[data-apos-open-group]', function() {
        var $tab = $(this);
        $el.find('[data-apos-open-group],[data-apos-group]').removeClass('apos-active');
        $tab.addClass('apos-active');
        $el.find('[data-apos-group="' + $tab.data('apos-open-group') + '"]').addClass('apos-active');
        return false;
      });
    };

    // Convert an in-context area, storing it in data[name],
    // if an editor is active
    self.contextualConvertArea = function(data, name, $el, field) {
      var $area = $el.findSafe('[data-apos-area][data-dot-path$="' + name + '"]', '[data-apos-area]');
      var editor = $area.data('editor');
      if (editor) {
        data[name] = {
          type: 'area',
          items: editor.serialize()
        };
      }
    };

    // Returns true if an editor is actually active for the given area
    self.contextualIsPresentArea = function($el, field) {
      var editor = $el.findSafe('[data-apos-area][data-dot-path$="' + field.name + '"]', '[data-apos-area]').data('editor');
      return !!editor;
    };

    self.enableSingleton = function($el, name, area, type, _options, callback) {
      if (typeof (_options) === 'function') {
        callback = _options;
        _options = {};
      }
      // Singletons are essentially areas with a limit of 1 and only one type
      // of widget permitted.
      var options = {};
      options.type = type;
      options.widgets = {};
      options.widgets[options.type] = _options;
      return self.enableArea($el, name, area, options, callback);
    };

    self.evaQueue = [];
    self.evaQueueTimeout = null;
    self.evaQueueRunning = false;

    // options argument may be skipped
    self.enableArea = function($el, name, area, options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var items = [];
      if (area && area.items) {
        items = area.items;
      } else if (_.isArray(area)) {
        // If populating an area that hasn't been converted server-side yet,
        // it might still be just an array of items instead of an area object
        // (this happens in the case of the area editor when switching between
        // different items).
        items = area;
      }
      var $fieldset = self.findFieldset($el, name);
      self.evaQueue.push({
        name: name,
        $fieldset: $fieldset,
        items: items,
        options: options
      });

      self.scheduleEvaQueue();

      return callback(null);
    };

    self.scheduleEvaQueue = function() {
      if (self.evaQueueTimeout) {
        clearTimeout(self.evaQueueTimeout);
      }
      self.evaQueueTimeout = setTimeout(self.runEvaQueue, 250);
    };

    self.runEvaQueue = function() {
      self.evaQueueTimeout = null;
      if (self.evaQueueRunning) {
        self.scheduleEvaQueue();
        return;
      }
      self.evaQueueRunning = true;
      // Avoid race condition by creating a new array for the next batch
      var queue = self.evaQueue;
      self.evaQueue = [];
      $.jsonCall(apos.areas.options.action + '/edit-virtual-areas',
        {
          areas: _.map(queue, function(area) {
            return {
              items: area.items,
              options: area.options
            };
          })
        },
        function(data) {
          _.map(data.areas, function(html, i) {
            var $fieldset = queue[i].$fieldset;
            var $editView = self.findSafe($fieldset, '[data-' + queue[i].name + '-edit-view]');
            $editView.append(html);
            // Make sure slideshows, videos, etc. get their JS
            apos.emit('enhance', $editView);
          });
          self.evaQueueRunning = false;
        },
        function(err) {
          // We are not pending on a callback so there isn't much else we can do
          // in the event of a network error
          apos.utils.error(err);
          self.evaQueueRunning = false;
          apos.notify('An error occurred rendering the dialog box. Please refresh and try again.', { type: 'error' });
        }
      );
    };

    self.getSingleton = function($el, name) {
      return self.getArea($el, name);
    };

    // Retrieve a JSON-friendly serialization of the area
    self.getArea = function($el, name) {
      var $fieldset = self.findFieldset($el, name);
      var $property = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
      return $property.find('[data-apos-area]:first').data('editor').serialize();
    };

    self.addFieldType = function(type) {
      self.fieldTypes[type.name] = type;
    };

    // Make an error visible. You can use this in your own validation
    // code, see self.error() for an easy way to make an error object

    self.showError = function($el, error) {
      var $fieldset = self.findFieldset($el, error.field.name);
      var type = self.fieldTypes[error.field.type];
      if (type.showError) {
        return type.showError($fieldset, error);
      }
      $fieldset.addClass('apos-error');
      $fieldset.addClass('apos-error--' + apos.utils.cssName(error.type));
      var $first = $fieldset.find('label:first');
      if (error.message) {
        $first.attr('data-apos-error-message', error.message);
      }
      $first.find('.apos-schema-fix').remove();
      if (error.fix) {
        var $fix = $('<a href="#" data-apos-fix-error="' + error.type + '" data-apos-fix-url="' + error.doc._url + '" data-apos-fix-id="' + error.doc._id + '" data-apos-fix-type="' + error.doc.type + '" class="apos-schema-fix">Edit Conflicting Content <span class="fa fa-external-link"></span></a>');
        if (error.hint) {
          $fix.attr('data-apos-fix-hint', error.hint);
        }
        $first.append($fix);
      }
      // makes it easy to do more with particular types of errors
      apos.emit('schemaError', $fieldset, error);
    };

    // A convenience allowing you to scroll to the first error present,
    // if any. convert() will call this if an error is present.
    // Also ensures the appropriate tab group is actually visible.

    self.scrollToError = function($el) {
      var $element = self.findSafe($el, '.apos-error');
      if ($element.length) {
        self.showGroupContaining($element);
        $element.scrollintoview();
        $element.find('input,select,textarea').first().focus();
      }
    };

    // Remove an error from the given fieldset. Not often required
    // because a fresh "convert" takes care of this completely,
    // but there are edge cases such as the "taken" error that
    // should be optimistically removed if the user elects to
    // use the wrench to edit the conflicting document.

    self.removeError = function($fieldset, error) {
      if ((typeof error) !== 'string') {
        error = error.type;
      }
      $fieldset.removeClass('apos-error--' + apos.utils.cssName(error));
      if ($fieldset.attr('class').indexOf('apos-error--') === -1) {
        $fieldset.removeClass('apos-error');
      }
      self.findSafe($fieldset, '[data-apos-fix-error="' + error + '"]').remove();
    };

    // Show the tab group containing the given element, if not already visible,
    // by triggering the appropriate tab button.
    self.showGroupContaining = function($element) {
      var $group = $element.closest('.apos-schema-group');
      if ($group.length) {
        if (!$group.hasClass('apos-active')) {
          var group = $group.attr('data-apos-group');
          var $container = $group.closest('[data-apos-form]');
          $container.find('[data-apos-open-group="' + group + '"]').trigger('click');
        }
      }
    };

    // Used to search for fieldsets at this level of the schema,
    // without false positives for any schemas nested within it.

    self.findFieldset = function($el, name) {
      return self.findSafe($el, '[data-name="' + name + '"]');
    };

    // Used to search for elements without false positives from nested
    // schemas in unrelated fieldsets, however see `findFieldset` or
    // `findSafeInFieldset` for what you probably want.
    //
    // Optimized implementation at the DOM level, the jQuery
    // `findSafe` plugin is much slower. Still returns a
    // jQuery object, so there is no incompatibility with
    // existing code that uses this method.

    // Used to search for elements without false positives from nested
    // schemas in unrelated fieldsets, however see `findFieldset` or
    // `findSafeInFieldset` for what you probably want.
    //
    // Optimized implementation at the DOM level, the jQuery
    // `findSafe` plugin is much slower. Still returns a
    // jQuery object, so there is no incompatibility with
    // existing code that uses this method.

    self.findSafe = function($el, sel) {
      if ((typeof sel) !== 'string') {
        // Optimized version only understands searching for
        // string selectors, maybe jQuery can do other tricks
        return $el.findSafe(sel, '.apos-field');
      }
      var el = $el[0];
      if (!el) {
        return $([]);
      }
      var fields = el.querySelectorAll(sel);
      fields = _.filter(fields, function(field) {
        var parent = field.parentNode;
        while (parent) {
          if (parent === el) {
            return true;
          }
          if (parent.classList && parent.classList.contains('apos-field')) {
            // A tricky catch: yes we found .apos-field, but
            // what if sel looks like '[data-name="tags"] [data-selective]'?
            // The first component of that selector IS an apos-field, so
            // it shouldn't block itself. The solution is to check whether
            // the apos-field we just walked up the tree to actually contains
            // our element when filtered for the original selector.
            var matches = parent.querySelectorAll(sel);
            if (_.find(matches, function(match) {
              return match === field;
            })) {
              return false;
            }
          }
          parent = parent.parentNode;
        }
      });
      return $(fields);
    };

    // A convenient way to find something safely within a specific fieldset
    // (safely means "not inside a nested schema"). The fieldset is found first,
    // then `sel` is located within it, without recursing into any nested
    // schema forms that may be present.

    self.findSafeInFieldset = function($el, name, sel) {
      var $fieldset = self.findFieldset($el, name);
      return $fieldset.findSafe(sel, '.apos-field');
    };

    // Used to search for simple elements that have a
    // "name" attribute, without false positives from nested
    // schemas in unrelated fieldsets.
    self.findField = function($el, name) {
      var $fieldset = self.findFieldset($el, name);
      return self.findSafe($fieldset, '[name="' + name + '"]');
    };

    self.enhanceSelectiveWithSlugs = function($field) {
      // Change the presentation to include the slug.
      // Based on: http://jqueryui.com/autocomplete/#custom-data
      // I stuck with that markup with a minimum of new markup to
      // allow styling. -Tom
      var $autocomplete = self.findSafe($field, "[data-autocomplete]");
      $autocomplete.data("ui-autocomplete")._renderItem = function(ul, item) {
        var inner = '<a><div class="apos-autocomplete-label">' + item.label + '</div>';
        if (item.slug && (item.slug.match)) {
          inner += '<div class="apos-autocomplete-slug">' + item.slug + '</div>';
        }
        inner += '</a>';
        return $('<li class="apos-autocomplete-item">')
          .append(inner)
          .appendTo(ul);
      };
    };

    // Return a new object with all default settings
    // defined in the schema
    self.newInstance = function(schema) {
      var def = {};
      _.each(schema, function(field) {
        var fieldType = self.fieldTypes[field.type];
        if (field.def !== undefined) {
          def[field.name] = field.def;
        } else if (fieldType.getDefault) {
          def[field.name] = fieldType.getDefault();
        }
      });
      return def;
    };

    // Enable autocomplete of tags. Expects the fieldset element
    // (not the input element) and an array of existing tags already
    // assigned to this item. Exported for the convenience of
    // code that is not fully schema-based but wants to enhance
    // tag fields in the same way.
    self.enableTags = function($el, tags, field) {
      tags = tags || [];
      field = field || {};
      // our fieldsets no longer have a data-selective attribute,
      // instead there is a wrapper div inside that does. This code
      // works when enableTags is passed either the fieldset or
      // the inner wrapper div. -Tom
      if (!$el[0].hasAttribute('data-selective')) {
        $el = $el.find('[data-selective]:first');
      }
      $el.on('click', '[data-list]', function() {
        $el.find('input').focus();
      });
      $el.on('change', function() {
        $el.find('[data-list]').toggleClass('apos-empty', !$el.find('[data-item]').length);
      });
      // TODO bring back lock tags
      // if (apos.data.lockTags) {
      //   $el.find('[data-add]').remove();
      // }
      if (!field.limit) {
        field.limit = undefined;
      }
      if (!field.sortable) {
        field.sortable = undefined;
      }
      $el.selective({ preventDuplicates: true, add: true, /* !apos.data.lockTags, */ data: tags, source: source, addKeyCodes: [ 13, 'U+002C' ], limit: field.limit, sortable: field.sortable, nestGuard: '[data-selective]' });
      // Set initial empty state correctly
      if (!tags.length) {
        $el.find('[data-list]').addClass('apos-empty');
      }
      function source(request, callback) {
        return $.jsonCall('/modules/apostrophe-tags/autocomplete', request, callback);
      }
    };

    // Reusable utility to watch the title and use it to
    // suggest valid slugs.
    //
    // If the initial slug contains slashes, only the last component
    // (after the last slash) is changed on title edits.
    //
    // If the original slug (or its last component) is not in sync with the
    // title, it is assumed that the user already made deliberate changes to
    // the slug, and the slug is not automatically updated.
    //
    // `$title` and `$slug` are jQuery objects referencing the actually
    // input elements. `title` and `slug` are the schema field definitions.
    //
    // This has become an implementation detail of enableSlugSuggestions
    // but for bc it remains a publicly available API.

    self.enableSlug = function($title, $slug, title, slug) {
      if (!$title.length || !$slug.length) {
        return;
      }
      // Watch the title for changes, update the slug - but only if
      // the slug was in sync with the title to start with
      var originalTitle = $title.val();
      var currentSlug = $slug.val();
      var components = currentSlug.split('/');
      var currentSlugTitle = components.pop();
      var prefix = '';
      if ($slug.data('prefix')) {
        prefix = $slug.data('prefix') + '-';
      }
      if ((originalTitle === '') || (currentSlugTitle === apos.utils.slugify(prefix + originalTitle))) {
        $title.on('textchange', function(e) {
          $slug.val($slug.val().replace(/[^/]*$/, apos.utils.slugify(prefix + $title.val())));
        });
      }
    };

    self.watchSlugConflicts = function($title, $slug, title, slug, object) {
      if (!slug.checkTaken) {
        return;
      }
      if (slug.deconflict === false) {
        return;
      }
      var watchSlugTimeout;
      $title.off('textchange.watchSlugConflicts');
      $title.on('textchange.watchSlugConflicts', function() {
        if (watchSlugTimeout) {
          return;
        }
        watchSlugTimeout = setTimeout(watchSlug, 500);
        function watchSlug() {
          $.jsonCall(apos.docs.options.action + '/slug-deconflict', {
            _id: object._id,
            slug: $slug.val()
          }, function(result) {
            clearTimeout(watchSlugTimeout);
            watchSlugTimeout = null;
            if (result.status === 'ok') {
              $slug.val(result.slug);
            }
          });
        }
      });
    };

    self.enableShowFields = function(data, name, $field, $el, field) {

      var $fieldset = self.findFieldset($el, name);

      // afterChange shows and hides other fieldsets based on
      // the current value of this field and its visibility.
      // We do this in three situations: at startup, when the
      // user changes the value, and when the visibility of this
      // field has been affected by another field with the
      // showFields option. This allows nested showFields to
      // work properly. -Tom

      afterChange();

      $field.on('change', afterChange);
      $fieldset.on('aposShowFields', afterChange);
      function afterChange() {
        // Implement showFields

        if (!_.find(field.choices || [], function(choice) {
          return choice.showFields;
        })) {
          // showFields is not in use for this select
          return;
        }

        var val;
        if (field.checkbox) {
          val = $field.is(':checked');
        } else {
          val = $field.val();
        }

        // Recall if another choice currently active already chose to show each field.
        // That way, if two choices show the same field, the fact that the second one
        // is not currently selected does not hide the field the first one just showed
        var shown = {};

        _.each(field.choices || [], function(choice) {

          // Show the fields for this value if it is the current value
          // *and* the select field itself is currently visible

          var show;

          if ($fieldset.hasClass('apos-hidden')) {
            show = false;
          } else if (field.type === 'boolean') {
            // Comparing boolean values is hard because
            // the string '0' must be considered falsy in
            // order to permit use of select elements. -Tom
            if (val === choice.value) {
              show = true;
            } else if (!choice.value) {
              if ((!val) || (val === '0')) {
                show = true;
              }
            } else {
              if (val && (val !== '0')) {
                show = true;
              }
            }
          } else if (field.type === 'checkboxes') {
            _.each($field || [], function(checkbox) {
              if (checkbox.checked && checkbox.value === choice.value && choice.showFields) {
                show = true;
              }
            });
          } else {
            // type select
            if (val === choice.value.toString()) {
              show = true;
            }
          }

          _.each(choice.showFields || [], function(fieldName) {
            if (show || shown[fieldName]) {
              shown[fieldName] = true;
            } else {
              shown[fieldName] = false;
            }
            var $fieldset = self.findFieldset($el, fieldName);

            $fieldset.toggleClass('apos-hidden', !shown[fieldName]);
            $fieldset.trigger('aposShowFields');
          });

        });

      }
    };

    self.addFieldType({
      name: 'area',
      populate: function(data, name, $field, $el, field, callback) {
        return self.enableArea($el, name, data[name], field.options || {}, callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = self.getArea($el, name);
        if (field.required && (!data[name].length)) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      contextualConvert: self.contextualConvertArea,
      contextualIsPresent: self.contextualIsPresentArea
    });

    self.addFieldType({
      name: 'singleton',
      populate: function(data, name, $field, $el, field, callback) {
        return self.enableSingleton($el, name, data[name], field.widgetType, field.options || {}, callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = self.getSingleton($el, name);
        if (field.required && (!data[name].length)) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      contextualConvert: self.contextualConvertArea,
      contextualIsPresent: self.contextualIsPresentArea
    });

    self.addFieldType({
      name: 'array',
      populate: function(data, name, $field, $el, field, callback) {
        var $button = self.findSafeInFieldset($el, name, '[data-apos-edit-array]');
        function setArray(value) {
          var length = value ? value.length : 0;
          $field.data('apos-array', value);
          $field.find('.apos-field-label').html(field.label);
          $field.find('[data-array-length]')
            .html('(' + length + ' Item' + ((length > 1 || length === 0) ? 's)' : ')'));
        }

        setArray(data[name]);

        $button.on('click', function() {
          var $fieldset = self.findFieldset($el, name);
          // Mimicking .getTool from docs . . .
          apos.create('apostrophe-array-editor-modal', {
            field: field,
            arrayItems: $field.data('apos-array'),
            action: options.action,
            save: setArray,
            error: $fieldset.data('error'),
            errorPath: $fieldset.data('errorPath')
          }, function(err) {
            if (err) {
              apos.utils.error(err);
            }
          });
          return false;
        });
        return setImmediate(callback);
      },
      returnToError: function(name, $field, $el, field, errorPath, error, callback) {
        var $fieldset = self.findFieldset($el, name);
        $fieldset.data('error', error);
        $fieldset.data('errorPath', errorPath);
        var $button = self.findSafeInFieldset($el, name, '[data-apos-edit-array]');
        $button.click();
      },
      convert: function(data, name, $field, $el, field, callback) {
        if ($field.data('apos-array')) {
          data[name] = $field.data('apos-array');
        }
        // Confirm that the widget is truly empty.
        if (field.required && (!(data[name] && data[name][0]))) {
          return callback('required');
        }
        return setImmediate(callback);
      },
      contextualConvert: function(data, name, $el, field) {
        // We cannot call getWidgetData here because of recursion
        var existingData = JSON.parse($el.attr('data') || '{}');
        if (!existingData) {
          return;
        }
        var dotPath = existingData.__dotPath;
        var docId = existingData.__docId;
        if (!dotPath && docId) {
          return;
        }
        existingData = existingData[name];
        if (!existingData) {
          return;
        }
        // Contextually convert any areas
        // that are fields of this array field
        _.each(field.schema, function(sub) {
          if ((sub.type !== 'area') && (sub.type !== 'singleton')) {
            return;
          }
          var n = 0;
          while (true) {
            var selector = '[data-apos-area][data-doc-id="' + docId + '"][data-dot-path="' + dotPath + '.' + name + '.' + n + '.' + sub.name + '"]';
            var $area = $el.find(selector);
            if (!$area.length) {
              break;
            }
            var editor = $area.data('editor');
            if (editor) {
              if (existingData[n]) {
                existingData[n][sub.name] = {
                  type: 'area',
                  items: editor.serialize()
                };
              }
            }
            n++;
          }
        });
        data[name] = existingData;
      },
      // Always returns true because it is designed to work nondestructively
      // with fields that don't turn out to be contextual
      contextualIsPresent: function($el, field) {
        return true;
      },
      getDefault: function() {
        return [];
      }
    });

    self.addFieldType({
      name: 'object',
      populate: function(data, name, $field, $el, field, callback) {
        if (data[name] === undefined) {
          data[name] = {};
        }
        var $fieldset = self.findFieldset($el, name);
        self.populate($fieldset, field.schema, data[name], callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        if (data[name] === undefined) {
          data[name] = {};
        }
        var $fieldset = self.findFieldset($el, name);
        self.convert($fieldset, field.schema, data[name], function(errors) {
          var err = null;
          if (errors) {
            $fieldset.data('nestedErrors', errors);
            err = 'invalid';
          }
          return callback(err);
        });
      },
      showError: function($fieldset, err) {
        var nestedErrors = $fieldset.data('nestedErrors');
        $fieldset.data('nestedErrors', null);
        if (nestedErrors) {
          self.showError($fieldset, nestedErrors[0]);
        }
      },
      contextualConvert: function(data, name, $el, field) {
        // We cannot call getWidgetData here because of recursion
        var existingData = JSON.parse($el.attr('data') || '{}');
        if (!existingData) {
          return;
        }
        var dotPath = existingData.__dotPath;
        var docId = existingData.__docId;
        if (!dotPath && docId) {
          return;
        }
        existingData = existingData[name];
        if (!existingData) {
          return;
        }
        // Contextually convert any areas
        // that are fields of this array field
        _.each(field.schema, function(sub) {
          if ((sub.type !== 'area') && (sub.type !== 'singleton')) {
            return;
          }
          var selector = '[data-apos-area][data-doc-id="' + docId + '"][data-dot-path="' + dotPath + '.' + name + '.' + sub.name + '"]';
          var $area = $el.find(selector);
          if (!$area.length) {
            return;
          }
          var editor = $area.data('editor');
          if (editor) {
            if (existingData) {
              existingData[sub.name] = {
                type: 'area',
                items: editor.serialize()
              };
            }
          }
        });
        data[name] = existingData;
      },
      // Always returns true because it is designed to work nondestructively
      // with fields that don't turn out to be contextual
      contextualIsPresent: function($el, field) {
        return true;
      },
      getDefault: function() {
        return {};
      }
    });

    self.addFieldType({
      name: 'joinByOne',
      populate: function(data, name, $field, $el, field, callback) {
        var manager;
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        var chooserGetter;
        if (!chooser) {
          if (Array.isArray(field.withType)) {
            manager = apos.docs.getManager('apostrophe-polymorphic');
            chooserGetter = _.partial(manager.getTool, 'chooser');
          } else {
            manager = apos.docs.getManager(field.withType);
            chooserGetter = _.partial(manager.getTool, 'chooser');
          }
          return chooserGetter({ field: field, $el: $fieldset.find('[data-chooser]') }, function(err, _chooser) {
            if (err) {
              return callback(err);
            }
            chooser = _chooser;
            var choices = [];
            if (data[field.idField]) {
              choices.push({ value: data[field.idField] });
            }
            chooser.set(choices);
            $fieldset.data('aposChooser', chooser);
            return callback(null);
          });
        }
      },
      convert: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        return chooser.getFinal(function(err, choices) {
          if (err) {
            return callback(err);
          }
          data[field.idField] = null;
          if (choices[0]) {
            data[field.idField] = choices[0].value;
          }
          if ((field.required) && (!data[field.idField])) {
            return callback('required');
          }
          return callback(null);
        });
      }
    });

    self.addFieldType({
      name: 'joinByOneReverse',
      populate: function(data, name, $field, $el, field, callback) {
        // Not edited on the reverse side
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        // Not edited on this side of the relation
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'joinByArray',
      populate: function(data, name, $field, $el, field, callback) {
        var chooser;
        var manager;
        var $fieldset = self.findFieldset($el, name);

        return async.series({
          getChooser: function(callback) {
            chooser = $fieldset.data('aposChooser');
            var chooserGetter;
            if (!chooser) {
              if (Array.isArray(field.withType)) {
                manager = apos.docs.getManager('apostrophe-polymorphic');
                chooserGetter = _.partial(manager.getTool, 'chooser');
              } else {
                manager = apos.docs.getManager(field.withType);
                chooserGetter = _.partial(manager.getTool, 'chooser');
              }
              return chooserGetter({ field: field, $el: $fieldset.find('[data-chooser]') }, function(err, _chooser) {
                if (err) {
                  return callback(err);
                }
                chooser = _chooser;
                var choices = [];
                if (data[field.idField]) {
                  choices.push({ value: data[field.idField] });
                }
                chooser.set(choices);
                $fieldset.data('aposChooser', chooser);
                return callback(null);
              });
            }
          },
          set: function(callback) {
            var choices = [];
            if (data[field.idsField]) {
              choices = _.map(data[field.idsField], function(id) {
                return { value: id };
              });
            }
            if (field.relationship) {
              var relationships = data[field.relationshipsField] || {};
              _.each(choices, function(choice) {
                var relationship = relationships[choice.value] || {};
                _.assign(choice, relationship);
              });
            }
            chooser.set(choices);
            return setImmediate(callback);
          }
        }, callback);
      },

      convert: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        return chooser.getFinal(function(err, choices) {
          if (err) {
            return callback(err);
          }
          var removed = _.filter(choices, { __removed: true });
          choices = _.difference(choices, removed);
          data[field.idsField] = _.pluck(choices, 'value');
          data[field.removedIdsField] = _.pluck(removed, 'value');
          if (field.relationship) {
            data[field.relationshipsField] = data[field.relationshipsField] || {};
            var relationships = data[field.relationshipsField];
            // Yes, we send up the relationships for the removed fields too.
            // This is because some relationships are interesting only at the
            // moment of removal, like an "apply to subpages" checkbox for
            // permissions. -Tom
            _.each(choices.concat(removed), function(choice) {
              if (!relationships[choice.value]) {
                relationships[choice.value] = {};
              }
              var relationship = relationships[choice.value];
              _.each(choice, function(value, key) {
                if (key !== 'value') {
                  relationship[key] = value;
                }
              });
            });
          }
          if ((field.required) && (!(data[field.idsField] && data[field.idsField][0]))) {
            return callback('required');
          }
          return callback(null);
        });
      }
    });

    self.addFieldType({
      name: 'joinByArrayReverse',
      populate: function(data, name, $field, $el, field, callback) {
        // Not edited on the reverse side
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        // Not edited on this side of the relation
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'group',
      populate: function(data, name, $field, $el, field, callback) {
        // Just a presentation thing
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        // Just a presentation thing
        return setImmediate(callback);
      }
    });

    function convertString(data, name, $field, $el, field, callback) {
      var err;
      data[name] = $field.val();
      if (field.required && (!(data[name] && data[name].length))) {
        err = self.error(field, 'required');
        return setImmediate(_.partial(callback, err));
      }
      if (data[name] && field.max && (data[name].length > field.max)) {
        err = self.error(field, 'max');
        err.message = 'Maximum of ' + field.max + ' characters';
        return setImmediate(_.partial(callback, err));
      }
      if (data[name] && field.min && (data[name].length < field.min)) {
        err = self.error(field, 'min');
        err.message = 'Minimum of ' + field.min + ' characters';
        return setImmediate(_.partial(callback, err));
      }
      return setImmediate(callback);
    }

    function populateString(data, name, $field, $el, field, callback) {
      $field.val(data[name]);
      if (field.max) {
        if (field.textarea) {
          if (field.max) {
            var $fieldset = self.findFieldset($el, name);
            $fieldset.removeClass('apos-max');
            $field.off('textchange.schema');
            $field.on('textchange.schema', function() {
              var length = $field.val().length;
              if (length > field.max) {
                $fieldset.addClass('apos-max');
              } else {
                $fieldset.removeClass('apos-max');
              }
            });
          }
        } else {
          $field.attr('maxlength', field.max);
        }
      }
      return setImmediate(callback);
    }

    self.addFieldType({
      name: 'string',
      populate: populateString,
      convert: convertString
    });

    self.addFieldType({
      name: 'password',
      populate: populateString,
      convert: convertString
    });

    self.addFieldType({
      name: 'slug',
      populate: populateString,
      convert: function(data, name, $field, $el, field, callback) {
        return convertString(data, name, $field, $el, field, function(err) {
          if (field.prefix) {
            if (data[name].length && (data[name].substring(0, field.prefix.length) !== field.prefix)) {
              var error = self.error(field, 'prefix');
              error.message = 'The slug must begin with: ' + field.prefix;
              return callback(error);
            }
          }
          if (!field.checkTaken) {
            // A slug field being used for a purpose other
            // than an apostrophe doc
            return callback(null);
          }
          if (err) {
            return callback(err);
          }
          $.jsonCall(
            apos.docs.options.action + '/slug-taken',
            { slug: data[name], _id: data._id },
            function(data) {
              if (data.status === 'ok') {
                return callback(null);
              } else if (data.status === 'taken') {
                var error = self.error(field, 'taken');
                error.doc = data.doc;
                error.hint = data.hint;
                error.fix = true;
                return callback(error);
              } else {
                return callback('error');
              }
            }, function(err) {
              apos.utils.error(err);
              return callback(err);
            }
          );
        });
      }
    });

    self.addFieldType({
      name: 'tags',
      populate: function(data, name, $field, $el, field, callback) {
        self.enableTags(self.findSafe($el, '[data-name="' + name + '"]'), data[name], field || {});
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = self.findSafeInFieldset($el, name, '[data-selective]').selective('get', { incomplete: true });
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'boolean',
      populate: function(data, name, $field, $el, field, callback) {
        if (data[name] === true || data[name] === '1') {
          $field.val('1');
        } else {
          $field.val('0');
        }
        self.enableShowFields(data, name, $field, $el, field);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        // `mandatory` property used for consent checks (I agree)
        if (field.mandatory && (!data[name] || data[name] === '0')) {
          return setImmediate(_.partial(callback, 'mandatory'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'checkboxes',
      populate: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, name);
        return async.series([
          getChoices,
          renderChoices
        ], callback);
        function getChoices(callback) {
          if ((typeof field.choices) !== 'string') {
            $fieldset.data('aposChoices', field.choices);
            return callback(null);
          }
          // Dynamic choices
          apos.ui.globalBusy(true);
          return self.api('choices', {
            field: field
          }, function(result) {
            apos.ui.globalBusy(false);
            if (result.status !== 'ok') {
              return callback(result.status);
            }
            // Replace the markup with a server side
            // rendering of the actual dynamic choices.
            // Preserve the original field label because of
            // the precedent that workflow controls may
            // be appended to it and already have
            // behaviors bound.
            var markup = result.markup;
            var $newFieldset = $(markup);
            var $fieldset = self.findFieldset($el, field.name);
            var $label = $fieldset.find('label:first');
            var $newLabel = $newFieldset.find('label:first');
            $newLabel.replaceWith($label);
            $fieldset.html('');
            $fieldset.append($newFieldset.children());
            $fieldset.data('aposChoices', result.choices);
            return callback(null);
          }, function(err) {
            apos.ui.globalBusy(false);
            return callback(err);
          });
        }
        function renderChoices(callback) {
          // Server did the actual rendering, we just need to
          // select the existing choices
          var $fieldset = self.findFieldset($el, name);
          for (var c in data[name]) {
            self.findSafe($fieldset, 'input[name="' + name + '"][value="' + data[name][c] + '"]', '.apos-field').prop('checked', true);
          }
          self.enableShowFields(data, name, $field, $el, field);
          return setImmediate(callback);
        }
      },
      convert: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, field.name);
        var values = [];
        var choices = $fieldset.data('aposChoices');
        for (var c in choices) {
          var val = choices[c].value;
          var checked = $field.filter('[value="' + val + '"]').prop('checked');
          if (checked) {
            values.push(val);
          }
        }
        data[name] = values;
        if (field.required && !data[name]) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'radioTable',
      populate: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, name);
        _.each(data[name], function(value, rowName) {
          $fieldset.find('input[name="' + name + '[' + rowName + ']"]').radio(value);
        });
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        var newData = {};
        _.each(field.rows, function(row) {
          var $fieldset = self.findFieldset($el, name);
          newData[row.name] = $fieldset.find('input[name="' + name + '[' + row.name + ']"]').radio();
        });
        data[name] = newData;
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'select',
      populate: function(data, name, $field, $el, field, callback) {
        var choices;
        return async.series([
          getChoices,
          renderChoices
        ], callback);
        function getChoices(callback) {
          if ((typeof field.choices) !== 'string') {
            choices = field.choices;
            return callback(null);
          }
          // Dynamic choices
          apos.ui.globalBusy(true);
          return self.api('choices', {
            field: field
          }, function(result) {
            apos.ui.globalBusy(false);
            if (result.status !== 'ok') {
              return callback(result.status);
            }
            choices = result.choices;
            // Replace the markup with a server side
            // rendering of the actual dynamic choices.
            // Preserve the original field label because of
            // the precedent that workflow controls may
            // be appended to it and already have
            // behaviors bound.
            var markup = result.markup;
            var $fieldset = self.findFieldset($el, field.name);
            var $newFieldset = $(markup);
            var $label = $fieldset.find('label:first');
            var $newLabel = $newFieldset.find('label:first');
            $newLabel.replaceWith($label);
            $fieldset.html('');
            $fieldset.append($newFieldset.children());
            $field = $fieldset.findByName(field.name);
            return callback(null);
          }, function(err) {
            apos.ui.globalBusy(false);
            return callback(err);
          });
        }
        function renderChoices(callback) {
          var $options = $field.find('option');
          // Synthesize options from the choices in the schema, unless
          // the frontend developer has chosen to do it for us.
          if (!$options.length) {
            _.each(choices, function(choice) {
              var $option = $('<option></option>');
              $option.text(choice.label);
              $option.attr('value', choice.value);
              $field.append($option);
            });
          }
          var value = ((data[name] === undefined) && field.choices[0]) ? field.choices[0].value : data[name];
          if (value != null) {
            if (value.toString) {
              // Correctly locate existing option when current
              // value is a number rather than a string
              value = value.toString();
            }
          }
          $field.val(value);
          self.enableShowFields(data, name, $field, $el, field);
          return setImmediate(callback);
        }
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && (!(data[name] && data[name].length))) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'integer',
      populate: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && (!(data[name] && data[name].length))) {
          return setImmediate(_.partial(callback, 'required'));
        }
        if (data[name] && isNaN(parseFloat(data[name]))) {
          return setImmediate(_.partial(callback, 'invalid'));
        }
        if (data[name] && field.max !== undefined && parseInt(data[name], 10) > field.max) {
          return setImmediate(_.partial(callback, 'max'));
        }
        if (data[name] && field.min !== undefined && parseInt(data[name], 10) < field.min) {
          return setImmediate(_.partial(callback, 'min'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'float',
      populate: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && (!(data[name] && data[name].length))) {
          return setImmediate(_.partial(callback, 'required'));
        }
        if (data[name] && isNaN(parseFloat(data[name]))) {
          return setImmediate(_.partial(callback, 'invalid'));
        }
        if (data[name] && field.max !== undefined && parseFloat(data[name]) > field.max) {
          return setImmediate(_.partial(callback, 'max'));
        }
        if (data[name] && field.min !== undefined && parseFloat(data[name]) < field.min) {
          return setImmediate(_.partial(callback, 'min'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'email',
      populate: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {

        data[name] = $field.val();

        if (!data[name].length) {
          if (field.required) {
            return setImmediate(_.partial(callback, 'required'));
          }
          return setImmediate(callback);
        }

        // regex source: https://emailregex.com/
        // eslint-disable-next-line no-useless-escape
        var matches = data[name].match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
        if (!matches) {
          return setImmediate(_.partial(callback, 'invalid'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'url',
      populate: populateString,
      convert: convertString
    });

    self.addFieldType({
      name: 'date',
      populate: function(data, name, $field, $el, field, callback) {
        // Never good here, breaks calendar UI
        $field.attr('autocomplete', 'off');
        $field.val(data[name]);
        apos.ui.enhanceDate($field, field.pikadayOptions || {});
        if (field.legacy) {
          apos.ui.enhanceDate(self.findField($el, field.legacy), field.pikadayOptions || {});
        }
        return setImmediate(callback);
      },
      convert: convertString
    });

    self.addFieldType({
      name: 'time',
      populate: function(data, name, $field, $el, field, callback) {
        if (data[name] && data[name].length) {
          // Revert to local time for editing
          $field.val(apos.ui.formatTime(data[name]));
        }
        return setImmediate(callback);
      },
      convert: convertString
    });

    self.addFieldType({
      name: 'color',
      populate: function (data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        var options = field.spectrumOptions || {};
        var defaults = {
          showButtons: true,
          showAlpha: true,
          preferredFormat: 'hex',
          showInput: true,
          allowEmpty: true
        };

        field.options = _.merge(defaults, options || {});
        // populate color last and outside of merge
        field.options.color = data[name];
        apos.ui.enhanceColorpicker($field, data[name], field.options);
        return setImmediate(callback);
      },
      convert: function (data, name, $field, $el, field, callback) {
        if ($field.spectrum('get')) {
          data[name] = $field.val();
        } else {
          data[name] = null;
        }
        if (field.required && data[name] === null) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'range',
      populate: function (data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        var $valueIndicator = $field.prev();
        $valueIndicator.text($field.val());
        $field.on('input', function() {
          $valueIndicator.text($field.val());
          $field.trigger('change');
        });
        return setImmediate(callback);
      },
      convert: function (data, name, $field, $el, field, callback) {
        data[name] = $field.val();

        if (field.required && data[name] === null) {
          return setImmediate(_.partial(callback, 'required'));
        }

        return setImmediate(callback);
      }
    });

    apos.schemas = self;
  }
});
