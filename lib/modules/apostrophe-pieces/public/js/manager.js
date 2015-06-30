apos.define('apostrophe-pieces-manager', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.page = 1;
    options.source = 'manage';

    self.filters = [
      {
        name: 'page',
        handler: function($el, value) {
          self.currentFilters.page = value;
          self.refresh();
        }
      },
      {
        name: 'published',
        setDefault: function() {
          self.currentFilters.published = 'any';
        }
      },
      {
        name: 'trash',
        setDefault: function() {
          self.currentFilters.trash = '0';
        }
      }
    ];
    self.currentFilters = {};
    self.beforeShow = function(callback) {
      self.$list = self.$el.find('[data-list]');
      self.$pager = self.$el.find('[data-pager]');
      self.initFilters();
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
    self.initFilters = function() {
      _.each(self.filters, function(filter) {
        filter.setDefault = filter.setDefault || function() {
          self.currentFilters[filter.name] = 1;
        };
        filter.handler = filter.handler || function($el, value) {
          self.currentFilters[filter.name] = value;
          self.currentFilters.page = 1;
          if ($el.hasClass('apos-pill-choice')) {
            var $pill = $el.closest('[data-pill]');
            $pill.find('[data-' + filter.name + ']').removeClass('apos-active');
            $el.addClass('apos-active');
          }
          self.refresh();
        };
        filter.setDefault();
        self.link(filter.name, filter.handler);
      });
    };
    self.refresh = function() {
      var listOptions = {
        format: 'managePage'
      };

      _.extend(listOptions, self.currentFilters);

      $.jsonCall(self.options.action + '/list', listOptions, function(response) {
        if (!response.status === 'ok') {
          alert('An error occurred. Please try again.');
          return;
        }
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
