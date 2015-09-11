apos.define('apostrophe-pieces-manager', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.page = 1;
    self.schema = self.options.schema;
    options.source = 'manage';

    // Turn a schema field into a filter. Currently only
    // supports boolean yes/no/any filters

    self.filterFromField = function(field) {
      return {
        name: field.name,
        setDefault: function() {
          self.currentFilters[field.name] = stringify(field.filter.def);
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
      self.enableHeaders();
      apos.on('change', self.onChange);
      self.refresh();
      return callback(null);
    };
    self.addFilter = function(filter/*, setDefault, handler */) {
      if (arguments.length > 1) {
        var newFilter = {};
        newFilter.name = arguments[0];
        if (arguments[1]) {
          newFilter.setDefault = arguments[1];
        }
        if (arguments[2]) {
          newFilter.handler = arguments[2];
        }
        filter = newFilter;
      }
      return self.filters.push(filter);
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

      var filterFields = _.filter(self.schema, function(field) {
        return !!field.filter;
      });

      self.filters = self.filters.concat(_.map(filterFields, function(field) {
        return self.filterFromField(field);
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

    self.enableHeaders = function() {
      self.$el.on('click', '[data-sort]', function() {
        var name = $(this).closest('[data-name]').attr('data-name');
        self.sort = {};
        self.sort[name] = parseInt($(this).attr('data-sort'));
        self.refresh();
        return false;
      });
    }

    self.refresh = function() {
      var listOptions = {
        format: 'managePage'
      };

      _.extend(listOptions, self.currentFilters);
      listOptions.sort = self.sort;

      $.jsonCall(self.options.action + '/list', listOptions, function(response) {
        if (!response.status === 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
        self.$filters.html(response.data.filters);
        self.$headings.html(response.data.headings);
        self.$list.html(response.data.list);
        self.$pager.html(response.data.pager);
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
  }
});
