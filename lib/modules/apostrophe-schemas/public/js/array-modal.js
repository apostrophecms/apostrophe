apos.define('apostrophe-array-editor-modal', {
  extend: 'apostrophe-modal',
  source: 'arrayEditor',
  transition: 'slide',
  chooser: true,
  afterConstruct: function(self, callback) {
    return async.series([
      self.load
    ], function(err) {
      if (err) {
        return callback(err);
      }

      return callback(null);
    });
  },
  construct: function(self, options) {
    console.log("[Array Modal] Schema is...", options.body.schema);
    self.$arrayItems = $();

    self.load = function(){
      self.$arrayItems = $('[data-apos-array-items]');
      console.log(self.$arrayItems);
      self.arrayItems = [{title: 'Bobo'}];
      return self.html('arrayItems', { arrayItems: self.arrayItems, field: self.field }, function(html) {
        self.$arrayItems.html(html);
        // self.$arrayItem = self.$el.find('[data-apos-array-item]:first');
        // self.set([]);
      });

    }

    self.afterShow = function(){
        self.load();
    }

    self.set = function(arrayItems) {
      console.log("self.set is indeed being called.");
      self.arrayItems = arrayItems;
      return self.refresh();
    };

    self.get = function(callback) {
      if (!self.refreshing) {
        return callback(null, self.arrayItems);
      }
      setTimeout(function() {
        return self.get(callback);
      }, 50);
    };
    self.add = function(_id) {
      self.arrayItems.push({ value: _id });
      self.refresh();
    };
    self.remove = function(_id) {
      self.arrayItems = _.filter(self.arrayItems, function(choice) {
        return choice.value !== _id;
      });
      return self.refresh();
    }
    self.refreshing = 0;
    self.last = [];
    self.refresh = function(callback) {
      if (self.refreshing) {
        self.refreshing++;
        return;
      }
      self.refreshing++;
      self.$arrayItems.html('');
      return self.html('arrayItems', { arrayItems: self.arrayItems, field: self.field }, function(html) {
        self.$arrayItems.html(html);
        self.decrementRefreshing();
        var compare = JSON.stringify(self.arrayItems);
        if (self.last !== compare) {
          self.last = compare;
          //self.onChange();
        }
        if (callback){
          return callback();
        }
      }, function(err) {
        self.decrementRefreshing();
        if (callback){
          return callback();
        }
      });

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



    // populate: function(data, name, $field, $el, field, callback) {
    //   var $fieldset = self.findFieldset($el, name);
    //   var $template = self.findSafe($fieldset, '.apos-template[data-element]');
    //
    //   var $add = self.findSafe($fieldset, '[data-add]');
    //   var $elements = self.findSafe($fieldset, '[data-elements]');
    //
    //   // Add the elements via an async for loop without
    //   // the async module. -Tom
    //
    //   var i = 0;
    //   data = data[name] || [];
    //   function nextElement() {
    //     if (i === data.length) {
    //       $elements.sortable({ handle: '[data-move]' });
    //       return callback(null);
    //     }
    //     var $element = $template.clone();
    //     $element.removeClass('apos-template');
    //     addRemoveHandler($element);
    //     addMoveHandler($element);
    //
    //     $element.attr('data-id', data[i].id);
    //
    //     $elements.append($element);
    //     return self.populate($element, field.schema, data[i], function() {
    //       i++;
    //       return nextElement();
    //     });
    //   }
    //   nextElement();
    //
    //   $add.on('click', function() {
    //     var $element = $template.clone();
    //     $element.removeClass('apos-template');
    //     $elements.prepend($element);
    //     addRemoveHandler($element);
    //     addMoveHandler($element);
    //
    //     var element = {};
    //     _.each(field.schema, function(field) {
    //       if (field.def !== undefined) {
    //         element[field.name] = field.def;
    //       }
    //     });
    //
    //     self.populate($element, field.schema, element, function() {
    //       // Make sure lister gets a crack
    //       apos.emit('enhance', $element);
    //     });
    //     return false;
    //   });
    //
    //   function addRemoveHandler($element) {
    //     var $remove = self.findSafe($element, '[data-remove]');
    //     $remove.on('click', function() {
    //       $element.remove();
    //       return false;
    //     });
    //   }
    //
    //   function addMoveHandler($element) {
    //     var $move = self.findSafe($element, '[data-move-item]');
    //     $move.on('click', function() {
    //       if ($(this).attr('data-move-item') === 'up') {
    //         $element.prev().before($element);
    //       } else {
    //         $element.next().after($element);
    //       }
    //       return false;
    //     });
    //   }
    //
    // },
  }
});
