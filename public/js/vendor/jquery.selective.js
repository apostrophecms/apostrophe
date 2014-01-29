
// selective: a jQuery plugin that makes it easy to set or get the
// current value of a group of selective buttons.
//
// Copyright 2013 P'unk Avenue LLC
//
// Please see:
//
// https://github.com/punkave/jquery-selective
//
// For complete documentation.

(function( $ ){
  $.fn.selective = function(options) {
    var $el = this;
    var strikethrough = options.strikethrough || options.propagate;
    var removed = options.removed || options.propagate;
    var propagate = options.propagate;
    var extras = options.extras;
    var addKeyCodes = options.addKeyCodes || 13;
    if (!$.isArray(addKeyCodes)) {
      addKeyCodes = [ addKeyCodes ];
    }

    var _new = false;

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
      }

      self.$list = $el.find('[data-list]');
      self.$autocomplete = $el.find('[data-autocomplete]');
      // Careful, when reconfiguring an existing element this won't be
      // available in the DOM anymore but we already have it
      if (!self.$itemTemplate) {
        self.$itemTemplate = $el.find('[data-item]');
      }
      self.$limitIndicator = $el.find('[data-limit-indicator]');

      self.$itemTemplate.remove();
      if (options.add) {
        self.$autocomplete.on('keydown.selective', function(e) {
          if ($.inArray(e.which, addKeyCodes) !== -1)
          {
            var val = self.$autocomplete.val();
            self.add({ label: val, value: val });
            self.$autocomplete.val('');
            self.$autocomplete.autocomplete('close');
            self.checkLimit();
            $el.trigger('change');
            return false;
          }
          return true;
        });
      }
      self.$autocomplete.autocomplete({
        minLength: options.minLength || 1,
        source: options.source,
        // Stomp out suggestions of choices already made
        response: function(event, ui) {
          if (options.preventDuplicates) {
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
          var $label = $item.find('[data-label]');
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
        self.$list.find('[data-item]').remove();

        self.set(options.data);
      };

      self.add = function(item) {
        var i;
        var duplicate = false;
        if (options.preventDuplicates) {
          // Use find and each to avoid problems with values that
          // contain quotes
          self.$list.find('[data-item]').each(function() {
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
        $item.attr('data-value', item.value);
        // So that the label can be made available to the `get` method easily
        $item.attr('data-label', item.label);
        $item.find('[data-label]').text(item.label);
        // Also repopulate "extras" if the data is provided
        $.each(item, function(property, value) {
          $item.find('[data-extras][name="' + property + '"]').val(value);
        });
        self.$list.append($item);
      };

      self.clear = function() {
        self.$list.find('[data-item]').remove();
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

        if (data && data[0] && (typeof(data[0]) !== 'object')) {
          if (typeof(options.source) === 'function') {
            return options.source({ values: data }, appendValues);
          } else if (typeof(options.source) === 'string') {
            return $.getJSON(options.source, { values: data }, appendValues);
          } else {
            throw "data is not an array of objects, and source is not a URL or a function. Not sure what to do.";
          }
        } else {
          // The simple case: the data is ready to use
          return appendValues(data);
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
        $.each(self.$list.find('[data-item]'), function(i, item) {
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
              datum.propagate = $item.find('[data-propagate]:checked').length ? 1 : 0;
            }
            if (extras) {
              $item.find('[data-extras]').each(function() {
                var $this = $(this);
                datum[$this.attr('name')] = $this.val();
              });
            }
            result.push(datum);
          }
        });
        return result;
      };

      self.checkLimit = function() {
        if (options.limit === undefined) {
          self.$limitIndicator.hide();
          return;
        }
        var count = 0;
        self.$list.find('[data-item]').each(function() {
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
  };
})( jQuery );
