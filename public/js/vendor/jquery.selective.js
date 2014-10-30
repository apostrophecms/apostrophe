// selective: a jQuery plugin that makes it easy to set or get the
// current value of a group of selective buttons.
//
// Copyright 2013, 2014 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-selective
//
// For complete documentation.

/* jshint browser:true */
/* global jQuery */

(function($) {
  $.fn.selective = function(options) {
    var $el = this;
    var strikethrough = options.strikethrough || options.propagate;
    var removed = options.removed || options.propagate;
    var propagate = options.propagate;
    var extras = options.extras;
    var addKeyCodes = options.addKeyCodes || 13;
    var preventDuplicates = options.preventDuplicates;
    var add = options.add;
    var incompleteValidation;

    if (!$.isArray(addKeyCodes)) {
      addKeyCodes = [ addKeyCodes ];
    }

    var _new = false;
    var nextItemId = 1;

    // Our properties reside in 'self'. Fetch the old 'self' or
    // set up a new one if this element hasn't been configured
    // with selective yet
    if (!$el.data('aposSelective')) {
      $el.data('aposSelective', {});
      _new = true;
    }
    var self = $el.data('aposSelective');
    if (!self) {
      // There were no matching elements. For instance something
      // like this happened:
      //
      // $('.foo').selective({...})
      //
      // And there were no elements with the class foo.
      //
      // Standard jQuery practice in this situation is to
      // be tolerant and not crash (look at what .css does when
      // find returns no elements).
      return;
    }

    // If 'options' is a string, look for a command there
    // such as 'get', otherwise set up a new instance
    if (typeof(options) === 'string') {
      if (options === 'get') {
        return self.get(arguments[1]);
      } else if (options === 'set') {
        return self.set(arguments[1]);
      } else if (options === 'clear') {
        return self.clear();
      }
    } else {
      if (!_new) {
        // Re-configuring a previously configured element.
        // Mop up our previous event handlers so we can set up again

        self.$autocomplete.autocomplete('destroy');
        self.$autocomplete.off('keydown.selective');
        self.$list.off('click.selective');
        self.$list.off('click.selective');
        self.$el.off('add');
      }

      self.$el = $el;
      self.baseName = $el.attr('name') || 'jquerySelective';
      self.$list = findSafe('[data-list]');
      self.$autocomplete = findSafe('[data-autocomplete]');
      // Careful, when reconfiguring an existing element this won't be
      // available in the DOM anymore but we already have it
      if (!self.$itemTemplate) {
        self.$itemTemplate = findSafe('[data-item]');
      }
      self.$limitIndicator = findSafe('[data-limit-indicator]');

      self.$itemTemplate.remove();
      if (add) {
        self.$autocomplete.on('keydown.selective', function(e) {
          if (
            $.inArray(e.which, addKeyCodes) !== -1 || // for key code
            $.inArray(e.originalEvent.keyIdentifier, addKeyCodes) !== -1 // for a key identifier
          )
          {
            self.$el.trigger('add');
            return false;
          }
          return true;
        });
        findSafe('[data-add]').click(function() {
          self.$el.trigger('add');
          return false;
        });
      }

      self.$el.on('add', function() {
        var val = self.$autocomplete.val();
        if ((!val.length) && (!options.empty)) {
          // Do not add empty items unless explicitly welcome
          return;
        }
        self.add({ label: val, value: val });
        self.$autocomplete.val('');
        self.$autocomplete.autocomplete('close');
        self.checkLimit();
        $el.trigger('change');
        self.$autocomplete.focus();
      });

      self.$autocomplete.autocomplete({
        minLength: options.minLength || 1,
        source: options.source,
        // Stomp out suggestions of choices already made
        response: function(event, ui) {
          if (preventDuplicates) {
            var content = ui.content;
            var filtered = [];
            // Compatible with `removed` and `propagate`
            var values = self.get({ valuesOnly: true });
            $.each(content, function(i, datum) {
              if ($.inArray(datum.value.toString(), values) !== -1) {
                return;
              }
              filtered.push(datum);
            });

            // "Why don't you just assign to ui.content?" jquery.ui.autocomplete
            // is holding a reference to the original array. If I assign to ui.content
            // I'm not changing that original array and jquery.ui.autocomplete ignores me.
            content.length = 0;
            $.each(filtered, function(i, datum) {
              content.push(datum);
            });
          }

          // In case self.get is called with 'incomplete'
          if (!add) {
            incompleteValidation = $.map(ui.content, function(datum) {
              return datum.value.toString();
            });
          }

        },
        focus: function(event, ui) {
          self.$autocomplete.val(ui.item.label);
          return false;
        },
        select: function(event, ui) {
          self.$autocomplete.val('');
          self.add(ui.item);
          self.checkLimit();
          $el.trigger('change');
          return false;
        }
      });
      if (options.sortable) {
        self.$list.sortable((typeof(options.sortable) === 'object') ? options.sortable : undefined);
      }
      self.$list.on('click.selective', '[data-remove]', function() {
        var $item = $(this).closest('[data-item]');
        if (strikethrough) {
          var $label = findSafe($item, '[data-label]');
          if ($item.data('removed')) {
            // Un-remove it
            $label.css('textDecoration', 'none');
            $item.removeClass('apos-removed');
            $item.data('removed', false);
          } else {
            $label.css('textDecoration', 'line-through');
            $item.addClass('apos-removed');
            $item.data('removed', true);
          }
        } else {
          $item.remove();
        }
        $el.trigger('change');
        self.checkLimit();
        return false;
      });

      self.populate = function() {
        findSafe(self.$list, '[data-item]').remove();

        self.set(options.data);
      };

      self.add = function(item) {
        var duplicate = false;
        if (preventDuplicates) {
          // Use find and each to avoid problems with values that
          // contain quotes
          findSafe(self.$list, '[data-item]').each(function() {
            var $item = $(this);
            if ($item.attr('data-value') === item.value) {
              duplicate = true;
            }
          });
        }
        if (duplicate) {
          return;
        }
        var $item = self.$itemTemplate.clone();
        var itemId = nextItemId++;
        $item.attr('data-id', itemId);
        $item.attr('data-value', item.value);
        // So that the label can be made available to the `get` method easily
        $item.attr('data-label', item.label);
        findSafe($item, '[data-label]').text(item.label);
        // If extras are present, fix name attributes so radio
        // button groups on separate rows don't conflict. Stash the
        // original name in data-name so we can still find things that way
        findSafe($item, '[data-extras]').each(function() {
          var $this = $(this);
          var originalName = $this.attr('name');
          var name = uniqueName(itemId, originalName);
          $this.attr('name', name);
          $this.attr('data-name', originalName);
        });
        // Also repopulate "extras" if the data is provided
        $.each(item, function(property, value) {
          var $elements = findSafe($item, '[data-extras][data-name="' + property + '"]');
          // More than one with the same name = radio buttons.
          // If the jquery-radio plugin is available, use it to
          // correctly select the right radio button
          if ($.fn.radio && ($elements.length > 1)) {
            $elements.radio(value);
            return;
          }
          // Cope with checkboxes
          if ($elements.is('input[type="checkbox"]')) {
            $elements.prop('checked', !!value);
            return;
          }
          // Everything else
          $elements.val(value);
        });

        // Select the first radio button in a group if none is chosen
        var radioSeen = {};
        findSafe($item, 'input[type="radio"]').each(function() {
          var $this = $(this);
          var name = $this.attr('data-name');
          if (radioSeen[name]) {
            return;
          }
          radioSeen[name] = true;
          var $group = findSafe($item, '[data-name="' + name + '"]');
          if ($group.radio() === undefined) {
            $group.radio($group.eq(0).attr('value'));
          }
        });

        // Allows custom relationship field types
        self.$el.trigger('afterAddItem', [ item, $item ]);
        self.$list.append($item);
      };

      self.clear = function() {
        findSafe(self.$list, '[data-item]').remove();
        self.checkLimit();
      };

      // data contains the user's current selections (not potential future
      // choices).
      //
      // If data is an array of objects, assume they are ready to rock, with
      // label and value properties and any extra properties.
      //
      // If not, pass data to the source, which should give us back an array
      // of objects with label and value properties as well as any "extra"
      // properties for the extras option.
      //
      // This allows for the common case where we save just an array of IDs
      // but need to turn this back into an array with label and value
      // properties and possibly extra properties to display our
      // selections again.

      self.set = function(data) {
        self.clear();
        if (data && data[0]) {
          if (typeof(data[0]) !== 'object') {
            // A simple array of values, let the source provide labels
            return invokeSourceThen(data, function(sourceData) {
              appendValues(sourceData);
              afterSet();
            });
          } else if (data[0].label) {
            // An array of objects that already have labels, we're done
            appendValues(data);
            afterSet();
            return;
          } else {
            // An array of objects that do not already have labels,
            // ask the source for label/value objects and then merge
            // those with our data
            return invokeSourceThen($.map(data, function(datum) { return datum.value; }), function(sourceData) {
              appendValues(mergeData(sourceData));
              afterSet();
              return;
            });
          }
        } else {
          afterSet();
        }

        function afterSet() {
          // This is a cross-browser-safe way to make
          // sure we never trigger the event before
          // returning from the "set" command or the
          // initialization of the control
          setTimeout(function() {
            if (options.afterSet) {
              options.afterSet();
            }
            $el.trigger('afterSet');
          }, 0);
        }

        function invokeSourceThen(values, callback) {
          if (typeof(options.source) === 'function') {
            return options.source({ values: values }, callback);
          } else if (typeof(options.source) === 'string') {
            // Do what our documentation says, make a POST request
            return $.ajax(
              {
                url: options.source,
                type: options.valuesMethod || 'POST',
                data: {
                  values: values
                },
                dataType: 'json',
                success: callback
              }
            );
          } else {
            throw "source must be a url or a function.";
          }
        }

        // The source gave us objects with labels and values. Now merge
        // that with the array of objects passed as "data." If no
        // label/value object was returned by the source for a
        // particular value, then we drop that object
        function mergeData(sourceData) {
          var map = {};
          $.each(data, function(i, datum) {
            map[datum.value] = datum;
          });
          $.each(sourceData, function(i, sourceDatum) {
            $.extend(sourceDatum, map[sourceDatum.value]);
          });
          return sourceData;
        }

        function appendValues(data) {
          $.each(data, function(i, datum) {
            self.add(datum);
          });
          self.checkLimit();
        }
      };

      self.get = function(options) {
        var valuesOnly = (options && options.valuesOnly) || ((!removed) && (!extras));
        if (options && options.withLabels) {
          valuesOnly = false;
        }
        var result = [];
        $.each(findSafe(self.$list, '[data-item]'), function(i, item) {
          var $item = $(item);
          if (valuesOnly) {
            result.push($item.attr('data-value'));
          } else {
            var datum = {};
            datum.value = $item.attr('data-value');
            if (options && options.withLabels) {
              datum.label = $item.attr('data-label');
            }
            if (removed) {
              datum.removed = $item.data('removed') ? 1 : 0;
            }
            if (propagate) {
              datum.propagate = findSafe($item, '[data-propagate]:checked').length ? 1 : 0;
            }
            if (extras) {
              findSafe($item, '[data-extras]').each(function() {
                var $this = $(this);
                var result;
                var seenRadio = {};
                var name = $this.attr('data-name');
                if ($this.is('input[type="radio"]') && $.fn.radio) {
                  if (!seenRadio[name]) {
                    var $radioButtons = findSafe($item, '[data-name="' + name + '"]');
                    result = $radioButtons.radio();
                    seenRadio[name] = true;
                  }
                } else if ($this.is('input[type="checkbox"]')) {
                  result = $this.prop('checked') ? 1 : 0;
                } else {
                  result = $this.val();
                }
                datum[name] = result;
              });
            }
            // Allows custom relationship field types
            self.$el.trigger('afterGetItem', [ datum, $item ]);
            result.push(datum);
          }
        });
        if (valuesOnly && options && options.incomplete) {
          var val = $.trim(self.$autocomplete.val());
          if (val.length) {
            var testVal = val.toLowerCase();
            var testResult = $.map(result, function(r) {
              return r.toLowerCase();
            });
            var testIncompleteValidation = $.map(incompleteValidation || [], function(r) {
              return r.toLowerCase();
            });
            if ((!preventDuplicates) || ($.inArray(testVal, testResult) === -1)) {
              if (add || ($.inArray(testVal, testIncompleteValidation) !== -1)) {
                result.push(val);
              }
            }
          }
        }
        return result;
      };

      self.checkLimit = function() {
        if (options.limit === undefined) {
          self.$limitIndicator.hide();
          return;
        }
        var count = 0;
        findSafe(self.$list, '[data-item]').each(function() {
          var $item = $(this);
          if (!$item.data('removed')) {
            count++;
          }
        });
        var limited = (count >= options.limit);
        self.$autocomplete.prop('disabled', limited);
        if (limited) {
          self.$limitIndicator.show();
        } else {
          self.$limitIndicator.hide();
        }
      };

      self.populate();
    }

    function uniqueName(itemId, name) {
      return self.baseName + '[' + itemId + '][' + name + ']';
    }

    // Borrowed from our jquery.findSafe plugin
    function findSafe($context, selector) {
      if (arguments.length === 1) {
        selector = arguments[0];
        $context = self.$el;
      }
      if (!options.nestGuard) {
        return $context.find(selector);
      }
      return $context.find(selector).not($context.find(options.nestGuard).find(selector));
    }
  };
})( jQuery );

