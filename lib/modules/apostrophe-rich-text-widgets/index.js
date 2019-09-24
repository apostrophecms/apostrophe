// Implements rich text editor widgets. Unlike most widget types, the rich text
// editor does not use a modal; instead you edit in context on the page.

var _ = require('@sailshq/lodash');
var sanitizeHtml = require('sanitize-html');
var jsDiff = require('diff');

module.exports = {
  extend: 'apostrophe-widgets',

  label: 'Rich Text',

  construct: function(self, options) {

    // Return just the rich text of the widget, which may be undefined or null if it has not yet been edited

    self.getRichText = function(widget) {
      return widget.content;
    };

    options.contextualOnly = !_.isUndefined(options.contextualOnly) ? options.contextualOnly : true;

    // TODO We may want to use the default widget load, if we start having nested
    // areas in rich text widgets to support lockups
    self.load = function(req, widgets, callback) {
      return setImmediate(callback);
    };

    var superSanitize = self.sanitize;
    self.sanitize = function(req, input, callback) {
      return superSanitize(req, input, function(err, output) {
        if (err) {
          return callback(err);
        }
        output.content = sanitizeHtml(input.content, self.options.sanitizeHtml);
        return callback(null, output);
      });
    };

    // Rich text editor content is found in the
    // div itself as markup, so don't redundantly
    // represent it as a data attribute.
    self.filterForDataAttribute = function(widget) {
      return _.omit(widget, 'content');
    };

    self.addSearchTexts = function(item, texts) {
      texts.push({ weight: 10, text: self.apos.utils.htmlToPlaintext(item.content), silent: false });
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

    self.isEmpty = function(widget) {
      var text = self.apos.utils.htmlToPlaintext(widget.content || '');
      return !text.trim().length;
    };

    var superPushAssets = self.pushAssets;
    self.pushAssets = function() {
      superPushAssets();
      self.pushAsset('stylesheet', 'user', { when: 'user' });
      if (self.apos.assets.options.lean) {
        // Intentionally pushed only for the user scene, this player triggers
        // the rich text editor on click when the classic player is
        // not used due to lean assets
        self.pushAsset('script', 'lean-user', { when: 'user' });
      }
    };

    self.getWidgetClasses = function(widget) {
      return [ 'apos-rich-text-widget' ];
    };

    self.getWidgetWrapperClasses = function(widget) {
      return [ 'apos-rich-text-widget-wrapper' ];
    };

  }

};
