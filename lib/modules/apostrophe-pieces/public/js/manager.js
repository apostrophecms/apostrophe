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
      }
    ];

    self.currentFilters = {};

    self.beforeShow = function(callback) {
      self.$list = self.$el.find('[data-list]');
      self.$pager = self.$el.find('[data-pager]');
      _.each(self.filters, function(filter) {
        filter.setDefault = filter.setDefault || function() {
          self.currentFilters[filter.name] = 1;
        };
        filter.handler = filter.handler || function($el, value) {
          // TODO generalize this beyond pills
          self.currentFilters[filter.name] = value;
          self.currentFilters.page = 1;
          var $pill = $el.closest('[data-pill]');
          $pill.find('[data-' + filter.name + ']').removeClass('apos-active');
          $el.addClass('apos-active');
          self.refresh();
        };
        filter.setDefault();
        self.action(filter.name, filter.handler);
      });
      self.refresh();
      return callback(null);
    };
    // $el.on('click', '[data-pill] [data-choice]', function() {
    //   var $choice = $(this);
    //   var $pill = $choice.closest('[data-pill]');
    //   $pill.find('[data-choice]').removeClass('apos-active');
    //   $choice.addClass('apos-active');
    //   self.filters[$pill.data('name')] = $choice.attr('data-choice');
    //   page = 1;
    //   self.triggerRefresh();
    //   return false;
    // });
    // self.toPage = function(page) {
    //   self.page = page;
    //   self.refresh();
    // };
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
