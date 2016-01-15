apos.define('apostrophe-pieces-manager-modal', {
  extend: 'apostrophe-modal',
  source: 'manage',

  beforeConstruct: function(self, options) {
    if (options.chooser) {
      options.body = options.body || {};
      options.body.chooser = true;
    }
  },

  construct: function(self, options) {

    self.page = 1;
    self.schema = self.options.schema;
    self.parentChooser = self.options.chooser;

    // turn a filter config object into a working filter

    self.generateFilter = function(filter) {
      return {
        name: filter.name,
        setDefault: function() {
          self.currentFilters[filter.name] = stringify(filter.def);
        }
      }
      function stringify(def) {
        if (typeof(def) === 'string') {
          return def;
        }
        else if ((def === undefined) || (def === null)) {
          return 'any';
        } else if (def) {
          return '1';
        } else {
          return '0';
        }
      }
    };

    self.beforeShow = function(callback) {
      self.$headings = self.$el.find('[data-headings]');
      self.$list = self.$el.find('[data-list]');
      self.$pager = self.$el.find('[data-pager]');
      self.$filters = self.$el.find('[data-filters]');
      self.enableFilters();
      self.enableSorts();
      self.enableSearch();
      apos.on('change', self.onChange);
      self.refresh();
      return self.enableChooser(callback);
    };

    self.enableFilters = function() {

      self.filters = [
        {
          name: 'page',
          handler: function($el, value) {
            self.currentFilters.page = value;
            self.refresh();
          }
        }
      ];

      _.each(self.options.filters, function(filter) {
        return self.filterTo
      })
      var filterFields = _.filter(self.schema, function(field) {
        return !!(field.manage && field.manage.filter);
      });

      self.filters = self.filters.concat(_.map(self.options.filters, function(filterConfig) {
        return self.generateFilter(filterConfig);
      }));

      self.currentFilters = {};

      _.each(self.filters, function(filter) {
        filter.setDefault = filter.setDefault || function() {
          self.currentFilters[filter.name] = 1;
        };
        filter.handler = filter.handler || function($el, value) {
          self.currentFilters[filter.name] = value;
          self.currentFilters.page = 1;
          self.refresh();
        };
        filter.setDefault();
        self.link(filter.name, filter.handler);
      });
    };

    self.enableSorts = function() {
      self.$el.on('change', '[name="sort"]', function() {
        self.sort = JSON.parse(self.$el.find('[name="sort"]').val());
        self.refresh();
      });
    };

    self.enableSearch = function() {
      self.$el.on('change', '[name="search-'+self.options.name+'"]', function() {
        self.search = $(this).val();
        self.refresh();
      });
    };

    self.enableChooser = function(callback) {
      if (!self.parentChooser) {
        return setImmediate(callback);
      }
      self.enableCheckboxEventsForChooser();
      return self.parentChooser.clone(
        { $el: self.$el.find('[data-chooser]'), browse: false, autocomplete: false, change: self.reflectChooserInCheckboxes },
        function(err, chooser) {
          if (err) {
            return callback(err);
          }
          self.chooser = chooser;
          return callback(null);
        }
      );
    };

    self.reflectChooserInCheckboxes = function() {
      if (!self.chooser) {
        return;
      }
      return self.chooser.get(function(err, choices) {
        if (err) {
          return;
        }
        self.$el.find('[data-piece] input[type="checkbox"]').each(function() {
          var $box = $(this);
          var id = $box.closest('[data-piece]').attr('data-piece');
          $box.prop('checked', !!_.find(choices, { value: id }));
        });
      });
    };

    self.enableCheckboxEventsForChooser = function() {
      self.$el.on('change', '[data-piece] input[type="checkbox"]', function() {
        // in rare circumstances, might not be ready yet, don't crash
        if (!self.chooser) {
          return;
        }
        var method = $(this).prop('checked') ? self.chooser.add : self.chooser.remove;
        method($(this).closest('[data-piece]').attr('data-piece'));
      });
    };

    self.refresh = function() {
      var listOptions = {
        format: 'managePage'
      };


      _.extend(listOptions, self.currentFilters);
      listOptions.sort = self.sort;
      listOptions.search = self.search;

      return self.api('list', listOptions, function(response) {
        if (!response.status === 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$filters.html(response.data.filters);
        self.$headings.html(response.data.headings);
        self.$list.html(response.data.list);
        self.$pager.html(response.data.pager);
        // right now only filters needs this, but be more futureproof
        apos.emit('enhance', self.$filters);
        apos.emit('enhance', self.$headings);
        apos.emit('enhance', self.$list);
        apos.emit('enhance', self.$pager);
        self.reflectChooserInCheckboxes();
      });
    };

    self.onChange = function(type) {
      if (type === self.options.name) {
        self.refresh();
      }
    };

    self.afterHide = function() {
      // So we don't leak memory and keep refreshing
      // after we're gone
      apos.off('change', self.onChange);
    };

    // Invoked only when we're acting as a browser
    self.saveContent = function(callback) {
      if (!self.chooser) {
        // This should not happen, but be graceful
        return callback(null);
      }
      // Pass our choices back to the chooser hanging out in a schema form that
      // initially triggered us via "browse"
      return self.chooser.get(function(err, choices) {
        if (err) {
          return callback(err);
        }
        self.parentChooser.set(choices);
        return callback(null);
      });
    };

  }
});
