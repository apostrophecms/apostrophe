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

    // Our properties reside in 'self'. Fetch the old 'self' or
    // set up a new one if this element hasn't been configured
    // with selective yet
    if (!$el.data('aposSelective')) {
      $el.data('aposSelective', {});
    }
    var self = $el.data('aposSelective');

    // If 'options' is a string, look for a command there
    // such as 'get', otherwise set up a new instance
    if (typeof(options) === 'string') {
      if (options === 'get') {
        return self.get();
      } else if (options === 'set') {
        return self.set(arguments[1]);
      } else if (options === 'clear') {
        return self.clear();
      }
    } else {
      self.$list = $el.find('[data-list]');
      self.$autocomplete = $el.find('[data-autocomplete]');
      self.$itemTemplate = $el.find('[data-item]');
      self.$itemTemplate.remove();
      if (options.add) {
        self.$autocomplete.on('keydown', function(e) {
          if ($.inArray(e.which, addKeyCodes) !== -1)
          {
            var val = self.$autocomplete.val();
            self.add({ label: val, value: val });
            self.$autocomplete.val('');
            self.$autocomplete.autocomplete('close');
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
          return false;
        }
      });
      if (options.sortable) {
        self.$list.sortable((typeof(options.sortable) === 'object') ? options.sortable : undefined);
      }
      self.$list.on('click', '[data-remove]', function() {
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
        $item.find('[data-label]').text(item.label);
        // Also repopulate "extras" if the data is provided
        $.each(item, function(property, value) {
          $item.find('[data-extras][name="' + property + '"]').val(value);
        });
        self.$list.append($item);
      };

      self.clear = function() {
        self.$list.find('[data-item]').remove();
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
        }
      };

      self.get = function(options) {
        var valuesOnly = (options && options.valuesOnly) || ((!removed) && (!extras));
        var result = [];
        $.each(self.$list.find('[data-item]'), function(i, item) {
          var $item = $(item);
          if (valuesOnly) {
            result.push($item.attr('data-value'));
          } else {
            var datum = {};
            datum.value = $item.attr('data-value');
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

      self.populate();
    }
  };
})( jQuery );
