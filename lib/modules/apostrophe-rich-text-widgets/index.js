var _ = require('lodash');
var sanitizeHtml = require('sanitize-html');

module.exports = {

  label: 'Rich Text',

  afterConstruct: function(self) {

    self.label = self.options.label;

    self.name = self.options.name || self.__meta.name.replace(/\-widgets$/, '');

    self.apos.areas.setWidgetManager(self.name, self);

    self.pushAsset('script', 'always', { when: 'always' });

    self.pushAsset('script', 'user', { when: 'user' });

    self.pushAsset('script', 'editor', { when: 'user' });

    self.apos.push.browserCall('always', 'apos.define(?, ?)',
      self.__meta.name,
      {
        name: self.name,
        label: self.label,
        action: self.action,
        schema: self.schema
      }
    );

    self.apos.push.browserCall('always', 'apos.create(?, {})',
      self.__meta.name);
  },

  construct: function(self, options) {

    // Outputs the widget. Invoked by
    // apos.widget in Nunjucks.

    self.output = function(widget, options) {
      var result = self.partial('widget', { widget: widget, options: options, manager: self });
      return result;
    };

    self.sanitize = function(req, input, callback) {
      var output = {};

      output.type = self.name;
      output.content = sanitizeHtml(input.content, self.options.sanitizeHtml);
      return callback(null, output);
    };

    // Rich text editor content is found in the
    // div itself as markup, so don't redundantly
    // represent it as a data attribute. - Tom and Sam 💁

    self.filterForDataAttribute = function(widget) {
      return _.omit(widget, 'content');
    };

  }
};
