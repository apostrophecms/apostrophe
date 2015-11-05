apos.define('apostrophe-docs-chooser', {
  extend: 'apostrophe-context',
  beforeConstruct: function(self, options) {
    self.options = options;
    self.field = options.field;
    self.$el = options.$el;
    self.action = options.manager.action;
    self.choices = [];
  },
  afterConstruct: function(self, callback) {
    return async.series([
      self.load
    ], function(err) {
      if (err) {
        return callback(err);
      }
      self.enableLinks();
      self.enableAutocomplete();
      return callback(null);
    });
    return self.load(callback);
  },
  construct: function(self, options) {
    self.load = function(callback) {
      return self.html('chooser', function(html) {
        self.$el.html(html);
        self.$el.data('aposChooser', self);
        self.$choices = self.$el.find('[data-list]:first');
        return self.set([]);
      }, function(err) {
        return callback(err);
      });
    };
    self.set = function(choices) {
      self.choices = choices;
      return self.refresh();
    };
    self.get = function(callback) {
      if (!self.refreshing) {
        return callback(null, self.choices);
      }
      setTimeout(function() {
        return self.get(callback);
      }, 50);
    };
    self.refreshing = 0;
    self.refresh = function() {
      if (self.refreshing) {
        self.refreshing++;
        return;
      }
      self.refreshing++;
      self.$choices.html('');
      return self.html('chooser-choices', function(html) {
        self.$choices.html(html);
        self.decrementRefreshing();
      }, function(err) {
        self.decrementRefreshing();
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

    self.enableLinks = function() {
      self.link('delete', 'item', function($button, _id) {
        self.choices = _.filter(self.choices, function(choice) {
          return choice._id !== _id;
        });
        return self.refresh();
      });
      self.link('raise', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { _id: _id });
        if (index === -1) {
          return;
        }
        if (index === 0) {
          return;
        }
        var tmp = self.choices[index - 1];
        self.choices[index - 1] = self.choices[index];
        self.choices[index] = tmp;
        return self.refresh();
      });
      self.link('lower', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { _id: _id });
        if (index === -1) {
          return;
        }
        if (index === (choices.length - 1)) {
          return;
        }
        var tmp = self.choices[index + 1];
        self.choices[index + 1] = self.choices[index];
        self.choices[index] = tmp;
        return self.refresh();
      });
      self.enableAutocomplete = function() {
        self.$autocomplete = self.$el.find('[data-autocomplete]');
        self.$autocomplete.autocomplete({
          source: function(request, response) {
            return self.api(self.action + '/autocomplete', {
              term: request.term,
              field: self.field
            }, response);
          },
          minLength: 1,
          // Stomp out suggestions of choices already made
          response: function(event, ui) {
            var content = ui.content;
            var filtered = _.filter(content, function(item) {
              return !_.find(self.choices, { value: datum.value });
            });
            // "Why don't you just assign to ui.content?" jquery.ui.autocomplete
            // is holding a reference to the original array. If I assign to ui.content
            // I'm not changing that original array and jquery.ui.autocomplete ignores me.
            content.length = 0;
            $.each(filtered, function(i, datum) {
              content.push(datum);
            });
          },
          focus: function(event, ui) {
            self.$autocomplete.val(ui.item.label);
            return false;
          },
          select: function(event, ui) {
            self.$autocomplete.val('');
            self.choices.push({ value: ui.value });
            self.refresh();
            return false;
          }
        });
      };
    }
  }
});
