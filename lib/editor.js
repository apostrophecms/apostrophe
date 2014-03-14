var path = require('path');
var extend = require('extend');
var _ = require('underscore');
var sanitize = require('validator').sanitize;
var async = require('async');
var joinr = require('joinr');

/**
 * editor
 * @augments Augments the apos object with methods, routes and
 * properties supporting the editing of content areas
 */

module.exports = {
  construct: function(self) {
    // This is our standard set of controls. If you add a new widget you'll be
    // adding that to self.itemTypes (with widget: true) and to this list of
    // default controls - or not, if you think your widget shouldn't be available
    // unless explicitly specified in a aposArea call. If your project should *not*
    // offer a particular control, ever, you can remove it from this list
    // programmatically

    // Removed the code widget for now in favor of giving 'pre' in the format dropdown a try
    self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'unlink', 'insertUnorderedList', 'insertTable', 'slideshow', 'buttons', 'video', 'files', 'pullquote', 'html' ];

    // These are the controls that map directly to standard document.executeCommand
    // rich text editor actions. You can modify these to introduce other simple verbs that
    // are supported across all browsers by document.execCommand, or to add or remove
    // tags from the choices array of apos.controlTypes.style, but if you introduce
    // commands or tags that the browser does not actually support it will not
    // do what you want.
    //
    // This is not the place to define widgets. See apos.itemTypes for that.

    self.controlTypes = {
      style: {
        type: 'menu',
        label: 'Style',
        choices: [
          { value: 'div', label: 'Normal' },
          { value: 'h3', label: 'Heading 3' },
          { value: 'h4', label: 'Heading 4' },
          { value: 'h5', label: 'Heading 5' },
          { value: 'h6', label: 'Heading 6' },
          { value: 'pre', label: 'Preformatted' },
        ]
      },
      bold: {
        type: 'button',
        label: 'Bold',
        icon: 'bold'
      },
      italic: {
        type: 'button',
        label: 'Italic',
        icon: 'italic'
      },
      createLink: {
        type: 'button',
        label: 'Link',
        icon: 'link'
      },
      unlink: {
        type: 'button',
        label: 'Unlink',
        icon: 'unlink'
      },
      insertUnorderedList: {
        type: 'button',
        label: 'List',
        icon: 'ul'
      },
      insertTable: {
        type: 'button',
        label: 'Table',
        icon: 'table'
      }
    };

    // Sanitize an array of content items in-place, invoking the sanitize
    // method of the itemType object for each.

    self.sanitizeItems = function(items)
    {
      _.each(items, function(item) {
        var itemType = self.itemTypes[item.type];
        if (!itemType) {
          return;
        }
        if (itemType.sanitize) {
          itemType.sanitize(item);
        }
      });
    };

    // Sanitize a slideshow. Often reused by widgets that subclass
    // the slideshow.

    self.sanitizeSlideshow = function(item) {
      if (!Array.isArray(item.ids)) {
        item.ids = [];
      }
      item.showTitles = self.sanitizeBoolean(item.showTitles);
      item.showDescriptions = self.sanitizeBoolean(item.showDescriptions);
      item.showCredits = self.sanitizeBoolean(item.showCredits);
      if (typeof(item.extras) !== 'object') {
        item.extras = {};
      }
      var ids = [];
      var extras = {};
      _.each(item.ids, function(id) {
        id = self.sanitizeString(id);
        if (!id) {
          return;
        }
        var extra = item.extras[id];
        if (typeof(extra) !== 'object') {
          extra = {};
        }
        var newExtra = {
          hyperlink: self.sanitizeUrl(extra.hyperlink, undefined),
          hyperlinkTitle: self.sanitizeString(extra.hyperlinkTitle, undefined)
        };

        if (extra.crop) {
          newExtra.crop = {
            top: self.sanitizeInteger(extra.crop.top),
            left: self.sanitizeInteger(extra.crop.left),
            width: self.sanitizeInteger(extra.crop.width),
            height: self.sanitizeInteger(extra.crop.height)
          };
        }
        extras[id] = newExtra;
        ids.push(id);
      });
      item.ids = ids;
      item.extras = extras;
      return item;
    };

    // Fetch information about the files associated with a slideshow widget
    // and make them accessible via the `._items` property of the widget.
    // Also used by widgets that subclass slideshows.

    self.loadSlideshow = function(req, item, callback) {
      if (!item.ids) {
        // Tolerate lazy representations of empty slideshows
        return callback(null);
      }
      // We're loading a page and we want to defer all of the slideshow joins
      // until we know about all of them and can do a single efficient mongo query
      if (req.deferredSlideshows) {
        req.deferredSlideshows.push(item);
        return callback(null);
      }

      // Nope, we're doing it now
      return self.joinSlideshows(req, [ item ], callback);
    };

    // Join an array of slideshow widgets to their files in one fell swoop,
    // using joinr and some glue code. Used by self.loadSlideshow and also by
    // the deferredSlideshows mechanism which greatly speeds up slideshow loading
    // when there are many documents being loaded.
    self.joinSlideshows = function(req, items, callback) {
      // Each item needs an _id to be compatible with joinr, so just invent one cheaply
      // for the duration of this query.
      var n = 1;
      _.each(items, function(item) {
        item._id = item._id || (n++);
        // Don't get confused if an object already has a stale _items property
        delete item._items;
      });

      return joinr.byArray(items, 'ids', 'extras', '_items', function(ids, callback) {
        return self.getFiles(req, { ids: ids }, function(err, results) {
          if (err) {
            return callback(err);
          }
          return callback(null, results.files);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        // joinr is fastidious and keeps the item and the relationship to the item
        // in separate properties, but everything else expects the relationship's
        // properties to be merged into the file object, so do that
        _.each(items, function(item) {
          var merged = [];
          _.each(item._items, function(file) {
            var item = file.item;
            var relationship = file.relationship;
            _.extend(item, relationship);
            merged.push(item);
          });
          item._items = merged;
        });
        return callback(null);
      });
    };

    self.itemTypes = {
      richText: {
        markup: true,
        sanitize: function(item) {
          var sanitizeHtml = require('sanitize-html');
          item.content = sanitizeHtml(self.sanitizeString(item.content).trim(), self.options.sanitizeHtml);
        },
        // Used by apos.getAreaPlaintext. Should not be present unless this type
        // actually has an appropriate plaintext representation for the public
        // to view. Most widgets won't. This is distinct from diff and search, see below.
        getPlaintext: function(item, lines) {
          return self.htmlToPlaintext(item.content);
        },
        addDiffLines: function(item, lines) {
          // Turn tags into line breaks, which generally produces some indication
          // of a change around that point
          var text = self.htmlToPlaintext(item.content);
          self.addDiffLinesForText(text, lines);
        },
        addSearchTexts: function(item, texts) {
          // Turn tags into line breaks, which generally produces some indication
          // of a change around that point
          var text = self.htmlToPlaintext(item.content);
          texts.push({ weight: 1, text: text});
        },
        empty: function(item) {
          // This is a little bit expensive, but it is otherwise very difficult to spot
          // things like a placeholder empty div or solitary br generated by the rich text editor
          // that designers consider "empty"
          var text = self.htmlToPlaintext(item.content);
          return (!text.trim().length);
        },
        label: 'Text'
      },
      slideshow: {
        widget: true,
        label: 'Slideshow',
        icon: 'image',
        // icon: 'slideshow',
        sanitize: self.sanitizeSlideshow,
        render: function(data) {
          return self.partial('slideshow', data);
        },
        addDiffLines: function(item, lines) {
          var items = item._items || [];
          _.each(items, function(item) {
            lines.push('image: ' + item.name);
          });
        },
        addSearchTexts: function(item, texts) {
          var items = item._items || [];
          _.each(items, function(item) {
            texts.push({ weight: 1, text: item.name, silent: true });
          });
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        css: 'slideshow',
        // If these options are passed to the widget,
        // set them as JSON data attributes of the
        // widget element
        jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      buttons: {
        widget: true,
        label: 'Button(s)',
        icon: 'button',
        sanitize: self.sanitizeSlideshow,
        // icon: 'slideshow',
        render: function(data) {
          return self.partial('buttons', data);
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        css: 'buttons',
        // If these options are passed to the widget,
        // set them as JSON data attributes of the
        // widget element
        jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      marquee: {
        widget: true,
        label: 'Marquee',
        icon: 'slideshow',
        sanitize: self.sanitizeSlideshow,
        // icon: 'slideshow',
        render: function(data) {
          return self.partial('marquee', data);
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        css: 'marquee',
        // If these options are passed to the widget,
        // set them as JSON data attributes of the
        // widget element
        jsonOptions: [ 'delay', 'noHeight', 'widgetClass' ],
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      files: {
        widget: true,
        label: 'Files',
        icon: 'file',
        sanitize: self.sanitizeSlideshow,
        render: function(data) {
          var val = self.partial('files', data);
          return val;
        },
        addSearchTexts: function(item, texts) {
          var items = item._items || [];
          _.each(items, function(item) {
            texts.push({ weight: 1, text: item.name, silent: true });
          });
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        css: 'files',
        // If these options are passed to the widget,
        // set them as JSON data attributes of the
        // widget element
        jsonOptions: [ 'widgetClass' ],
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      video: {
        widget: true,
        label: 'Video',
        icon: 'video',
        render: function(data) {
          return self.partial('video', data);
        },
        addDiffLines: function(item, lines) {
          lines.push('video: ' + item.url);
        },
        css: 'video'
      },
      pullquote: {
        widget: true,
        label: 'Pullquote',
        plaintext: true,
        wrapper: 'span',
        icon: 'quote-left',
        // Without this it's bothersome for editor.js to grab the text
        // without accidentally grabbing the buttons. -Tom
        wrapperClass: 'apos-pullquote-text',
        content: true,
        contentSelector: '.apos-pullquote-text',
        css: 'pullquote',
        addDiffLines: function(item, lines) {
          lines.push('pullquote: ' + item.content || '');
        },
        addSearchTexts: function(item, texts) {
          texts.push({ weight: 1, text: item.content || ''});
        },
      },
      code: {
        widget: true,
        label: 'Code',
        // icon: 'code',
        plaintext: true,
        wrapper: 'pre',
        content: true,
        contentSelector: '.apos-pullquote-text',
        css: 'code',
        addDiffLines: function(item, lines) {
          self.addDiffLinesForText(item.content ? item.content : '', lines);
        },
        addSearchTexts: function(item, texts) {
          texts.push({ weight: 1, text: item.content || ''});
        },
      },
      html: {
        widget: true,
        label: 'HTML',
        icon: 'code',
        css: 'html',
        addDiffLines: function(item, lines) {
          self.addDiffLinesForText(item.content ? item.content : '', lines);
        },
        render: function(data) {
          return self.partial('html', data);
        }
      }
    };
  },
  init: function(self) {

    // Allows properties known about the widget on the server side to be
    // seen on the browser side

    self.pushGlobalData({
      widgetOptions: self.itemTypes
    });

    // Render an area editor ready to edit the area specified by
    // req.query.slug.

    self.app.get('/apos/edit-area', function(req, res) {
      try {
        var slug = req.query.slug;
        var options = req.query.options ? JSON.parse(req.query.options) : {};
        var area;
        var controls = options.controls || self.defaultControls;
        // For bc
        if (typeof(controls) === 'string') {
          controls = controls.split(' ');
        }
      } catch (e) {
        res.statusCode = 500;
        return res.send('bad arguments');
      }

      function getArea(callback) {
        self.getArea(req, slug, { editable: true }, function(err, areaArg) {
          if (!areaArg) {
            area = {
              slug: slug,
              items: [],
              isNew: true,
            };
          } else {
            area = areaArg;
            area.isNew = false;
          }
          return callback(err);
        });
      }

      function sendArea() {
        // A temporary id for the duration of the editing activity, useful
        // in the DOM. Areas are permanently identified by their slugs, not their IDs.
        area.wid = 'w-' + self.generateId();
        area.controls = controls;

        // Clone the control types so there is potential to override them
        // for this particular instance
        var controlTypes = {};
        extend(true, controlTypes, self.controlTypes);

        // Override the styles menu
        if (options.styles && self.controlTypes.style) {
          controlTypes.style.choices = options.styles;
        }
        area.controlTypes = controlTypes;
        area.itemTypes = self.itemTypes;
        area.standalone = true;
        area.editView = true;
        area.options = options;
        return self.render(res, 'editArea', area);
      }

      async.series([ getArea ], sendArea);

    });

    // Render an editor for a virtual area with the content
    // specified as a JSON array of items by the req.body.content
    // property, if any. For use when you are supplying your own storage
    // (for instance, the blog module uses this to render
    // an area editor for the content of a post).

    self.app.post('/apos/edit-virtual-area', function(req, res) {
      var content = req.body.content ? JSON.parse(req.body.content) : [];
      var options = req.body.options ? JSON.parse(req.body.options) : {};
      var controls = options.controls || self.defaultControls;
      // For bc
      if (typeof(controls) === 'string') {
        controls = controls.split(' ');
      }
      self.sanitizeItems(content);
      var area = {
        type: 'area',
        items: content
      };
      // A temporary id for the duration of the editing activity, useful
      // in the DOM. Regular areas are permanently identified by their slugs,
      // not their IDs. Virtual areas are identified as the implementation sees fit.
      var wid = 'w-' + self.generateId();

      if (!self.alwaysEditing) {
        // Clone the control types so there is potential to override them
        // for this particular instance
        var controlTypes = {};
        extend(true, controlTypes, self.controlTypes);

        // Override the styles menu
        if (options.styles && self.controlTypes.style) {
          controlTypes.style.choices = options.styles;
        }

        // Editors with explicit edit buttons render edit controls on demand
        area.controlTypes = controlTypes;
        area.controls = controls;
        area.itemTypes = self.itemTypes;
        area.options = options;
        area.options.editView = true;
        area.wid = wid;
        return self.render(res, 'editArea', area);
      } else {
        // "Always on" editors don't need a separate edit view,
        // just pass the virtual option to prevent things like the
        // slug and save attributes from appearing
        options.edit = true;
        options.virtual = true;
        options.controls = controls;
        options.styles = options.styles || self.controlTypes.style.choices;
        return self.render(res, 'area', { options: options, area: area, id: wid });
      }
    });

    // Render an editor for a virtual area with the content
    // specified as a JSON array of items by the req.body.content
    // property, if any (there will be 0 or 1 elements, any further
    // elements are ignored). For use when you are supplying your own storage
    // (for instance, the blog module uses this to render
    // a singleton thumbnail edit button for a post).

    self.app.post('/apos/edit-virtual-singleton', function(req, res) {
      var options = req.body.options ? JSON.parse(req.body.options) : {};
      var content = req.body.content ? JSON.parse(req.body.content) : [];
      self.sanitizeItems(content);
      var area = {
        type: 'area',
        items: content
      };
      var type = req.body.type;
      // A temporary id for the duration of the editing activity, useful
      // in the DOM. Regular areas are permanently identified by their slugs,
      // not their IDs. Virtual areas are identified as the implementation sees fit.
      area.wid = 'w-' + self.generateId();
      extend(options, _.omit(req.body, 'content', 'type'), true);
      options.type = type;
      options.area = area;
      options.edit = true;
      return res.send(self._aposLocals.aposSingleton(options));
    });

    self.app.post('/apos/edit-area', function(req, res) {
      var options = req.body.options ? JSON.parse(req.body.options) : {};
      var slug = req.body.slug;
      var content = JSON.parse(req.body.content);
      self.sanitizeItems(content);
      var area = {
        slug: slug,
        items: content,
        type: 'area'
      };
      self.putArea(req, slug, area, updated);
      function updated(err) {
        if (err) {
          console.log(err);
          return self.notfound(req, res);
        }

        return self.callLoadersForArea(req, area, function() {
          return res.send(self._aposLocals.aposAreaContent(area.items, options));
        });
      }
    });

    self.app.post('/apos/edit-singleton', function(req, res) {
      var slug = req.body.slug;
      var content = JSON.parse(req.body.content);
      var options = req.body.options ? JSON.parse(req.body.options) : {};
      // "OMG, what if they cheat and use a type not allowed for this singleton?"
      // When they refresh the page they will discover they can't see their hack.
      // aposSingleton only shows the first item of the specified type, regardless
      // of what is kicking around in the area.
      var type = content.type;
      var itemType = self.itemTypes[type];
      if (!itemType) {
        return self.fail(req, res);
      }
      if (itemType.sanitize) {
        itemType.sanitize(content);
      }
      var area = {
        slug: req.body.slug,
        items: [ content ],
        type: 'area'
      };

      self.putArea(req, slug, area, function(err, area) {
        if (err) {
          return self.notfound(req, res);
        }

        return self.callLoadersForArea(req, area, function() {
          var areaOptions = {};
          areaOptions[type] = options;
          return res.send(self._aposLocals.aposAreaContent(area.items, areaOptions));
        });
      });
    });

    // Used to render newly created, as yet unsaved widgets to be displayed in
    // the main apos editor. We're not really changing anything in the database
    // here. We're just allowing the browser to leverage the same normal view
    // generator that the server uses for actual page rendering. Renders the
    // body of the widget only since the widget div has already been updated
    // or created in the browser. Options may be passed to the widget
    // via the query string or via the _options POST parameter.


    self.app.post('/apos/render-widget', function(req, res) {
      var item = req.body;
      var options = {};
      extend(options, req.query, true);
      extend(options, req.body._options || {}, true);
      delete item._options;

      var itemType = self.itemTypes[item.type];
      if (!itemType) {
        res.statusCode = 404;
        return res.send('No such item type');
      }

      if (itemType.sanitize) {
        itemType.sanitize(item);
      }

      // Invoke server-side loader middleware like getArea or getPage would,
      // unless explicitly asked not to

      function go() {
        return res.send(self._aposLocals.aposItemNormalView(item, options));
      }

      // Always run the server side loader, it is only browser side
      // players that are potentially risky inside Jot. We need to
      // do things like joins here
      if (itemType.load) {
        return itemType.load(req, item, go);
      } else {
        return go();
      }
    });
  }
};
