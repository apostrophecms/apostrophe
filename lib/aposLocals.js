
var path = require('path');
var extend = require('extend');
var _ = require('underscore');

/**
 * aposLocals
 * @augments Augments the apos object with methods providing locals for Express
 */

module.exports = function(self) {
  self._aposLocals = {

    // aposStylesheets renders markup to load CSS that is needed on
    // any page that will use Apostrophe. Examples: editor.less, content.less
    // and stylesheet assets pushed by other modules. `when` can be set to
    // either `user` or `anon` and signifies whether a user is logged in or not;
    // when users are logged in editing-related stylesheets are sent, otherwise not.
    // The `when` parameter is made available to your page templates, so typically you
    // just write this in your base layout template in the head element:
    //
    // `{{ aposScripts(when) }}`
    //
    // If `minify` is set to `true` in `data/local.js` then minification and combination of
    // files is automatically performed.
    //
    // See `base.html` in the sandbox project.

    aposStylesheets: function(when) {
      if (!self._endAssetsCalled) {
        throw new Error('CODE CHANGE REQUIRED: you must call apos.endAssets once after the last call to apos.pushAsset. Add apos.endAssets to the end of the list in your initApos function.');
      }
      if (self.options.minify) {
        return '<link href="/apos/stylesheets.css?pid=' + self._pid + '&when=' + when + '" rel="stylesheet" />';
      } else {
        return _.map(self.filterAssets(self._assets['stylesheets'], when), function(stylesheet) {
          return '<link href="' + stylesheet.web + '" rel="stylesheet" />';
        }).join("\n");
      }
    },

    // aposScripts renders markup to load browser-side javascript that is needed on
    // any page that will use Apostrophe. Examples: content.js, editor.js, various
    // jquery plugins, jquery itself. `when` can be set to either `user` or `anon` and
    // signifies whether a user is logged in or not; when users are logged in editing-related
    // stylesheets are sent, otherwise not. The `when` parameter is made available to your
    // page templates, so typically you just write this in your base layout template
    // in the head element:
    //
    // `{{ aposScripts(when) }}`
    //
    // If `minify` is set to `true` in `data/local.js` then minification and combination of
    // files is automatically performed.
    //
    // See `base.html` in the sandbox project.

    aposScripts: function(when) {
      if (!self._endAssetsCalled) {
        throw new Error('CODE CHANGE REQUIRED: you must call apos.endAssets once after the last call to apos.pushAsset. Add apos.endAssets to the end of the list in your initApos function.');
      }
      if (!when) {
        // Backwards compatibility with older layouts
        when = 'all';
      }
      if (self.options.minify) {
        return '<script src="/apos/scripts.js?pid=' + self._pid + '&when=' + when + '"></script>\n';
      } else {
        return _.map(self.filterAssets(self._assets['scripts'], when), function(script) {
          return '<script src="' + script.web + '"></script>';
        }).join("\n");
      }
    },

    // aposTemplates renders templates that are needed on any page that will
    // use apos. Examples: slideshowEditor.html, codeEditor.html,
    // etc. These lie dormant in the page until they are needed as prototypes to
    // be cloned by jQuery. `when` can be set to either `user` or `anon` and signifies whether
    // a user is logged in or not; when users are logged in editing-related stylesheets are sent,
    // otherwise not.The `when` parameter is made available to your page templates, so typically
    // you just write this in your base layout template at the end of the body element:
    //
    // `{{ aposTemplates(when) }}`
    //
    // See `base.html` in the sandbox project.

    aposTemplates: function(when) {
      if (!when) {
        when = 'all';
      }
      var templates = self._assets['templates'];
      templates = self.filterAssets(templates, when);
      return _.map(templates, function(template) {
        if (template.call) {
          return template.call(template.data);
        } else {
          return self.partial(template.file, template.data, [ path.dirname(template.file) ]);
        }
      }).join('');
    },

    /**
     * Renders a content area. Three syntaxes are supported. We recommend
     * the first one for most uses:
     *
     * `aposArea(page, 'body', { ... other options ... })`
     *
     * `aposArea({ page: page, name: 'body', ... other options ... })`
     *
     * `aposArea({ slug: page.slug + ':body', area: page.areas.body, ... other options ... })`
     *
     * Other supported options include `controls` and an option named for each
     * widget type, which is passed on as the options to that widget.
     *
     * Note that you do not have to specify the `edit` option if you use the first two syntaxes,
     * but you may if you wish to specifically forbid editing for a user who normally could.

     */
    aposArea: function(page, name, options) {

      // Boil the newer syntax options down to the old
      if (arguments.length >= 2) {
        if (!options) {
          options = {};
        }
        options.page = arguments[0];
        options.name = arguments[1];
      } else {
        options = arguments[0];
      }
      if (options.page && options.name) {
        options.slug = options.page.slug + ':' + options.name;
        options.area = options.page.areas[options.name];
        if (options.edit === undefined) {
          options.edit = options.page._edit;
        }
        // So we don't choke the browser with JSON of the entire page in
        // the area options
        delete options.page;
      }

      if (!options.controls) {
        options.controls = self.defaultControls;
      }
      options.styles = options.styles || self.controlTypes.style.choices;

      var area = options.area;
      delete options.area;
      if (!area) {
        // Invent the area if it doesn't exist yet, so we can
        // edit pages not previously edited
        area = { items: [] };
      }
      // Keep options and area separate, area is much too big to stuff into
      // the options attribute of every area element, whoops
      return self.partial('area', { options: options, area: area, alwaysEditing: self.alwaysEditing });
    },

    /**
     * Renders a singleton (a standalone widget). Three syntaxes are supported. We recommend
     * the first one for most uses:
     *
     * `aposSingleton(page, 'body', 'slideshow', { ... other options ... })`
     *
     * `aposSingleton({ page: page, name: 'body', type: 'slideshow', ... other options ... })`
     *
     * `aposSingleton({ slug: page.slug + ':body', area: page.areas.body, type: 'slideshow', ... other options ... })`
     *
     * Other options are passed on to the widget.
     *
     * Note that you do not have to specify the `edit` option if you use the first two syntaxes,
     * but you may if you wish to specifically forbid editing for a user who normally could.
     */
    aposSingleton: function(page, name, type, options) {
      // Transform the first syntax to the second
      if (arguments.length >= 3) {
        if (!options) {
          options = {};
        }
        options.page = page;
        options.name = name;
        options.type = type;
      } else {
        options = arguments[0];
      }
      if (!self.itemTypes[options.type]) {
        console.error("Attempt to insert a singleton of a nonexistent type: " + options.type);
        return;
      }
      // Find area based on page and name
      if (options.page && options.name) {
        options.slug = options.page.slug + ':' + options.name;
        options.area = options.page.areas[options.name];
        if (options.edit === undefined) {
          options.edit = options.page._edit;
        }
        // So we don't choke the browser with JSON of the entire page in
        // the area options
        delete options.page;
      }
      if (!options.area) {
        // Invent the area if it doesn't exist yet, so we can
        // edit pages not previously edited
        options.area = { items: [] };
      }
      // If someone transforms an existing area into a singleton, do a reasonable thing by
      // taking the first existing item of the proper type
      var item = _.find(options.area.items, function(item) {
        return item.type === options.type;
      });
      options.itemType = self.itemTypes[options.type];
      options.item = item;
      if (options.item) {
        options.item.position = 'middle';
        options.item.size = 'full';
      }
      // Options to pass on to the widget
      options.options = _.omit(options, 'area', 'item', 'slug', 'type', 'page', 'name', 'edit');
      return self.partial('singleton', options);
    },

    // Returns true if the specified area is empty. Expects an object with
    // an `area` property.
    aposAreaIsEmpty: function(options) {
      if (!options.area) {
        return true;
      }
      return !_.some(options.area.items, function(item) {
        if (self.itemTypes[item.type] && self.itemTypes[item.type].empty) {
          return !self.itemTypes[item.type].empty(item);
        } else {
          return true;
        }
      });
    },

    // Returns true if the specified area is empty when considered as a singleton of the
    // specified type. Expects an object with an `area` property and a `type` property.
    aposSingletonIsEmpty: function(options) {
      if (!options.area) {
        return true;
      }
      return !_.some(options.area.items, function(item) {
        if (self.itemTypes[item.type] && (item.type === options.type) && self.itemTypes[item.type].empty) {
          return !self.itemTypes[item.type].empty(item);
        } else {
          return true;
        }
      });
    },
    aposSlugify: function(string) {
      return self.slugify(string);
    },
    // Outputs the normal views of all of the content items (widgets and/or
    // rich text blocks) specified by the first argument, passing on the specified
    // options. Typically invoked for you by `aposArea` or `aposSingleton`, but can
    // be called directly with `area.items` when you do not wish to render the
    // wrapper markup for the area as a whole (permissible only if editing is
    // not a possibility here). The `allowed` option, if present, should be a list
    // of permitted item types; any items not on that list are not rendered.
    //
    // If a widget has a lockup property the widget and the text item following it
    // are wrapped in an apos-lockup div. If the item following the widget is not
    // a text item the lockup is ignored.
    //
    // Options for individual widget types can be passed as follows:
    // `{ slideshow: { ... options ... } }`
    aposAreaContent: function(items, options) {
      var result = '';
      var allowed = options.allowed;
      var lockupOpen = false;
      var i;
      var lockup;
      for (i = 0; (i < items.length); i++) {
        var item = items[i];
        if (allowed && (!_.contains(allowed, item.type))) {
          continue;
        }
        var itemOptionsIn = options ? options[item.type] : {};
        var itemOptions = {};
        extend(true, itemOptions, itemOptionsIn);
        if (options.editView) {
          itemOptions.editView = true;
        }
        // LOCKUPS: if a widget has the lockup property, do some sanity checks,
        // then output that widget and the rich text item that follows it inside
        // a wrapper div with the apos-lockup class as well as a class derived
        // from the name of the lockup
        lockup = false;
        if (item.lockup && self.lockups[item.lockup] && _.contains(self.lockups[item.lockup].widgets, item.type) && ((i + 1) < items.length) && (items[i + 1].type === 'richText')) {
          console.log('lockup found');
          lockup = self.lockups[item.lockup];
        }
        if (lockup) {
          console.log(item.lockup);
          result += '<div class="apos-lockup ' + self.cssName(item.lockup) + '">';
          // Lockups can contain custom options per widget type
          extend(true, itemOptions, lockup[item.type] || {});
        }
        result += self._aposLocals.aposItemNormalView(item, itemOptions).trim();
        if (lockupOpen) {
          result += "</div>\n";
          lockupOpen = false;
        }
        if (lockup) {
          lockupOpen = true;
        }
        console.log('end of item');
      }
      console.log('returning');
      return result;
    },

    // Returns the first file offered by an area that meets the
    // criteria specified by `options`. If no options are passed,
    // the first file offered by the area is returned. Currently the
    // supported options are `extension` (such as pdf, gif or txt) and
    // `extensions` (which permits an array). This is useful to pull
    // out a particular file to be specially featured in an index view.
    aposAreaFindFile: function(options) {
      return self.areaFindFile(options);
    },

    // Outputs markup for a button that accesses the media admin interface.
    aposMediaMenu: function(options) {
      return self.partial('mediaMenu', options);
    },

    // Outputs markup for a button that access the tag admin interface.
    aposTagsMenu: function(options) {
      return self.partial('tagsMenu', options);
    },

    // Renders the normal, public view of a widget or rich text item. Normally invoked
    // by aposAreaContent, which is usually invoked by aposArea or aposSingleton.
    // Typically you will not need to call this yourself.
    aposItemNormalView: function(item, options) {
      if (!options) {
        options = {};
      }
      if (!self.itemTypes[item.type]) {
        console.log("Unknown item type: " + item.type);
        // Empty string so concatenation does not crash the server
        return '';
      }
      var itemType = self.itemTypes[item.type];
      options.widget = itemType.widget;

      if (options.bodyOnly) {
        options.widget = false;
      }

      // The content property doesn't belong in a data attribute,
      // and neither does any property beginning with an _, unless
      // whitelisted
      var attributes = {};
      _.each(item, function(value, key) {
        if (_.contains(itemType.jsonProperties, key)) {
          // Whitelisted
        } else {
          // By default, all properties that do not start with _ and
          // are not the "content" property are made available on
          // the element as JSON attributes
          if ((key === 'content') || (key.substr(0, 1) === '_')) {
            return;
          }
        }
        attributes[key] = value;
      });

      // Any options listed in a jsonOptions array in the itemType
      // are made available as data attributes on the widget
      var jsonOptions = {};
      _.each(itemType.jsonOptions || [], function(name) {
        if (options[name] !== undefined) {
          jsonOptions[name] = options[name];
        }
      });

      return self.partial('itemNormalView', { item: item, itemType: itemType, options: options, jsonOptions: jsonOptions, attributes: attributes, alwaysEditing: self.alwaysEditing });
    },

    // Given a file object (as found in a slideshow widget for instance),
    // return the file URL. If options.size is set, return the URL for
    // that size (one-third, one-half, two-thirds, full). full is
    // "full width" (1140px), not the original. For the original, don't pass size
    // There is a matching client-side implementation accessible as apos.filePath

    aposFilePath: function(file, options) {
      options = options || {};
      var path = self.uploadfs.getUrl() + '/files/' + file._id + '-' + file.name;
      if (file.crop) {
        var c = file.crop;
        path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
      }
      if (options.size) {
        path += '.' + options.size;
      }
      return path + '.' + file.extension;
    },

    // Log a message to the console from a Nunjucks template. Great for debugging.
    aposLog: function(m) {
      console.log(m);
      return '';
    },

    // Generate a globally unique ID
    aposGenerateId: function() {
      return self.generateId();
    },

    // Generate the right range of page numbers to display in the pager.
    // Just a little too much math to be comfortable in pure Nunjucks
    aposPageRange: function(options) {
      var pages = [];
      var fromPage = options.page - 2;
      if (fromPage < 2) {
        fromPage = 2;
      }
      for (var page = fromPage; (page < (fromPage + options.shown)); page++) {
        pages.push(page);
      }
      return pages;
    },

    // Test whether the specified date object refers to a date in the current year.
    // The events module utilizes this

    aposIsCurrentYear: function(date) {
      var now = new Date();
      return date.getYear() === now.getYear();
    },

    // Returns true if the list contains the specified value
    aposContains: function(list, value) {
      if (_.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
          var valueItem = value[i];
          if (_.contains(list, valueItem)){
            return true;
          }
        }
        return false;
      }
      else{
        return _.contains(list, value);
      }
    },

    // Reverses the order of the array. This MODIFIES the array
    // in addition to returning a copy
    aposReverse: function(array){
      return array.reverse();
    },

    // If the `list` argument is a string, returns true if it begins
    // with `value`. If the `list` argument is an array, returns
    // true if at least one of its elements begins with `value`.
    aposBeginsWith: function(list, value){
      if (_.isArray(list)){
        for (var i = 0; i < list.length; i++) {
          var listItem = list[i];
          if(listItem.indexOf(value) === 0) {
            return true;
          }
        }
      }
      else{
        if(list.indexOf(value) === 0) {
          return true;
        }
      }
      return false;
    },

    // Pass as many objects as you want; they will get merged via
    // `extend` into a new object, without modifying any of them, and
    // the resulting object will be returned. If several objects have
    // a property, the last object wins.
    //
    // This is useful to add one more option to an options object
    // which was passed to you.
    //
    // If any argument is null, it is skipped gracefully. This allows
    // you to pass in an options object without checking if it is null.

    aposMerge: function() {
      var result = {};
      var i;
      for (i = 0; (i < arguments.length); i++) {
        if (!arguments[i]) {
          continue;
        }
        extend(true, result, arguments[i]);
      }
      return result;
    },

    // Find the array element, if any, that has the specified value for
    // the specified property.

    aposFind: function(arr, property, value) {
      return _.find(arr, function(item) {
        return (item[property] === value);
      });
    },

    // Convert an area to plaintext. This will only contain text for items that
    // clearly have an appropriate plaintext representation for the public, so most
    // widgets will not want to be represented as they have no reasonable plaintext
    // equivalent, but you can define the 'getPlaintext' method for any widget to
    // return one (see self.itemTypes for the richText example).
    //
    // If the truncate option is present, it is used as a character limit. The
    // plaintext is cut at the closest word boundary before that length. If this
    // cannot be done a hard cutoff is applied so that the result is never longer
    // than options.truncate characters.
    //
    // Usage: `{{ aposAreaPlaintext({ area: page.body, truncate: 200 }) }}`

    aposAreaPlaintext: function(options) {
      return self.getAreaPlaintext(options);
    },

    // Groups by the property named by 'key' on each of the values.
    // If the property referred to by the string 'key' is found to be
    // an array property of the first object, aposGroupByArray is called.
    //
    // Usage: {{ aposGroupBy(people, 'age') }} or {{ aposGroupBy(items, 'tags') }}
    aposGroupBy: function(items, key){
      if(items.length && Array.isArray(items[0][key])) {
        return self._groupByArray(items, key);
      }
      return _.groupBy(items, key);
    }
  };
  // Add more locals for Apostrophe later. Used by extension modules
  // like apostrophe-pages
  self.addLocal = function(name, fn) {
    self._aposLocals[name] = fn;
    self.app.locals[name] = fn;
  };
  // An extra bit of trickery to support arrays in self._locals.groupBy
  self._groupByArray =function(items, arrayName) {
    var results = {};
    _.each(items, function(item) {
      _.each(item[arrayName] || [], function(inner) {
        if (!results[inner]) {
          results[inner] = [];
        }
        results[inner].push(item);
      });
    });

    return results;
  };
};

