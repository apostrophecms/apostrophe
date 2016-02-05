apos.define('apostrophe-docs-chooser', {
  extend: 'apostrophe-context',
  beforeConstruct: function(self, options) {
    self.options = options;
    self.field = options.field;
    self.$el = options.$el;
    // Our own module is not the right one to talk to for chooser templates
    // because the docs module delivers those. However on the server side you
    // can hook in to render them and the pieces module does do that. -Tom
    options.action = apos.docs.action;
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
  },
  construct: function(self, options) {
    self.load = function(callback) {
      var args = {};
      // browse button can be shut off, for instance if we're already appearing in
      // a manage modal in response to a browse button
      if (options.browse !== false) {
        args.browse = true;
      }
      if (options.autocomplete !== false) {
        args.autocomplete = true;
      }
      return self.html('chooser', args, function(html) {
        self.$el.html(html);
        self.$choices = self.$el.find('[data-choices]:first');
        self.set([]);
        return callback(null);
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
    self.add = function(_id) {
      self.choices.push({ value: _id });
      self.refresh();
    };
    self.remove = function(_id) {
      self.choices = _.filter(self.choices, function(choice) {
        return choice.value !== _id;
      });
      return self.refresh();
    }
    self.refreshing = 0;
    self.last = [];
    self.refresh = function() {
      if (self.refreshing) {
        self.refreshing++;
        return;
      }
      self.refreshing++;
      self.$choices.html('');
      return self.html('chooser-choices', { choices: self.choices, field: self.field }, function(html) {
        self.$choices.html(html);
        self.decrementRefreshing();
        var compare = JSON.stringify(self.choices);
        if (self.last !== compare) {
          self.last = compare;
          self.onChange();
        }
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
        self.remove(_id);
      });
      self.link('raise', 'item', function($button, _id) {
        var index = _.findIndex(self.choices, { value: _id });
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
        var index = _.findIndex(self.choices, { value: _id });
        if (index === -1) {
          return;
        }
        if (index === (self.choices.length - 1)) {
          return;
        }
        var tmp = self.choices[index + 1];
        self.choices[index + 1] = self.choices[index];
        self.choices[index] = tmp;
        return self.refresh();
      });
      self.link('relate', 'item', function($button, _id) {
        var choice = _.find(self.choices, { value: _id });
        if (!choice) {
          return;
        }
        var editorType = self.field.relationshipEditor || apos.docs.getManager(self.field.withType).getToolType('relationship-editor');
        apos.create(editorType, {
          choice: choice,
          field: self.field,
          action: self.action,
          chooser: self
        });
      });
      self.link('browse', function() {
        self.launchBrowser();
      });
    };

    self.enableAutocomplete = function() {
      self.$autocomplete = self.$el.find('[data-autocomplete]');
      self.$autocomplete.autocomplete({
        source: function(request, response) {
          return self.api('autocomplete', {
            term: request.term,
            field: self.field
          }, response);
        },
        minLength: 1,
        // Stomp out suggestions of choices already made
        response: function(event, ui) {
          var content = ui.content;
          var filtered = _.filter(content, function(datum) {
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
          self.add(ui.item.value);
          return false;
        }
      });
    };
    self.getBrowserType = function() {
      return apos.docs.getManager(self.field.withType).getToolType('chooser-modal');
    };
    self.launchBrowser = function() {
      return apos.docs.getManager(self.field.withType).getTool('chooser-modal', { chooser: self });
    };
    // Create a new chooser with the same data and options, merging in any
    // additional options from the first argument. Async because
    // the constructor is async. Delivers (err, newChooser)
    self.clone = function(options, callback) {
      var _options = {};
      _.assign(_options, self.options);
      _.assign(_options, options);
      return apos.create(self.__meta.name, _options, function(err, chooser) {
        if (err) {
          return callback(err);
        }
        return self.get(function(err, data) {
          if (err) {
            return callback(err);
          }
          chooser.set(data);
          return callback(null, chooser);
        });
      });
    };
    self.onChange = function() {
      if (self.options.change) {
        self.options.change();
      }
    };
  }
});
