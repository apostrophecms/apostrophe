
var path = require('path');
var extend = require('extend');
var _ = require('underscore');

/**
 * aposLocals
 * @augments Augments the apos object with methods providing locals for Express
 */

module.exports = function(self) {
  self._aposLocals = {
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
    // be cloned by jQuery

    aposTemplates: function(when) {
      if (!when) {
        when = 'all';
      }
      var templates = self._assets['templates'];
      templates = self.filterAssets(templates, when);
      return _.map(templates, function(template) {
        if (template.call) {
          return template.call();
        } else {
          return self.partial(template.file, {}, [ path.dirname(template.file) ]);
        }
      }).join('');
    },

    /**
     * Renders a content area. Three syntaxes are supported. We recommend
     * the first one for most uses:
     *
     * aposArea(page, 'body', { ... other options ... })
     * aposArea({ page: page, name: 'body', ... other options ... })
     * aposArea({ slug: page.slug + ':body', area: page.areas.body, ... other options ... })
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
      }

      if (!options.controls) {
        options.controls = self.defaultControls;
      }

      var area = options.area;
      delete options.area;
      if (!area) {
        // Invent the area if it doesn't exist yet, so we can
        // edit pages not previously edited
        area = { items: [] };
      }
      // Keep options and area separate, area is much too big to stuff into
      // the options attribute of every area element, whoops
      return self.partial('area', { options: options, area: area });
    },

    /**
     * Renders a singleton (a standalone widget). Three syntaxes are supported. We recommend
     * the first one for most uses:
     *
     * aposSingleton(page, 'body', 'slideshow', { ... other options ... })
     * aposSingleton({ page: page, name: 'body', type: 'slideshow', ... other options ... })
     * aposSingleton({ slug: page.slug + ':body', area: page.areas.body, type: 'slideshow', ... other options ... })
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

    aposAreaContent: function(items, options) {
      var result = '';
      var allowed = options.allowed;
      _.each(items, function(item) {
        if (allowed && (!_.contains(allowed, item.type))) {
          return;
        }
        var itemOptionsIn = options ? options[item.type] : {};
        var itemOptions = {};
        extend(true, itemOptions, itemOptionsIn);
        if (options.editView) {
          itemOptions.editView = true;
        }
        result += self._aposLocals.aposItemNormalView(item, itemOptions).trim();
      });
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

    aposMediaMenu: function(options) {
      return self.partial('mediaMenu', options);
    },

    aposTagsMenu: function(options) {
      return self.partial('tagsMenu', options);
    },

    aposItemNormalView: function(item, options) {
      if (!options) {
        options = {};
      }
      if (!self.itemTypes[item.type]) {
        console.log("Unknown item type: " + item.type);
        return;
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

      return self.partial('itemNormalView', { item: item, itemType: itemType, options: options, jsonOptions: jsonOptions, attributes: attributes });
    },

    // Keep in sync with browser side implementation in content.js
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

    aposLog: function(m) {
      console.log(m);
      return '';
    },

    aposGenerateId: function() {
      return self.generateId();
    },

    // Generate the right range of page numbers to display in the pager.
    // Nunjucks should be doing this but it's too broken at the moment
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

    // Events module needs this available in nunjucks to easily format
    // events happening this year in a less wordy way

    aposIsCurrentYear: function(date) {
      var now = new Date();
      return date.getYear() === now.getYear();
    },

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

    aposReverse: function(array){
      return array.reverse();
    },

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
    // a last property, the last object wins.
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
    // Usage: {{ aposAreaPlaintext({ area: page.body, truncate: 200 }) }}

    aposAreaPlaintext: function(options) {
      return self.getAreaPlaintext(options);
    }
  };
  // Add more locals for Apostrophe later. Used by extension modules
  // like apostrophe-pages
  self.addLocal = function(name, fn) {
    self._aposLocals[name] = fn;
    self.app.locals[name] = fn;
  };
};

