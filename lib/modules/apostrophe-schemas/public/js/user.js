apos.define('apostrophe-schemas', {

  construct: function(self, options) {

    self.fieldTypes = {};

    // Populate form elements corresponding to a set of fields as
    // specified in a schema (the schema argument). The inverse of
    // self.convert
    self.populate = function($el, schema, object, callback) {
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
          // apos.log(field);
          if (field.required === true) {
            self.findFieldset($el, field.name).addClass('apos-required');
          }
          return setImmediate(callback);
        });

      }, afterPopulate);

      function afterPopulate() {

        // TODO: it's not great that this is hardcoded here and is not
        // in the docs module somehow

        function enableSlugSuggestions() {
          var title = _.find(schema, function(field) {
            return field.name === 'title';
          });
          var slug = _.find(schema, function(field) {
            return (field.name === 'slug') && (field.type === 'slug');
          });

          if (!(title && slug)) {
            return;
          }

          var $title = self.findField($el, 'title');
          var $slug = self.findField($el, 'slug');
          self.enableSlug($title, $slug);
        }

        // This function actually toggles the things based on data-showFields of options in select
        function toggleHidden($select) {

          // First hide all the fields in our unselected options
          var $hideFieldOptions = $select.siblings('.selectize-control').find('.selectize-dropdown-content div:not(.selected)');

          _.each($hideFieldOptions, function(hideFieldOption){
            var hideFields = $(hideFieldOption).attr('data-showFields');

            if (hideFields && hideFields.length > 0) {
              hideFields = hideFields.split(',');

              _.each(hideFields, function(field){
                var $fieldset = self.findFieldset($el, field);
                var $helpText = $fieldset.next('p.apos-help');
                $fieldset.addClass('apos-hidden');
                $helpText.addClass('apos-hidden');
              });
            }
          });

          // Now show the fields for our selected option
          var showFields = $select.siblings('.selectize-control').find('[data-selected]').attr('data-showFields');
          if (showFields && showFields.length > 0) {
            showFields = showFields.split(',');

            _.each(showFields, function(field){
              var $fieldset = self.findFieldset($el, field);
              var $helpText = $fieldset.next('p.apos-help');
              $fieldset.removeClass('apos-hidden');
              $helpText.removeClass('apos-hidden');
            });
          }
        }

        // This was nested inside apos.on('enhance'). That doesn't
        // make sense, that event could be getting called for
        // something that doesn't even contain a schema... we're
        // already at the right point in the flow... we should
        // just do the things. -Tom

        // loop over any (safe) select we've marked for functionality, do initial toggle, add listener
        _.each(schema, function(field) {
          if (field.type == 'select') {
            var $fieldset = self.findFieldset($el, field.name);

            if ($fieldset.hasClass('apos-fieldset-select-show-fields')){
              var $toggleSelect = self.findSafe($fieldset, 'select');
              setImmediate(function() {
                toggleHidden($toggleSelect);
              });
              $toggleSelect.on('change', function(){
                toggleHidden($(this));
              });
            }
          }
        });

        enableSlugSuggestions();
        callback(null);
      }
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
          if (c.match(/^apos\-error/)) {
            $fieldset.removeClass(c);
          }
        });
      });

      var errors = [];

      return async.eachSeries(schema, function(field, callback) {
        if (field.contextual) {
          return setImmediate(callback);
        }
        // This won't be enough for every type of field, so we pass $el too
        var $field = self.findField($el, field.name);
        if (!$field.length) {
          $field = self.findField($el, field.legacy);
        }
        return self.fieldTypes[field.type].convert(data, field.name, $field, $el, field, function(err) {
          if (err) {
            // error can be an object, with field and type properties
            // (and room for expansion), or it can be a simple string,
            // in which case we invoke self.error to make an error object
            if (typeof(err) === 'string') {
              err = self.error(field, err);
            }
            if (showErrors) {
              self.showError($el, err);
            }
            errors.push(err);
          }
          return setImmediate(callback);
        });
      }, function() {
        return callback(errors.length ? errors : null);
      });
    };

    // Create a valid error object to be reported from a converter.
    // You can also report a string in which case self.convert creates
    // one of these for you. The object is nice if you want to extend it
    // with extra properties

    self.error = function(field, type) {
      return {
        field: field,
        type: type
      }
    };

    self.enableSingleton = function($el, name, area, type, options, callback) {
      if (typeof(options) === 'function') {
        callback = options;
        options = {};
      }
      // Singletons are essentially areas with a limit of 1 and only one type
      // of widget permitted.
      options.type = type;
      return self.enableArea($el, name, area, options, callback);
    };

    // options argument may be skipped
    self.enableArea = function($el, name, area, options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var items = [];
      if (area && area.items) {
        items = area.items;
      }
      var $fieldset = self.findFieldset($el, name);
      $.jsonCall(apos.areas.options.action + '/edit-virtual-area',
        { dataType: 'html' },
        { items: items, options: options }, function(data) {
        var $editView = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
        $editView.append(data);
        // Make sure slideshows, videos, etc. get their JS
        apos.emit('enhance', $editView);
        return callback(null);
      });
    };

    self.getSingleton = function($el, name) {
      return self.getArea($el, name);
    };

    // Retrieve a JSON-friendly serialization of the area
    self.getArea = function($el, name) {
      var $fieldset = self.findFieldset($el, name);
      var $property = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
      return $property.find('[data-area]:first').data('editor').serialize();
    };

    self.addFieldType = function(type) {
      self.fieldTypes[type.name] = type;
    };

    // Make an error visible. You can use this in your own validation
    // code, see self.error() for an easy way to make an error object

    self.showError = function($el, error) {
      var $fieldset = self.findFieldset($el, error.field.name);
      $fieldset.addClass('apos-error');
      $fieldset.addClass('apos-error-' + apos.utils.cssName(error.type));
      // makes it easy to do more with particular types of errors
      apos.emit('schemaError', $fieldset, error);
    };

    // A convenience allowing you to scroll to the first error present,
    // if any. Not called automatically. You can call this when
    // convert passes an error or when your own validation code
    // has invoked showError().

    self.scrollToError = function($el) {
      // Awesome plugin
      var $element = self.findSafe($el, '.apos-error').scrollintoview();
      $element.find('input,select,textarea').first().focus();
    };

    // Used to search for fieldsets at this level of the schema,
    // without false positives for any schemas nested within it
    self.findFieldset = function($el, name) {
      return self.findSafe($el, '[data-name="' + name + '"]');
    };

    // Used to search for elements without false positives from nested
    // schemas in unrelated fieldsets
    self.findSafe = function($el, sel) {
      return $el.findSafe(sel, '.apos-fieldset');
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
      $autocomplete.data( "ui-autocomplete" )._renderItem = function(ul, item) {
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

    self.newInstance = function(schema) {
      var def = {};
      _.each(schema, function(field) {
        if (field.def !== undefined) {
          def[field.name] = field.def;
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
      apos.log('TODO: bring back lockTags');
      // if (apos.data.lockTags) {
      //   $el.find('[data-add]').remove();
      // }
      if (!field.limit) {
        field.limit = undefined;
      }
      if (!field.sortable) {
        field.sortable = undefined;
      }
      $el.selective({ preventDuplicates: true, add: true, /* !apos.data.lockTags, */ data: tags, source: '/modules/apostrophe-tags/autocomplete', addKeyCodes: [ 13, 'U+002C'], limit: field.limit, sortable: field.sortable, nestGuard: '[data-selective]' });
    };

    // Reusable utility to watch the title and use it to
    // suggest valid slugs.

    // If the initial slug contains slashes, only the last component
    // (after the last slash) is changed on title edits.

    // If the original slug (or its last component) is not in sync with the
    // title, it is assumed that the user already made deliberate changes to
    // the slug, and the slug is not automatically updated.

    self.enableSlug = function($title, $slug) {
      // Watch the title for changes, update the slug - but only if
      // the slug was in sync with the title to start with

      var originalTitle = $title.val();
      var currentSlug = $slug.val();
      var components = currentSlug.split('/');
      var currentSlugTitle = components.pop();
      if ((originalTitle === '') || (currentSlugTitle === apos.utils.slugify(originalTitle))) {
        $title.on('keyup', function() {
          var title = $title.val();
          if (title !== originalTitle) {
            var currentSlug = $slug.val();
            var components = currentSlug.split('/');
            if (components.length) {
              components.pop();
              var candidateSlugTitle = apos.utils.slugify(title);
              components.push(candidateSlugTitle);
              var newSlug = components.join('/');
              $slug.val(newSlug);
            }
          }
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
      contextualConvert: function(data, name, $el, field) {
        var editor = $el.find('[data-area]').data('editor');
        if (editor) {
          data[name] = {
            type: 'area',
            items: editor.serialize()
          }
        }
      }
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
      }
    });

    self.addFieldType({
      name: 'array',
      populate: function(data, name, $field, $el, field, callback) {
        var $fieldset = self.findFieldset($el, name);
        var $template = self.findSafe($fieldset, '.apos-template[data-element]');

        var $add = self.findSafe($fieldset, '[data-add]');
        var $elements = self.findSafe($fieldset, '[data-elements]');

        // Add the elements via an async for loop without
        // the async module. -Tom

        var i = 0;
        data = data[name] || [];
        function nextElement() {
          if (i === data.length) {
            $elements.sortable({ handle: '[data-move]' });
            return callback(null);
          }
          var $element = $template.clone();
          $element.removeClass('apos-template');
          addRemoveHandler($element);
          addMoveHandler($element);

          $element.attr('data-id', data[i].id);

          $elements.append($element);
          return self.populate($element, field.schema, data[i], function() {
            i++;
            return nextElement();
          });
        }
        nextElement();

        $add.on('click', function() {
          var $element = $template.clone();
          $element.removeClass('apos-template');
          $elements.prepend($element);
          addRemoveHandler($element);
          addMoveHandler($element);

          var element = {};
          _.each(field.schema, function(field) {
            if (field.def !== undefined) {
              element[field.name] = field.def;
            }
          });

          self.populate($element, field.schema, element, function() {
            // Make sure lister gets a crack
            apos.emit('enhance', $element);
          });
          return false;
        });

        function addRemoveHandler($element) {
          var $remove = self.findSafe($element, '[data-remove]');
          $remove.on('click', function() {
            $element.remove();
            return false;
          });
        }

        function addMoveHandler($element) {
          var $move = self.findSafe($element, '[data-move-item]');
          $move.on('click', function() {
            if ($(this).attr('data-move-item') === 'up') {
              $element.prev().before($element);
            } else {
              $element.next().after($element);
            }
            return false;
          });
        }

      },

      convert: function(data, name, $field, $el, field, callback) {
        var results = [];
        var $fieldset = self.findFieldset($el, name);
        var $elements = self.findSafe($fieldset, '[data-element]:not(.apos-template)');

        var i = 0;

        var err;

        function convertElement() {
          if (i === $elements.length) {
            data[name] = results;
            return setImmediate(_.partial(callback, err));
          }
          var result = {};
          var $element = $($elements[i]);
          result.id = $element.attr('data-id');
          return self.convert($element, field.schema, result, function(_err) {
            if (_err) {
              err = _err;
            }
            results.push(result);
            i++;
            return setImmediate(convertElement);
          });
        }

        convertElement();
      }
    });

    self.addFieldType({
      name: 'joinByOne',
      populate: function(data, name, $field, $el, field, callback) {
        var manager;
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        if (!chooser) {
          manager = self.apos.docs.getManager(field.withType);
          chooser = manager.getTool('chooser', { field: field, $el: $fieldset.find('[data-chooser]') });
        }
        var choices = [];
        if (data[field.idField]) {
          choices.push({ value: data[field.idField] });
        }
        chooser.set(choices);
        $fieldset.data('aposChooser', chooser);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        var manager;
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        return chooser.get(function(err, choices) {
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
        var manager;
        var chooser;
        var $fieldset = self.findFieldset($el, name);

        return async.series({
          getChooser: function(callback) {
            chooser = $fieldset.data('aposChooser');
            var manager;
            if (chooser) {
              return setImmediate(callback);
            }
            manager = apos.docs.getManager(field.withType);
            return manager.getTool('chooser', { field: field, $el: $fieldset.find('[data-chooser]') }, function(err, _chooser) {
              if (err) {
                return callback(err);
              }
              chooser = _chooser;
              $fieldset.data('aposChooser', chooser);
              return callback(null);
            });
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
        var manager;
        var $fieldset = self.findFieldset($el, name);
        var chooser = $fieldset.data('aposChooser');
        return chooser.get(function(err, choices) {
          if (err) {
            return callback(err);
          }
          data[field.idsField] = _.pluck(choices, 'value');
          if (field.relationship) {
            data[field.relationshipsField] = data[field.relationshipsField] || {};
            var relationships = data[field.relationshipsField];
            _.each(choices, function(choice) {
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
      data[name] = $field.val();
      if (field.required && !data[name].length) {
        return setImmediate(_.partial(callback, 'required'));
      }
      if (field.max && (data[name].length > field.max)) {
        var $fieldset = self.findFieldset($el, name);
        return setImmediate(_.partial(callback, 'max'));
      }
      if (field.min && (data[name].length < field.min)) {
        var $fieldset = self.findFieldset($el, name);
        return setImmediate(_.partial(callback, 'min'));
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
      convert: convertString
    });

    self.addFieldType({
      name: 'tags',
      populate: function(data, name, $field, $el, field, callback) {
        self.enableTags(self.findSafe($el, '[data-name="' + name + '"]'), data[name], field || {});
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = self.findSafe($el, '[data-name="' + name + '"] [data-selective]').selective('get', { incomplete: true });
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'boolean',
      populate: function(data, name, $field, $el, field, callback) {
        $field.val(data[name] ? '1' : '0');
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        // Seems odd but sometimes used to mandate an "I agree" box
        if (field.required && !data[name]) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'checkboxes',
      populate: function(data, name, $field, $el, field, callback) {
        for(var c in data[name]) {
          $el.find('input[name="'+name+'"][value="'+data[name][c]+'"]').prop('checked', true);
        }
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        var values = [];
        for (var c in field.choices) {
          var val = field.choices[c].value;
          var checked = $field.filter('[value="'+val+'"]').prop('checked');
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
        _.each(data[name], function(value, rowName){
          $fieldset.find('input[name="'+name+'['+rowName+']"]').radio(value);
        });
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        var newData = {};
        _.each(field.rows, function(row){
          var $fieldset = self.findFieldset($el, name);
          newData[row.name] = $fieldset.find('input[name="'+name+'['+row.name+']"]').radio();
        });
        data[name] = newData;
        return setImmediate(callback);
      }
    });

    self.addFieldType({
      name: 'select',
      populate: function(data, name, $field, $el, field, callback) {
        var $options = $field.find('option');
        // Synthesize options from the choices in the schema, unless
        // the frontend developer has chosen to do it for us
        if (!$options.length) {
          _.each(field.choices, function(choice) {
            var $option = $('<option></option>');
            $option.text(choice.label);
            $option.attr('value', choice.value);
            $field.append($option);
          });
        }
        $field.val(((data[name] === undefined) && field.choices[0]) ? field.choices[0].value : data[name]);
        return setImmediate(callback);
      },
      convert: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
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
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        if ((field.max !== undefined) && (data[name] > field.max)) {
          var $fieldset = self.findFieldset($el, name);
          return setImmediate(_.partial(callback, 'max'));
        }
        if ((field.min !== undefined) && (data[name] < field.min)) {
          var $fieldset = self.findFieldset($el, name);
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
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        if ((field.max !== undefined) && (data[name] > field.max)) {
          var $fieldset = self.findFieldset($el, name);
          return setImmediate(_.partial(callback, 'max'));
        }
        if ((field.min !== undefined) && (data[name] < field.min)) {
          var $fieldset = self.findFieldset($el, name);
          return setImmediate(_.partial(callback, 'min'));
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
        $field.val(data[name]);
        apos.ui.enhanceDate($field);
        if (field.legacy) {
          apos.ui.enhanceDate(self.findField($el, field.legacy));
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
          $field.val(apos.formatTime(data[name]));
        }
        return setImmediate(callback);
      },
      convert: convertString
    });

    apos.schemas = self;
  }
});
