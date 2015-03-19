apos.define('apostrophe-schemas', {
  construct: function(self, options) {

    // Populate form elements corresponding to a set of fields as
    // specified in a schema (the schema argument). The inverse of
    // self.convert
    self.populate = function($el, schema, snippet, callback) {
      return async.eachSeries(schema, function(field, callback) {

        // Utilized by simple displayers that use a simple HTML
        // element with a name attribute
        var $field = self.findField($el, field.name);

        if (field.contextual) {
          return setImmediate(callback);
        }

        var displayer = self.displayers[field.type];

        return displayer(snippet, field.name, $field, $el, field, function() {
          if (field.autocomplete === false) {
            $field.attr('autocomplete', 'off');
          }
          if(field.required === true) {
            self.addError($el, field.name, true);
          }
          return setImmediate(callback);
        });

      }, afterPopulate);

      function afterPopulate() {

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
              toggleHidden($toggleSelect);
              $toggleSelect.on('change', function(){
                toggleHidden($(this));
              });
            }
          }
        });

        callback(null);
      }
    };

    // Gather data from form elements and push it into properties of the data object,
    // as specified by the schema provided. The inverse of self.populate
    self.convert = function($el, schema, data, callback) {
      self.findSafe($el, '[data-name]').removeClass('apos-error').find('.apos-error-message').remove();
      var failing;

      return async.eachSeries(schema, function(field, callback) {
        if (field.contextual) {
          return setImmediate(callback);
        }
        // This won't be enough for every type of field, so we pass $el too
        var $field = self.findField($el, field.name);
        if (!$field.length) {
          $field = self.findField($el, field.legacy);
        }
        return self.converters[field.type](data, field.name, $field, $el, field, function(err) {
          if (err) {
            self.addError($el, field.name, field.required);
            return setImmediate(_.partial(callback, field));
          }
          return setImmediate(callback);
        });
      }, function(failingField) {
        return callback(failingField);
      });
    };

    self.enableSingleton = function($el, name, area, type, optionsArg, callback) {
      if (typeof(optionsArg) === 'function') {
        callback = optionsArg;
        optionsArg = {};
      }
      var items = [];
      if (area && area.items) {
        items = area.items;
      }

      var options = {};
      $.extend(options, optionsArg);
      $.extend(options, {
        type: type
      });

      var $fieldset = self.findFieldset($el, name);
      refreshSingleton(items, callback);

      function refreshSingleton(items, callback) {
        options.content = items;
        $.jsonCall(apos.areas.action + '/edit-virtual-singleton', { dataType: 'html' }, options, function(data) {
          var $editView = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
          $editView.html('');
          $editView.append(data);
          // Make sure slideshows, videos, etc. get their JS
          apos.emit('enhance', $editView);

          // getSingleton will pick it up from here
          $editView.data('items', items);

          // If an edit takes place, refresh so we can see the new preview here
          // in the form. This isn't an issue with areas since they are always
          // in the edit state in a form. TODO: consider whether it would be
          // better to create a container that allows widgets to be rendered
          // inline, without a nested dialog box

          var $singleton = self.findSafe($editView, '.apos-singleton:first');
          $singleton.on('aposEdited', function(e, data) {
            refreshSingleton([data], function() {
              // A change event on the singleton's wrapper signifies
              // that getSingleton can now be
              // called to see the new data
              $fieldset.trigger('change');
            });
          });

          if (callback) {
            return callback(null);
          }
        });
      }
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
      $.jsonCall(apos.areas.action + '/edit-virtual-area',
        { dataType: 'html' },
        { content: items, options: options }, function(data) {
        var $editView = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
        $editView.append(data);
        // Make sure slideshows, videos, etc. get their JS
        apos.emit('enhance', $editView);
        return callback(null);
      });
    };

    // Retrieve a JSON-friendly serialization of the singleton
    self.getSingleton = function($el, name) {
      var $fieldset = self.findFieldset($el, name);
      var items = self.findSafe($fieldset, '[data-' + name + '-edit-view]').data('items');
      items = items || [];
      return items;
    };

    // Retrieve a JSON-friendly serialization of the area
    self.getArea = function($el, name) {
      var $fieldset = self.findFieldset($el, name);
      var $property = self.findSafe($fieldset, '[data-' + name + '-edit-view]');
      return $property.find('.apos-area:first').data('editor').serialize();
    };

    // Methods to convert from a form field of each schema type
    // to a property of the snippet ready to save. The server does
    // all the validation of course, since you can't trust a browser
    // anyway, so this is mostly simple except where the representation
    // in the form differs greatly from the representation the server wants
    self.converters = {
      // Convert the tough cases
      area: function(data, name, $field, $el, field, callback) {
        data[name] = self.getArea($el, name);

        if (field.required && (apos.areaIsEmpty(data[name]))) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      singleton: function(data, name, $field, $el, field, callback) {
        data[name] = self.getSingleton($el, name);
        if (field.required && (apos.singletonIsEmpty(data[name], field.type))) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      array: function(data, name, $field, $el, field, callback) {
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
      },
      joinByOne: function(data, name, $field, $el, field, callback) {
        // Fix $field since we can't use the regular name attribute here
        $field = self.findSafe($el, '[data-name="' + name + '"]');
        data[field.idField] = $field.selective('get', { incomplete: true })[0];
        if (field.required && (!data[field.idField])) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      joinByOneReverse: function(data, name, $field, $el, field, callback) {
        // Not edited on this side of the relation
        return setImmediate(callback);
      },
      joinByArray: function(data, name, $field, $el, field, callback) {
        // Fix $field since we can't use the regular name attribute here
        $field = self.findSafe($el, '[data-name="' + name + '"]');
        $field.off('afterGetItem');
        // Implement custom relationship field types (tags)
        $field.on('afterGetItem', function(e, item, $item) {
          _.each(field.relationship || [], function(field) {
            if (field.type === 'tags') {
              var $tags = $item.findSafe('[data-name="' + field.name + '"]', '[data-selective]');
              item[field.name] = $tags.selective('get');
            }
          });
        });

        var info = $field.selective('get', { incomplete: true });
        if (field.relationshipsField) {
          data[field.idsField] = _.pluck(info, 'value');
          data[field.relationshipsField] = {};
          var relationship = {};
          _.each(info, function(e) {
            relationship[e.value] = _.omit(e, [ 'value', 'label' ]);
          });
          data[field.relationshipsField] = relationship;
        } else {
          data[field.idsField] = info;
        }
        if (field.required && !data[field.idsField].length) {
          return setImmediate(function() {
            return setImmediate(_.partial(callback, 'required'));
          });
        }
        return setImmediate(callback);
      },
      joinByArrayReverse: function(data, name, $field, $el, field, callback) {
        // Not edited on this side of the relation
        return setImmediate(callback);
      },
      group: function(data, name, $field, $el, field, callback) {
        // Just a presentation thing
        return setImmediate(callback);
      },
      // The rest are very simple because the server does
      // the serious sanitization work and the representation in the DOM
      // is a simple form element
      string: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      password: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      slug: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      tags: function(data, name, $field, $el, field, callback) {
        apos.log('TODO: implement tags module, then implement converter and displayer for tags via that');
        return setImmediate(callback);

        // data[name] = self.findSafe($el, '[data-name="' + name + '"]').selective('get', { incomplete: true });
        // if (field.required && !data[name].length) {
        //   return setImmediate(_.partial(callback, 'required'));
        // }
        // return setImmediate(callback);
      },
      boolean: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        // Seems odd but sometimes used to mandate an "I agree" box
        if (field.required && !data[name]) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      checkboxes: function(data, name, $field, $el, field, callback) {
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
      },
      select: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      integer: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      float: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      url: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      date: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
      time: function(data, name, $field, $el, field, callback) {
        data[name] = $field.val();
        if (field.required && !data[name].length) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      },
    };

    // Methods to display all of the field types supported by the schema
    self.displayers = {
      area: function(data, name, $field, $el, field, callback) {
        return self.enableArea($el, name, data[name], field.options || {}, callback);
      },
      singleton: function(data, name, $field, $el, field, callback) {
        return self.enableSingleton($el, name, data[name], field.widgetType, field.options || {}, callback);
      },
      array: function(data, name, $field, $el, field, callback) {
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

          self.populateFields($element, field.schema, element, function() {
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
      string: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      password: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      slug: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      tags: function(data, name, $field, $el, field, callback) {
        self.enableTags(self.findSafe($el, '[data-name="' + name + '"]'), data[name], field || {});
        return setImmediate(callback);
      },
      url: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      checkboxes: function(data, name, $field, $el, field, callback) {
        for(var c in data[name]) {
          $el.find('input[name="'+name+'"][value="'+data[name][c]+'"]').prop('checked', true);
        }
        return setImmediate(callback);
      },
      select: function(data, name, $field, $el, field, callback) {
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
      integer: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      float: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        return setImmediate(callback);
      },
      boolean: function(data, name, $field, $el, field, callback) {
        $field.val(data[name] ? '1' : '0');
        return setImmediate(callback);
      },
      joinByOne: function(data, name, $field, $el, field, callback) {
        // Since we can't use a regular name attribute for a div
        $field = self.findSafe($el, '[data-name="' + name + '"]');
        if (!$field.length) {
          apos.log('Error: your new.html template for the ' + self.name + ' module does not have a snippetSelective call for the ' + name + ' join yet');
        }
        var selectiveData = [];
        var id = data[field.idField];
        if (id) {
          // Let jQuery selective call back for the details
          selectiveData.push(id);
        }
        // For now this is still correct on the browser side, getManager
        // always returns undefined for an index type
        var manager = aposPages.getManager(field.withType);
        var autocomplete = '/apos-pages/autocomplete?type=' + field.withType;
        if (manager) {
          autocomplete = manager._action + '/autocomplete';
        }
        $field.selective({ limit: 1, data: selectiveData, source: autocomplete, nestGuard: '[data-selective]' });

        self.enhanceSelectiveWithSlugs($field);
        return setImmediate(callback);
      },
      joinByOneReverse: function(data, name, $field, $el, field, callback) {
        // Not edited on the reverse side
        return setImmediate(callback);
      },
      joinByArray: function(data, name, $field, $el, field, callback) {
        // Since we can't use a regular name attribute for a div
        $field = self.findSafe($el, '[data-name="' + name + '"]');
        if (!$field.length) {
          apos.log('Error: your new.html template for the ' + self.name + ' module does not have a snippetSelective call for the ' + name + ' join yet');
        }

        // Implement custom relationship field types (tags)
        $field.off('afterAddItem');
        $field.on('afterAddItem', function(e, item, $item) {
          _.each(field.relationship || [], function(field) {
            if (field.type === 'tags') {
              var $tags = $item.findSafe('[data-name="' + field.name + '"]', '[data-selective]');
              self.enableTags($tags, item[field.name] || []);
            }
          });
        });

        var selectiveData = [];

        // For now this is still correct on the browser side, getManager
        // always returns undefined for an index type
        var manager = aposPages.getManager(field.withType);
        var autocomplete = '/apos-pages/autocomplete?type=' + field.withType;
        if (manager) {
          autocomplete = manager._action + '/autocomplete';
        }

        // The server knows the title of the joined things, while we know
        // about our relationship properties. Solve the puzzle by
        // passing selective plain old IDs, causing it to call back to its
        // source for the corresponding labels. Provide a custom source
        // that queries the server and then merges in the relationship fields.
        if (field.relationshipsField) {
          var url = autocomplete;
          autocomplete = function(req, callback) {
            $.getJSON(url, req, function(results) {
              // This gives us "label" and "value", add the
              // relationship info and invoke the original callback
              _.each(results, function(result) {
                var relationship = data[field.relationshipsField] && data[field.relationshipsField][result.value];
                if (relationship) {
                  _.extend(result, relationship);
                  _.each(field.relationship, function(relField) {
                    if (relField.type === 'boolean') {
                      // Fix booleans to work as select elements expect
                      result[relField.name] = result[relField.name] ? '1' : '0';
                    }
                  });
                }
              });
              return callback(results);
            });
          };
        }

        $field.selective({ preventDuplicates: true, sortable: field.sortable, extras: !!field.relationship, data: data[field.idsField] || [], source: autocomplete, nestGuard: '[data-selective]' });
        self.enhanceSelectiveWithSlugs($field);
        return setImmediate(callback);
      },
      joinByArrayReverse: function(data, name, $field, $el, field, callback) {
        // Not edited on the reverse side
        return setImmediate(callback);
      },
      group: function(data, name, $field, $el, field, callback) {
        // Just a presentation thing
        return setImmediate(callback);
      },
      date: function(data, name, $field, $el, field, callback) {
        $field.val(data[name]);
        apos.enhanceDate($field);
        if (field.legacy) {
          apos.enhanceDate(self.findField($el, field.legacy));
        }
        return setImmediate(callback);
      },
      time: function(data, name, $field, $el, field, callback) {
        if (data[name] && data[name].length) {
          // Revert to local time for editing
          $field.val(apos.formatTime(data[name]));
        }
        return setImmediate(callback);
      },
    };

    self.addFieldType = function(type) {
      self.displayers[type.name] = type.displayer;
      self.converters[type.name] = type.converter;
    };

    // A convenience method for calling attention to errors in fields in your own
    // independent validation code.

    self.addError = function($el, name, required) {
      self.findSafe($el, '[data-name="' + name + '"]').addClass('apos-error');
      if (required === true) {
        self.findSafe($el, '[data-name="' + name + '"]').find('label').append('<span class="apos-error-message"> * required</span>');
      }
    };

    // A convenience allowing you to scroll to the first error present,
    // if any. Not called automatically. You can call this when
    // convert passes an error or when your own validation code
    // has invoked addError().

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
        if (item.slug) {
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
      apos.log('TODO: write tags module so enableTags can talk to it and find out what tags exist');
      return;
      tags = tags || [];
      field = field || {};
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
      $el.selective({ preventDuplicates: true, add: true, /* !apos.data.lockTags, */ data: tags, source: apos.tags.action + '/autocomplete', addKeyCodes: [ 13, 'U+002C'], limit: field.limit, sortable: field.sortable, nestGuard: '[data-selective]' });
    };

    apos.schemas = self;
  }
});
