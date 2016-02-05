var _ = require('lodash');
var sanitizeHtml = require('sanitize-html');
var jsDiff = require('diff');

module.exports = {

  label: 'Rich Text',

  afterConstruct: function(self) {

    self.label = self.options.label;

    self.name = self.options.name || self.__meta.name.replace(/\-widgets$/, '');

    self.apos.areas.setWidgetManager(self.name, self);

    self.pushAsset('script', 'always', { when: 'always' });

    self.pushAsset('script', 'user', { when: 'user' });

    self.pushAsset('script', 'editor', { when: 'user' });

    self.pushAsset('stylesheet', 'user', { when: 'user' });


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
      output._id = self.apos.launder.id(input._id);
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

    self.compare = function(old, current) {

      var oldContent = old.content;
      if (oldContent === undefined) {
        oldContent = '';
      }
      var currentContent = current.content;
      if (currentContent === undefined) {
        currentContent = '';
      }
      var diff = jsDiff.diffSentences(self.apos.utils.htmlToPlaintext(oldContent).replace(/\s+/g, ' '), self.apos.utils.htmlToPlaintext(currentContent).replace(/\s+/g, ' '), { ignoreWhitespace: true });

      var changes = _.map(_.filter(diff, function(diffChange) {
        return diffChange.added || diffChange.removed;
      }), function(diffChange) {
        // Convert a jsDiff change object to an
        // apos versions change object
        if (diffChange.removed) {
          return {
            action: 'remove',
            text: diffChange.value,
            field: {
              type: 'string',
              label: 'Content'
            }
          };
        } else {
          return {
            action: 'add',
            text: diffChange.value,
            field: {
              type: 'string',
              label: 'Content'
            }
          };
        }
      });

      if (!changes.length) {
        // Well, something changed! Presumably the formatting.
        return [
          {
            action: 'change',
            field: {
              label: 'Formatting'
            }
          }
        ];
      }

      return changes;

    };

  }
};
