var _ = require('lodash');

module.exports = function(self, options) {
  self.addHelpers({

    // apos.singleton renders a single widget of a fixed type, standing alone
    // in the page. The `_options` object is passed to the widget.
    //
    // A singleton is just a special case of an area, so you can change your
    // mind later and call `apos.area` with the same `name`.
    //
    // The `name` property distinguishes this singleton from other areas in
    // the same `doc`.
    //
    // If `_options.addLabel` is set, that text appears on the button to
    // initially populate the singleton. If `_options.editLabel` is set, that
    // text appears on the button edit an existing widget in the singleton.
    //
    // If `_options` is not specified, Apostrophe falls back to the options
    // configured for the given field `name` in the schema for this type of
    // `doc`. For ordinary pages there usually won't be any, but this is
    // very convenient when working with `apostrophe-pieces`.
    //
    // Alternate syntax: `{ area: doc.areaname, type: type, ... more options }`

    singleton: function(doc, name, type, _options) {
      var area;
      var options;

      if (arguments.length === 1) {
        options = doc;
        area = options.area;
      } else {
        options = { type: type };
        if (_.has(doc, name)) {
          area = doc[name];
        } else {
          area = {
            _docId: doc._id,
            _dotPath: name,
            _edit: doc._edit
          };
        }
      }

      if (!options.widgets) {
        // Need to make the widget definition options configured the same
        // way as in areas to support drag n drop.
        options.widgets = {};
        options.widgets[options.type] = _options || self.getSchemaOptions(doc, name);
      }

      // Don't fill the session with blessings of option sets unless
      // this user actually can edit this singleton
      if (area._edit) {
        _.each(options.widgets || {}, function(options, type) {
          self.apos.utils.bless(self.apos.templates.contextReq, options, 'widget', type);
        });
      }

      options.limit = 1;

      return self.renderArea(area, options);
    },

    // apos.area renders an area: a column of widgets of one or more types.
    //
    // If present The `_options` object must contain a `widgets` property, an object
    // which must at least contain a property by the name of each allowed widget. The
    // corresponding value should be an object, and is passed on as options to
    // widgets of that type appearing in this area.
    //
    // If `blockLevelControls: true` is present, the controls for this area are given
    // extra vertical space and rendered in a distinct color. These are affordances
    // to ensure the user can clearly distinguish the controls of an area used for layout, i.e.
    // an area that contains "two column" and "three column" widgets containing areas
    // of their own.
    //
    // The `name` property distinguishes this area from other areas in
    // the same `doc`.
    //
    // The `limit` option may be used to limit the number of widgets allowed.
    //
    // If `_options` is not specified, Apostrophe falls back to the options
    // configured for the given field `name` in the schema for this type of
    // `doc`. For ordinary pages there usually won't be any, but this is
    // very convenient when working with `apostrophe-pieces`.
    //
    // Alternate syntax: `{ area: doc.areaname, ... more options }`

    area: function(doc, name, _options) {
      var area;
      var options;

      if (arguments.length === 1) {
        options = doc;
        area = options.area;
      } else {
        options = _options || self.getSchemaOptions(doc, name);
        if (_.has(doc, name)) {
          area = doc[name];
        } else {
          area = {
            _docId: doc._id,
            _dotPath: name,
            _edit: doc._edit
          };
        }
      }

      options.hint = options.hint || self.apos.templates.contextReq.__('Use the Add Content button to get started.');

      // Don't fill the session with blessings of option sets unless
      // this user actually can edit this area
      if (area._edit) {
        _.each(options.widgets || {}, function(options, type) {
          self.apos.utils.bless(self.apos.templates.contextReq, options, 'widget', type);
        });
      }

      return self.renderArea(area, options);
    },

    // apos.areas.widget renders one widget. Invoked by both `apos.area` and
    // `apos.singleton`. Not
    // often called directly, but see `area.html` if you are interested in
    // doing so.

    widget: function(widget, options) {
      var manager = self.getWidgetManager(widget.type);
      if (!manager) {
        // Not configured in this project
        return '';
      }
      return self.partial('widget', {
        // The widget minus any properties that don't
        // absolutely need to be crammed into a JSON
        // attribute for the editor's benefit. Good filtering
        // here prevents megabytes of markup. -Tom and Sam
        dataFiltered: manager.filterForDataAttribute(widget),
        manager: manager,
        widget: widget,
        options: options,
        output: function() {
          return manager.output(widget, options);
        }
      });
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
    }

  });
  // These are the most frequently used helpers in A2,
  // so we allow their use without typing .areas first
  self.addHelperShortcut('area');
  self.addHelperShortcut('singleton');
};
