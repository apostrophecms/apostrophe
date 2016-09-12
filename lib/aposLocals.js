
var path = require('path');
var extend = require('extend');
var _ = require('lodash');
var moment = require('moment');
var findBigObjects = require('find-big-objects');

/**
 * aposLocals
 * @augments Augments the apos object with methods providing locals for Express
 */

module.exports = function(self) {
  self._aposLocals = {

    aposPrefix: self.prefix,

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
        return '<link href="' + self.prefix + '/apos-minified/' + when + '-' + self._generation + '.css" rel="stylesheet" />';
      } else {
        if (self._lessMasters && self._lessMasters[when]) {
          return '<link href="' + self.prefix + self._lessMasters[when].web + '" rel="stylesheet" />';
        }
        return _.map(self.filterAssets(self._assets['stylesheets'], when), function(stylesheet) {
          return '<link href="' + self.prefix + stylesheet.web + '" rel="stylesheet" />';
        }).join("\n");
      }
    },

    // Access to the unique asset generation ID string for this build. Useful if
    // you need to link to  some assets without using our pipeline and you want
    // cache busting on new deployments, without losing the benefit of the cache
    // at other times

    aposGeneration: function() {
      return self._generation;
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
        var unminifiable = self.filterAssets(self._assets['scripts'], when, false);
        var result = prefix() + scriptTags(unminifiable);
        result += '<script src="' + self.prefix + '/apos-minified/' + when + '-' + self._generation + '.js"></script>\n' + setScene();
        return result;
      } else {
        var minifiable = self.filterAssets(self._assets['scripts'], when);
        return prefix() + scriptTags(minifiable) + setScene();
      }

      function scriptTags(scripts) {
        return _.map(scripts, function(script) {
          return '<script src="' + self.prefix + script.web + '"></script>';
        }).join("\n");
      }

      // We don't want to use pushGlobalData for this in the usual way because
      // we want to be certain of the timing
      function setScene() {
        return "<script>apos.scene = " + JSON.stringify(when) + ";</script>\n";
      }

      // apos.data.prefix must be available before any
      // .js files load, notably beforeCkeditor.js
      function prefix() {
        return "<script>\n" +
          "if (!window.apos) {\n" +
          "  window.apos = {};\n" +
          "}\n" +
          "window.apos.data = { prefix: " + JSON.stringify(self.prefix) + " };\n</script>\n";
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
        return self.renderTemplateAsset(template).trim();
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
     * `aposArea({ slug: page.slug + ':body', area: page.body, ... other options ... })`
     *
     * Other supported options include `controls` and an option named for each
     * widget type, which is passed on as the options to that widget.
     *
     * Note that you do not have to specify the `edit` option if you use the first two syntaxes,
     * but you may if you wish to specifically forbid editing for a user who normally could.

     */
    aposArea: function(page, name, options) {

      // Make a shallow clone of options so our modifications don't
      // affect future calls. A deep clone would be very expensive,
      // fortunately we don't modify any deep properties. -Tom

      options = _.clone(options);

      // Boil the newer syntax options down to the old first before
      // we actually try to access anything in options. -Tom

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
        options.area = options.page[options.name];
        if (options.edit === undefined) {
          options.edit = options.page._edit;
        }
        // So we don't choke the browser with JSON of the entire page in
        // the area options
        delete options.page;
      }

      // If the slug is not explicitly given, try to get it from
      // the area. This works for areas that already exist, but
      // cannot be relied upon for new areas obviously
      if (options.area && (!options.slug)) {
        options.slug = options.area.slug;
      }

      /* OK, now we can acccess options for other things. */

      if (!options.controls) {
        options.controls = self.defaultControls;
      }
      options.styles = options.styles || self.controlTypes.style.choices;

      if (!options.initialContent) {
        if (options.textOnly) {
          options.initialContent = '<p data-initial-content>Click the pencil to get started.</p>';
        } else {
          options.initialContent = '<p data-initial-content>Use the Add Content button to get started.</p>';
        }
      }

      if (!options.initialContent.match(/^<p data-initial-content/)) {
        // We must be able to recognize and remove it. -Tom
        options.initialContent = '<p data-initial-content>' + options.initialContent + '</p>';
      }

      var area = options.area;
      delete options.area;
      if (!area) {
        // Invent the area if it doesn't exist yet, so we can
        // edit pages not previously edited
        area = { items: [] };
        if (options.textOnly) {
          // If the area is text only then it should initially contain an
          // empty text widget as there is no way to add another and we want to
          // be able to apply the apos-empty class immediately
          // area.items.push({ type: 'richText', content: '' });
        }
        if (!options.noInitialContent && options.initialContent && options.edit) {
          area.items.push({ type: 'richText', content: options.initialContent });
        }
      }
      // Keep options and area separate, area is much too big to stuff into
      // the options attribute of every area element, whoops
      return self.partial('area', { options: options, area: area });
    },

    /**
     * Renders a singleton (a standalone widget). Three syntaxes are supported. We recommend
     * the first one for most uses:
     *
     * `aposSingleton(page, 'body', 'slideshow', { ... other options ... })`
     *
     * `aposSingleton({ page: page, name: 'body', type: 'slideshow', ... other options ... })`
     *
     * `aposSingleton({ slug: page.slug + ':body', area: page.body, type: 'slideshow', ... other options ... })`
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
        options.area = options.page[options.name];
        if (options.edit === undefined) {
          options.edit = options.page._edit;
        }
        // So we don't choke the browser with JSON of the entire page in
        // the area options
        delete options.page;
      }
      // If the slug is not explicitly given, try to get it from
      // the area. This works for areas that already exist, but
      // cannot be relied upon for new areas obviously
      if (options.area && (!options.slug)) {
        options.slug = options.area.slug;
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

      // Prune this back so it's not circular
      options.options.itemType = self.jsonItemType(options.itemType);

      // Options to pass on to the DOM

      return self.partial('singleton', options);
    },

    // Returns true if the specified area is empty. Expects a page
    // object and an area name, or an options object containing an
    // object with an `area` property.
    aposAreaIsEmpty: function(page, name) {
      var area;
      if (arguments.length === 2) {
        area = page[name];
      } else {
        // "page" is an options object
        area = page.area;
      }
      if (!area) {
        return true;
      }
      return !_.some(area.items, function(item) {
        if (self.itemTypes[item.type] && self.itemTypes[item.type].empty) {
          return !self.itemTypes[item.type].empty(item);
        } else {
          return true;
        }
      });
    },

    // Returns true if the specified area is empty when considered as a
    // singleton of the specified type. Expects a page object, an area name
    // and a widget type name. Alternatively you may pass a single object
    // with an `area` property and a `type` property, in which case the
    // `area` property is the actual area object.
    aposSingletonIsEmpty: function(page, name, type) {
      var options;
      // Wrong syntax - warn the developer
      if (arguments.length === 2) {
        throw new Error("aposSingletonIsEmpty takes 3 arguments (page, name, type) ");
      }
      // Transform the first syntax to the second
      else if (arguments.length >= 3) {
        if (!options) {
          options = {};
        }
        options.area = page[name];
        options.type = type;
      } else {
        options = arguments[0];
      }

      if (!options.area) {
        return true;
      }

      return !_.some(options.area.items , function(item) {
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
      var limit = items.length;
      if (options.limit && (options.limit < items.length)) {
        limit = options.limit;
      }
      for (i = 0; (i < limit); i++) {
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
          lockup = self.lockups[item.lockup];
        }
        if (lockup) {
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
      }
      return result;
    },

    // Find an image referenced within an area, such as an image in a slideshow widget.
    // Returns the first image matching the criteria. Only GIF, JPEG and PNG images
    // will ever be returned.
    //
    // EASY SYNTAX:
    //
    // aposAreaImage(page, 'body')
    //
    // You may also add options, such as "extension" to force the results to
    // include JPEGs only:
    //
    // aposAreaImage(page, 'body', { extension: 'jpg' })
    //
    // (Note Apostrophe always uses .jpg for JPEGs.)
    //
    // CLASSIC SYNTAX (this is the hard way):
    //
    // aposAreaImage({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension` or `extensions` (an array of extensions)
    // to filter the results.

    aposAreaImage: function(options /* OR page, name, options */) {
      var result = self.areaImage.apply(self, arguments);
      return result;
    },

    // Find images referenced within an area, such as images in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // aposAreaImages(page, 'body')
    //
    // Now you can loop over them with "for".
    //
    // You may also add options:
    //
    // aposAreaImages(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // Note that Apostrophe always uses three-letter lowercase extensions.
    //
    // CLASSIC SYNTAX:
    //
    // aposAreaImage({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, or `extensions` (an array of extensions).
    //
    // The `limit` option limits the number of results returned. Note that
    // `areaImage` is more convenient than `aposAreaImages` if limit is 1.
    //
    // See also aposAreaFiles.

    aposAreaImages: function(options /* or page, name, _options */) {
      return self.areaImages.apply(self, arguments);
    },

    // Find a file referenced within an area, such as an image in a slideshow widget,
    // or a PDF in a file widget.
    //
    // Returns the first file matching the criteria.
    //
    // EASY SYNTAX:
    //
    // aposAreaFile(page, 'body')
    //
    // You may also add options:
    //
    // aposAreaFile(page, 'body', { extension: 'jpg' })
    //
    // CLASSIC SYNTAX:
    //
    // aposAreaFile({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available.
    //
    // If you are using `group: "images"` consider calling aposAreaImage instead.
    // This is convenient and protects you from accidentally getting a PDF file.

    aposAreaFile: function(options /* or page, name, _options */) {
      return self.areaFile.apply(self, arguments);
    },

    // Find files referenced within an area, such as images in a slideshow widget.
    // Returns all the files matching the criteria unless the "limit" option is used.
    //
    // EASY SYNTAX:
    //
    // aposAreaFiles(page, 'body')
    //
    // Now you can loop over them with "for".
    //
    // You may also add options:
    //
    // aposAreaFiles(page, 'body', { extension: 'jpg', limit: 2 })
    //
    // CLASSIC SYNTAX:
    //
    // aposAreaFile({ area: page.body })
    //
    // OPTIONS:
    //
    // You may specify `extension`, `extensions` (an array of extensions)
    // or `group` to filter the results. By default the `images` and `office` groups
    // are available. See also `aposAreaImage` and `aposAreaImages` for
    // convenience.
    //
    // The `limit` option limits the number of results returned. Note that
    // `aposAreaFile` is more convenient than `aposAreaFiles` if you want
    // just one file.
    //
    // If you are using `group: "images"` consider calling aposAreaImages instead.
    // This is convenient and protects you from accidentally getting a PDF file.

    aposAreaFiles: function(options /* or page, name, _options */) {
      return self.areaFiles.apply(self, arguments);
    },

    // bc wrapper for aposAreaFile, see aposAreaFile
    aposAreaFindFile: function(options /* or page, name, _options */) {
      return self.areaFile.apply(self, arguments);
    },

    // Outputs markup for a button that accesses the media
    // admin interface.
    aposMediaMenu: function(permissions) {
      if (self.permissions.can({
        user: {
          permissions: permissions
        }
      }, 'edit-file')) {
        return self.partial('mediaMenu', permissions);
      }
    },

    // Outputs markup for a button that access the tag
    // admin interface. TODO: in 0.6 switch to a permissions
    // object as the only argument.
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
        console.error("Unknown item type: " + item.type);
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
      if (itemType.json) {
        // Type has a custom JSON filter
        attributes = itemType.json(item);
      } else {
        // use forOwn rather than each() to avoid being faked out
        // by any object that happens to have a "length" property -Tom and Joel
        _.forOwn(item, function(value, key) {
          if (_.contains(itemType.jsonProperties, key)) {
            // Whitelisted
          } else {
            // By default, all properties that do not start with _ and
            // are not the "content" property are made available on
            // the element as JSON attributes
            if ((typeof(key) === 'string') && ((key === 'content') || (key.substr(0, 1) === '_'))) {
              return;
            }
          }
          attributes[key] = value;
        });
      }

      // findBigObjects(options, 'options: ' + item.type, 50000);
      // findBigObjects(attributes, 'attributes: ' + item.type, 50000);

      // All options must be made available on the browser side,
      // otherwise it is not possible to see the widget properly
      // after it is saved without a page refresh. Corollary:
      // giant things like page objects should never be passed
      // as options. Let the loader function get them

      var empty = itemType.empty ? itemType.empty(item) : false;

      var response = self.partial('itemNormalView', { item: item, itemType: itemType, empty: empty, options: options, attributes: attributes });
      return response;
    },

    // Given a file object (as found in a slideshow widget for instance),
    // return the file URL. If options.size is set, return the URL for
    // that size (one-third, one-half, two-thirds, full). full is
    // "full width" (1140px), not the original. For the original, don't pass size
    // There is a matching client-side implementation accessible as apos.filePath

    aposFilePath: function(file, options) {
      return self.filePath(file, options);
    },

    // Convenience method for the file path of a slideshow's first image.
    aposAreaImagePath: function(page, name, options) {
      options = options || {};
      return self._aposLocals.aposFilePath( self.areaImage.apply(self, arguments), options);
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

    // For an array of versions, return either the last 7 days's or this months versions.
    aposVersionsDateRange: function(versions, range){
      var stop;
      if (range === 'week'){
        stop = moment().subtract(7, 'days');
      } else {
        stop = moment().subtract(1, 'month').endOf('month');
      }
      return _.filter(versions, function(version){
        return moment(version.createdAt).isAfter(stop);
      });
    },

    // Test whether the specified date object refers to a date in the current year.
    // The events module utilizes this

    aposIsCurrentYear: function(date) {
      var now = new Date();
      return date.getYear() === now.getYear();
    },

    // Returns true if the list contains the specified value.
    // If value is an array, returns true if the list contains
    // *any of* the specified values
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

    // Returns true if the list contains at least one
    // object with the named property.

    // The first parameter may also be a single object, in
    // which case this function returns true if that object
    // has the named property.

    aposContainsProperty: function(list, property) {
      if (_.isArray(list)) {
        return _.some(list, function(item){ return _.has(item, property); });
      } else {
        return _.has(list, property);
      }
    },

    // Reverses the order of the array. This MODIFIES the array
    // in addition to returning it
    aposReverse: function(array){
      return array.reverse();
    },

    // If the `list` argument is a string, returns true if it begins
    // with `value`. If the `list` argument is an array, returns
    // true if at least one of its elements begins with `value`.
    aposBeginsWith: function(list, value) {
      if (_.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var listItem = list[i];
          if (listItem.indexOf(value) === 0) {
            return true;
          }
        }
      } else {
        if (list.indexOf(value) === 0) {
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

    // Find the first array element, if any, that has the specified value for
    // the specified property.

    aposFind: function(arr, property, value) {
      return _.find(arr, function(item) {
        return (item[property] === value);
      });
    },

    // Find all the array elements, if any, that have the specified value for
    // the specified property.

    aposFilter: function(arr, property, value) {
      return _.filter(arr, function(item) {
        return (item[property] === value);
      });
    },

    // Find all the array elements, if any, for which the specified property
    // is truthy.

    aposFilterNonempty: function(arr, property) {
      return _.filter(arr, function(item) {
        return (item[property]);
      });
    },

    // Given an array of objects with the given property, return an array with
    // the value of that property for each object.

    aposPluck: function(arr, property) {
      return _.pluck(arr, property);
    },

    // Concatenate all of the given arrays and/or values
    // into a single array. If an argument is an array, all
    // of its elements are individually added to the
    // resulting array. If an argument is a value, it is
    // added directly to the array.

    aposConcat: function(arrOrObj1, arrOrObj2 /* , ... */) {
      // I tried to implement this with call() but I kept
      // getting arrays in my values. We still get the
      // benefit of concat() and its built-in support for
      // treating arrays and scalar values differently. -Tom
      var result = [];
      var i;
      for (i = 0; (i < arguments.length); i++) {
        result = result.concat(arguments[i]);
      }
      return result;
    },

    // Convert an area to plaintext. This will only contain text
    // for items that clearly have an appropriate plaintext
    // representation for the public, so most widgets will not want
    // to be represented as they have no reasonable plaintext
    // equivalent, but you can define the 'getPlaintext' method
    // for any widget to return one (see self.itemTypes for the
    // richText example).

    // Plaintext means truly plain, so if you want to output the
    // text with nunjucks, be sure to use the "e" filter.

    // If the truncate option is present, it is used as a character
    // limit. The plaintext is cut at the closest word boundary
    // before that length. If this cannot be done a hard cutoff is
    // applied so that the result is never longer than
    // options.truncate characters.

    // You may call with the page, areaName, options syntax:

    // {{ aposAreaPlaintext(page, 'body', { truncate: 200 }) }}

    // Or a single options object:

    // {{ aposAreaPlaintext({ area: page.body, truncate: 200 }) }}

    aposAreaPlaintext: function(page, name, options) {
      if (!options) {
        options = {};
      }
      if (arguments.length === 1) {
        options = page;
      } else {
        options.area = page[name];
      }
      return self.getAreaPlaintext(options);
    },

    // Convert an area to richtext. Same as aposAreaPlaintext, but does not
    // strip tags

    aposAreaRichtext: function(page, name, options) {
      if (!options) {
        options = {};
      }
      if (arguments.length === 1) {
        options = page;
      } else {
        options.area = page[name];
      }

      return self.getAreaRichtext(options);
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
    },

    // Returns true if the permissions specified indicate that the
    // user can edit *something*, it doesn't matter what. This includes
    // being able to edit your profile. Useful to
    // decide whether to show the admin bar.
    aposCanEditSomething: function(permissions) {
      return _.some(permissions, function(val, key) {
        return key.match(/^(guest|edit|admin)/);
      });
    },

    // Given a series of alternating keys and values, this
    // function returns an object with those values for
    // those keys. For instance, aposObject('name', 'bob')
    // returns { name: 'bob' }. This is useful because
    // Nunjucks does not allow you to create an object with
    // a property whose name is unknown at the time the
    // template is written.
    aposObject: function(/* key, value, ... */) {
      var o = {};
      var i = 0;
      while (i < arguments.length) {
        o[arguments[i]] = arguments[i + 1];
        i += 2;
      }
      return o;
    }
  };
  // Add more locals for Apostrophe later. Used by extension modules
  // like apostrophe-pages. Can be used to push flags as well as functions.
  self.addLocal = function(name, fn) {
    var add = fn;
    if (typeof(fn) === 'function') {
      // Nunjucks discards information about the true location of an error that
      // happens in a function invoked inside {{ }}. Make this information visible
      // again with our own wrapper function.
      var _fn = function() {
        try {
          return fn.apply(this, arguments);
        } catch (e) {
          console.error('Error occurred in a nunjucks local (an apos* function or one of your own locals)');
          if (e.stack) {
            console.error(e.stack);
          } else {
            console.error('Error has no stack trace, when throwing exceptions always use new Error("message")');
          }
          console.error('^^^^^ HEY LOOK UP HERE FIRST\n');
          throw e;
        }
      };
      add = _fn;
    }
    self._aposLocals[name] = add;
    self.app.locals[name] = add;
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
