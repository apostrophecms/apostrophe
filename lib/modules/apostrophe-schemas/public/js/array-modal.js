apos.define('apostrophe-array-editor-modal', {
  extend: 'apostrophe-modal',
  source: 'arrayEditor',
  transition: 'slide',
  chooser: true,
  construct: function(self, options) {
    self.load = function(){
      self.$arrayItems  = self.$el.find('[data-apos-array-items]');
      self.$arrayItem   = self.$el.find('[data-apos-array-item]');
      self.field        = options.field;
      self.arrayItems   = options.arrayItems || [];
      self.active       = 0;

      if (!self.arrayItems.length){
        return self.createItem();
      } else {
        self.setItemTitles();
        return self.editItem();
      }
    }

    self.afterShow = function(){
      self.load();
    }

    self.addToItems = function() {
      self.arrayItems.push({ _title: "New Item", id: apos.utils.generateId() });
      self.active = self.arrayItems.length - 1;
      self.refreshItems();
    };

    self.setItemTitles = function(){
      self.arrayItems = _.map(self.arrayItems, function(item, i){
        item._title = item.clubType || item.title || '#' + (i + 1); // TODO make this a configurable field title
        return item;
      });
    }

    // Array Items-Related methods
    self.refreshItems = function(){
      self.bindClickHandlers();
      return self.html('arrayItems', { arrayItems: self.arrayItems, field: self.field, active: self.active }, function(html) {
        self.$arrayItems.html($(html));
      });
    }

    // Ask the server to create an empty form
    // populated by schema fields. Form is 'arrayItem.html'
    // Should also re-render the chooser.
    self.createItem = function(){
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.addToItems();
        self.populateItem();
      });
    }

    // Like create, we're asking the server for a
    // empty form, populated by an existing item passed
    // into schema fields.
    self.editItem = function(){
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.populateItem();
      });
    }

    self.populateItem = function(){
      apos.schemas.populate(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err){
        if (err) {
          console.error(err)
        }
        self.refreshItems();
      });
    }

    self.saveItemState = function(callback){
      apos.schemas.convert(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err){
        if (err) {
          console.error(err);
        }
        self.arrayItems[self.active]._title = (self.arrayItems[self.active].clubType) ? self.arrayItems[self.active].clubType : self.arrayItems[self.active]._title;
        return callback();
      })
    }

    self.saveArray = function(){
      options.save(self.arrayItems);
      self.hide();
    }


    // Click handlers
    self.bindClickHandlers = function(){

      self.$el.off('click', '[data-apos-add-array-item]').one('click', '[data-apos-add-array-item]', function(e){
        e.stopPropagation();
        e.preventDefault();
        self.saveItemState(function(){
          self.createItem();
        });
      });

      self.$el.one('click', '[data-apos-array-items-trigger]', function(e){
        e.stopPropagation();
        e.preventDefault();
        var $self = $(this);

        self.saveItemState(function(){
          self.active = $self.data('apos-array-items-trigger');
          self.editItem();
        });
      });

      self.$el.one('click', '[ data-apos-delete-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();

        var $self = $(this);
        var title = $self.parent().text();

        var id = $self.parent().attr('data-id');
        if (!id) {

        } else {
          self.remove(id);
        }

        // is the the active one?
        if (self.active === parseInt($self.parent().data('apos-array-items-trigger'))) {
          self.active = Math.max(parseInt(self.active) - 1, 0);
          self.editItem();
        }
      });

      $('body').one('click', '[data-apos-save-array-items]', function(e){
        e.stopPropagation();
        e.preventDefault();
        var $self = $(this);

        self.saveItemState(function(){
          self.saveArray();
        });
      });
    }

    self.remove = function(_id) {
      self.arrayItems = _.filter(self.arrayItems, function(choice) {
        return choice.id !== _id;
      });
      return self.refresh();
    };

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


    // self.get = function(callback) {
    //   if (!self.refreshing) {
    //     return callback(null, self.arrayItems);
    //   }
    //   setTimeout(function() {
    //     return self.get(callback);
    //   }, 50);
    // };



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
