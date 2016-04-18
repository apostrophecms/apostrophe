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
    };

    self.generateTitle = function(item, index) {
      return item[self.field.titleField] || ('#' + (index + 1));
    }

    self.afterShow = function(){
      self.load();
    };

    self.addToItems = function() {
      self.arrayItems.push({ _title: "New Item", id: apos.utils.generateId() });
      self.active = self.arrayItems.length - 1;
      self.refreshItems();
    };

    self.setItemTitles = function() {
      self.arrayItems = _.map(self.arrayItems, function(item, i){
        item._title = self.generateTitle(item, i);
        return item;
      });
    };

    // Array Items-Related methods
    self.refreshItems = function(){
      return self.html('arrayItems', { arrayItems: self.arrayItems, field: self.field, active: self.active }, function(html) {
        self.$arrayItems.html($(html));
        self.bindClickHandlers();
      });
    };

    // Ask the server to create an empty form
    // populated by schema fields. Form is 'arrayItem.html'
    // Should also re-render the chooser.
    self.createItem = function() {
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.addToItems();
        self.populateItem();
      });
    }

    // Like create, we're asking the server for a
    // empty form, populated by an existing item passed
    // into schema fields.
    self.editItem = function() {
      return self.html('arrayItem', { field: self.field }, function(html) {
        self.$arrayItem.html($(html));
        self.populateItem();
      });
    }

    self.populateItem = function() {
      apos.schemas.populate(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err){
        if (err) {
          console.error(err)
        }
        self.refreshItems();
      });
    }

    self.saveItemState = function(callback) {
      if (self.active === -1) {
        // We currently don't have an actively selected item to convert.
        return setImmediate(callback);
      }
      apos.schemas.convert(self.$arrayItem.find('[data-apos-form]'), self.field.schema, self.arrayItems[self.active], function(err){
        if (err) {
          console.error(err);
        }
        self.arrayItems[self.active]._title = self.generateTitle(self.arrayItems[self.active], self.active);
        return callback();
      })
    }

    self.saveArray = function() {
      options.save(self.arrayItems);
      self.hide();
    }


    // Click handlers
    self.bindClickHandlers = function() {

      self.$el.off('click', '[data-apos-add-array-item]').one('click', '[data-apos-add-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        self.saveItemState(function(){
          self.createItem();
        });
      });

      self.$el.one('click', '[data-apos-array-items-trigger]', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var $self = $(this);

        self.saveItemState(function() {
          self.active = $self.data('apos-array-items-trigger');
          self.editItem();
        });
      });

      self.$el.off('click', '[data-apos-move-array-item]').one('click', '[data-apos-move-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();

        var $el = $(this);
        var id = $el.parent().data('id');
        var direction = $el.data('apos-move-array-item');
        var item = _.find(self.arrayItems, {id: id});
        var index = _.findIndex(self.arrayItems, {id: id});
        var newIndex;

        if (direction === 'up') {
          if (index <= 0) {
            return;
          }
          newIndex = index - 1;
        } else if (direction === 'down') {
          if (index >= self.arrayItems.length - 1) {
            return;
          }
          newIndex = index + 1;
        }
        var temp = self.arrayItems[index];
        self.arrayItems[index] = self.arrayItems[newIndex];
        self.arrayItems[newIndex] = temp;
        self.active = newIndex;
        self.editItem();
        self.refresh();
      });

      self.$el.one('click', '[data-apos-delete-array-item]', function(e) {
        e.stopPropagation();
        e.preventDefault();

        var $self = $(this);
        var id = $self.parent().data('id');

        if (id) {
          self.remove(id);
        }
        // If there are no array items left, clear out the schema.
        if (!self.arrayItems.length) {
          self.active = -1;
          return self.$arrayItem.html('');
        }
        // If we just removed the active array item, switch to the one
        // before this one.
        if (self.active === parseInt($self.parent().data('apos-array-items-trigger'))) {
          self.active = Math.max(parseInt(self.active) - 1, 0);
          self.editItem();
        }
      });

      self.$el.parents('[data-modal]').find('[data-apos-save-array-items]').on('click', function(e){
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
  }
});
