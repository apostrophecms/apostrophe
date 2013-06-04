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

    // Our properties reside in 'self'. Fetch the old 'self' or
    // set up a new one if this element hasn't been configured
    // with selective yet
    if (!$el.data('aposSelective')) {
      $el.data('aposSelective', {});
    }
    var self = $el.data('aposSelective');

    // If 'options' is a string, look for a command there
    // such as 'get', otherwise set up a new comboList
    if (typeof(options) === 'string') {
      if (options === 'get') {
        return self.get();
      }
    } else {
      self.$list = $el.find('[data-list]');
      self.$autocomplete = $el.find('[data-autocomplete]');
      self.$itemTemplate = $el.find('[data-item]');
      self.$itemTemplate.remove();
      self.$autocomplete.autocomplete({
        minLength: options.minLength || 1,
        source: options.source,
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
        $(this).closest('[data-item]').remove();
        return false;
      });

      self.populate = function() {
        self.$list.find('[data-item]').remove();
        $.each(options.data, function(i, datum) {
          self.add(datum);
        });
      };

      self.add = function(item) {
        var $item = self.$itemTemplate.clone();
        $item.attr('data-value', item.value);
        $item.find('[data-label]').text(item.label);
        self.$list.append($item);
      };

      self.get = function() {
        var result = [];
        $.each(self.$list.find('[data-item]'), function(i, item) {
          result.push($(item).attr('data-value'));
        });
        return result;
      };

      self.populate();
    }
  };
})( jQuery );
