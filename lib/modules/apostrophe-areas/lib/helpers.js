let _ = require('lodash');

module.exports = function(self, options) {
  self.addHelpers({

   // Former 2.x way of inserting singletons. Throws an error in 3.x. See the new {% singleton %} tag.

    singleton: function(doc, name, type, _options) {
      throw new Error('3.x migration: you must replace {{ apos.areas.singleton(...) }} calls with the new {% singleton doc, name, options %} syntax. Note the lack of parens, and the need for {% rather than {{. Otherwise all syntaxes accepted for apos.singleton work here too.');
    },

    // Former 2.x way of inserting areas. Throws an error in 3.x. See the new {% area %} tag.

    area: function(doc, name, _options) {
      throw new Error('3.x migration: you must replace {{ apos.area(...) }} calls with the new {% area doc, name, { options... } %} tag. Note the lack of parens, and the need for {% rather than {{. Otherwise all syntaxes that worked for apos.area work here too.');
    },

   // Throws an error in 3.x. See the new {% area %} or {% singleton %} tag.
   // There is also a {% widget %} tag that corresponds directly to this, but
   // that is usually not what you want.

    widget: function(widget, options) {
      throw new Error('3.x migration: you must replace {{ apos.areas.widget(...) }} calls with the new {% widget item, options %} syntax. Note the lack of parens, and the need for {% rather than {{.');
    },

    // Returns the rich text markup of all `apostrophe-rich-text` widgets
    // within the provided doc or area, concatenated as a single string. In future this method
    // may improve to return the content of other widgets that consider themselves primarily
    // providers of rich text, such as subclasses of `apostrophe-rich-text`,
    // which will **not** be regarded as a bc break. However it will never return images, videos, etc.
    //
    // By default the rich text contents of the widgets are joined with
    // a newline between. You may pass your own `options.delimiter` string if
    // you wish a different delimiter or the empty string. You may also pass
    // an HTML element name like `div` via `options.wrapper` to wrap each
    // one in a `<div>...</div>` block. Of course, there may already be a div
    // in the rich txt (but then again there may not).
    //
    // Content will be retrieved from any widget type that supplies a
    // `getRichText` method.

    richText: function(within, options) {
      // Use the safe filter so that the markup doesn't get double-escaped by nunjucks
      return self.apos.templates.safe(self.richText(within, options));
    },

    // Returns the plaintext contents  of all rich text widgets
    // within the provided doc or area, concatenated as a single string.
    //
    // By default the rich text contents of the various widgets are joined with
    // a newline between. You may pass your own `options.delimiter` string if
    // you wish a different delimiter or the empty string.
    //
    // Pass `options.limit` to limit the number of characters. This method will
    // return fewer characters in order to avoid cutting off in mid-word.
    //
    // By default, three periods (`...`) follow a truncated string. If you prefer,
    // set `options.ellipsis` to a different suffix, which may be the empty string
    // if you wish.
    //
    // Content will be retrieved from any widget type that supplies a
    // `getRichText` method.

    plaintext: function(within, options) {
      return self.plaintext(within, options);
    },

    // Returns true if the named area in the given `doc` is empty.
    //
    // Alternate syntax: `{ area: doc.areaname, ... more options }`
    //
    // An area is empty if it has no widgets in it, or when
    // all of the widgets in it return true when their
    // `isEmpty()` methods are interrogated. For instance,
    // if an area only contains a rich text widget and that
    // widget. A widget with no `isEmpty()` method is never empty.

    isEmpty: function(doc, name) {
      let area;
      if (!name) {
        area = doc.area;
      } else {
        area = doc[name];
      }
      return self.isEmpty({ area: area });
    }

  });

  // These are the most frequently used helpers in A2,
  // so we allow their use without typing .areas first
  self.addHelperShortcut('area');
  self.addHelperShortcut('singleton');
};
