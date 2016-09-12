var path = require('path');
var extend = require('extend');
var _ = require('lodash');
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
    self.defaultControls = [ 'style', 'bold', 'italic', 'createLink', 'unlink', 'insertUnorderedList', 'insertTable', 'slideshow', 'buttons', 'video', 'files', 'embed', 'pullquote', 'html' ];

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

    self.sanitizeItems = function(req, items, callback)
    {
      var results = [];
      async.eachSeries(items, function(item, callback) {
        var itemType = self.itemTypes[item.type];
        if (!itemType) {
          // We don't know what this is, just preserve it
          results.push(item);
          return setImmediate(callback);
        }
        // Widget has no sanitizer (tsk)
        if (!itemType.sanitize) {
          results.push(item);
          return setImmediate(callback);
        }
        // Simple, synchronous sanitizer that
        // modifies in place
        if (itemType.sanitize.length === 1) {
          itemType.sanitize(item);
          results.push(item);
          return setImmediate(callback);
        }
        // Modern async sanitizer
        return itemType.sanitize(req, item, function(err, _item) {
          if (err) {
            return callback(err);
          }
          // Sanitizer isn't responsible for the type field or
          // the lockup field
          _item.type = item.type;
          if (item.lockup && _.has(self.lockups, item.lockup)) {
            _item.lockup = item.lockup;
          }
          results.push(_item);
          return callback(null);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, results);
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
          hyperlinkTitle: self.sanitizeString(extra.hyperlinkTitle, undefined),
          hyperlinkTarget: self.sanitizeBoolean(extra.hyperlinkTarget)
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
        return setImmediate(callback);
      }
      // We're loading a page and we want to defer all of the slideshow joins
      // until we know about all of them and can do a single efficient mongo query
      if (req.deferredLoads) {
        if (!req.deferredLoads.slideshows) {
          req.deferredLoads.slideshows = [];
          req.deferredLoaders.slideshows = self.joinSlideshows;
        }
        req.deferredLoads.slideshows.push(item);
        return setImmediate(callback);
      }

      // Nope, we're doing it now
      return self.joinSlideshows(req, [ item ], callback);
    };

    // Join an array of slideshow widgets to their files in one fell swoop,
    // using joinr and some glue code. Used by self.loadSlideshow and also by
    // the deferredLoads mechanism which greatly speeds up slideshow loading
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
        // properties to be merged into the file object, so do that. However we still
        // need to make a new object for each _item because joinr does its best to
        // share objects, but we're merging in placement-specific properties.
        _.each(items, function(item) {
          var merged = [];
          _.each(item._items, function(file) {
            var _item = {};
            extend(true, _item, file.item);
            extend(true, _item, file.relationship);
            merged.push(_item);
          });
          item._items = merged;
        });
        return callback(null);
      });
    };

    self.itemTypes = {
      richText: {
        markup: true,
        icon: 'icon-align-left',
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
        getRichtext: function(item, lines) {
          return item.content;
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
        // per F&M training with Ilyssa and Rachel,
        // "slideshow" is super baffling and invisible when
        // you are thinking about adding one image. Solve it
        // the same way we did for apostrophenow.com. -Tom, Joel & Ilyssa
        label: 'Image(s)',
        icon: 'icon-image',
        // icon: 'slideshow',
        sanitize: self.sanitizeSlideshow,
        renderWidget: function(data) {
          return self.partial('slideshow', data);
        },
        addDiffLines: function(item, lines) {
          // Diff runs without the benefit of loaders for speed, so
          // don't refer to anything we won't know
          lines.push('slideshow: images selected: ' + ((item.ids && item.ids.length) || 0));
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
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      buttons: {
        widget: true,
        label: 'Button(s)',
        icon: 'icon-button',
        sanitize: self.sanitizeSlideshow,
        // icon: 'slideshow',
        renderWidget: function(data) {
          return self.partial('buttons', data);
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        css: 'buttons',
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      marquee: {
        widget: true,
        label: 'Marquee',
        icon: 'icon-slideshow',
        sanitize: self.sanitizeSlideshow,
        // icon: 'slideshow',
        renderWidget: function(data) {
          return self.partial('marquee', data);
        },
        empty: function(item) {
          return !((item._items || []).length);
        },
        addDiffLines: function(item, lines) {
          // Diff runs without the benefit of loaders for speed, so
          // don't refer to anything we won't know
          lines.push('marquee: images selected: ' + ((item.ids && item.ids.length) || 0));
        },
        css: 'marquee',
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      files: {
        widget: true,
        label: 'Files',
        icon: 'icon-file',
        sanitize: self.sanitizeSlideshow,
        renderWidget: function(data) {
          var val = self.partial('files', data);
          return val;
        },
        addDiffLines: function(item, lines) {
          // Diff runs without the benefit of loaders for speed, so
          // don't refer to anything we won't know
          lines.push('files selected: ' + ((item.ids && item.ids.length) || 0));
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
        jsonProperties: [ '_items' ],
        load: function(req, item, callback) {
          return self.loadSlideshow(req, item, callback);
        }
      },
      video: {
        widget: true,
        label: 'Video',
        icon: 'icon-video',
        renderWidget: function(data) {
          return self.partial('video', data);
        },
        addDiffLines: function(item, lines) {
          lines.push('video: ' + item.url);
        },
        css: 'video',
        oembedType: 'video',
        jsonConfiguration: [ 'oembedType' ]
      },
      embed: {
        widget: true,
        label: 'Embed',
        icon: 'icon-beaker',
        renderWidget: function(data) {
          return self.partial('embed', data);
        },
        addDiffLines: function(item, lines) {
          lines.push('embed: ' + item.url);
        },
        css: 'embed',
        oembedNotType: 'video',
        jsonConfiguration: [ 'oembedNotType' ]
      },
      pullquote: {
        widget: true,
        label: 'Pullquote',
        plaintext: true,
        wrapper: 'span',
        icon: 'icon-quote-left',
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
        icon: 'icon-code',
        css: 'html',
        addDiffLines: function(item, lines) {
          self.addDiffLinesForText(item.content ? item.content : '', lines);
        },
        renderWidget: function(data) {
          return self.partial('html', data);
        }
      }
    };

    // Register a new widget type's manager object on the server side
    self.addWidgetType = function(name, type) {
      self.itemTypes[name] = type;
    };

    // Returns a JSON representation of the information about this type that is suitable for
    // transmission to the browser
    self.jsonItemType = function(type) {
      return _.pick(type, [ 'widget', 'label', 'icon', 'markup', 'css', 'content', 'contentSelector' ].concat(type.jsonConfiguration || []));
    };
  },
  init: function(self) {
    // Make the widget's configuration known on the browser side,
    // without sending too much data or circular structures
    var data = {};
    _.each(self.itemTypes, function(type, name) {
      data[name] = self.jsonItemType(type);
    });
    self.pushGlobalData({
      widgetOptions: data
    });

    // Render an editor for a virtual area with the content
    // specified as an array of items by the req.body.content
    // property, if any. For use when you are supplying your own storage
    // (for instance, the blog module uses this to render
    // an area editor for the content of a post).

    self.app.post('/apos/edit-virtual-area', function(req, res) {
      var content = req.body.content || [];
      var options = req.body.options || {};
      var controls = options.controls || self.defaultControls;
      // For bc
      if (typeof(controls) === 'string') {
        controls = controls.split(' ');
      }
      return self.sanitizeItems(req, content, function(err, items) {
        var area = {
          type: 'area',
          items: items
        };
        // A temporary id for the duration of the editing activity, useful
        // in the DOM. Regular areas are permanently identified by their slugs,
        // not their IDs. Virtual areas are identified as the implementation sees fit.
        var wid = 'w-' + self.generateId();

        // "Always on" editors don't need a separate edit view,
        // just pass the virtual option to prevent things like the
        // slug and save attributes from appearing
        options.edit = true;
        options.virtual = true;
        options.controls = controls;
        options.styles = options.styles || self.controlTypes.style.choices;
        return self.render(req, res, 'area', { options: options, area: area, id: wid });
      });
    });

    // Render an editor for a virtual area with the content
    // specified as a JSON array of items by the req.body.content
    // property, if any (there will be 0 or 1 elements, any further
    // elements are ignored). For use when you are supplying your own storage
    // (for instance, the blog module uses this to render
    // a singleton thumbnail edit button for a post).

    self.app.post('/apos/edit-virtual-singleton', function(req, res) {
      var options = req.body.options || {};
      var content = req.body.content || [];
      return self.sanitizeItems(req, content, function(err, items) {
        var area = {
          type: 'area',
          items: items
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
        // Must do this before directly invoking an apos* that might render a partial
        self.initI18nLocal(req);
        return res.send(self._aposLocals.aposSingleton(options));
      });
    });

    self.app.post('/apos/edit-area', function(req, res) {
      var options = req.body.options;
      var slug = req.body.slug;
      var content = req.body.content;
      var items;
      var area;
      return async.series({
        sanitize: function(callback) {
          return self.sanitizeItems(req, content, function(err, _items) {
            if (err) {
              return callback(err);
            }
            items = _items;
            return callback(null);
          });
        },
        put: function(callback) {
          area = {
            slug: slug,
            items: items,
            type: 'area'
          };
          return self.putArea(req, slug, area, callback);
        },
        load: function(callback) {
          return self.callLoadersForArea(req, area, callback);
        }
      }, function(err) {
        if (err) {
          console.error('error occurred in edit-area');
          console.error(err);
          return self.notfound(req, res);
        }
        // Must do this before directly invoking an apos* that might render a partial
        self.initI18nLocal(req);
        return res.send(self._aposLocals.aposAreaContent(area.items, options));
      });
    });

    self.app.post('/apos/edit-singleton', function(req, res) {
      var slug = req.body.slug;
      var content = req.body.content;
      var options = req.body.options;

      // "OMG, what if they cheat and use a type not allowed for this singleton?"
      // When they refresh the page they will discover they can't see their hack.
      // aposSingleton only shows the first item of the specified type, regardless
      // of what is kicking around in the database.
      var type = content.type;
      var itemType = self.itemTypes[type];
      var area;

      if (!itemType) {
        return self.fail(req, res);
      }

      return async.series({
        sanitize: function(callback) {
          return self.sanitizeItems(req, [ content ], function(err, items) {
            if (err) {
              return callback(err);
            }
            if (!items.length) {
              return callback(new Error('notfound'));
            }
            area = {
              slug: req.body.slug,
              items: items,
              type: 'area'
            };
            return callback(null);
          });
        },
        put: function(callback) {
          return self.putArea(req, slug, area, callback);
        },
        load: function(callback) {
          return self.callLoadersForArea(req, area, callback);
        }
      }, function(err) {
        if (err) {
          console.error('error occurred in edit-singleton');
          console.error(err);
          return self.notfound(req, res);
        }

        var areaOptions = {};
        areaOptions[type] = options;
        // Must do this before directly invoking an apos* that might render a partial
        self.initI18nLocal(req);
        return res.send(self._aposLocals.aposAreaContent(area.items, areaOptions));
      });
    });

    // Used to render newly created, as yet unsaved widgets to be displayed in
    // the main apos editor. We're not really changing anything in the database
    // here. We're just allowing the browser to leverage the same normal view
    // generator that the server uses for actual page rendering. Renders the
    // body of the widget only since the widget div has already been updated
    // or created in the browser. Options may be passed to the widget
    // via the _options property, or via the query string. The query string
    // wins.

    self.app.post('/apos/render-widget', function(req, res) {
      var item = req.body;
      var options = {};
      extend(options, req.body._options || {}, true);
      extend(options, req.query || {}, true);
      delete item._options;

      var itemType = self.itemTypes[item.type];
      if (!itemType) {
        res.statusCode = 404;
        return res.send('No such item type');
      }

      return async.series({
        sanitize: function(callback) {
          return self.sanitizeItems(req, [ item ], function(err, items) {
            if (err) {
              return callback(err);
            }
            if (!items.length) {
              return callback(new Error('notfound'));
            }
            item = items[0];
            return callback(null);
          });
        },
        load: function(callback) {
          if (!itemType.load) {
            return callback(null);
          }
          return itemType.load(req, item, callback);
        },
        loadWidgets: function(callback) {
          // Schema widget loaders invoke joins but do not
          // invoke the loaders of areas and singletons, because
          // that would be redundant; those are all invoked
          // by callLoadersForPage when a page has been
          // fully fetched.
          //
          // However, when we're previewing a widget or adding
          // it to the page, we need to be able to correctly
          // render a schema widget all by itself.
          //
          // So as a second loading pass, we invoke loaders
          // for other widgets in the data properties of this
          // widget exactly as a page would.
          //
          // We do it here, rather than in the schema widget
          // loader, because here we know we're at the end of
          // the process and avoiding redundant invocations.
          // This also benefits any other widgets besides
          // our official schema widget that may contain areas
          // in their data. -Tom

          return self.callLoadersForPage(
            req,
            {
              _id: self.generateId(),
              widget: item
            }, callback
          );
        }
      }, function(err) {
        if (err) {
          return self.notfound(req, res);
        }
        self.initI18nLocal(req);
        return res.send(self._aposLocals.aposItemNormalView(item, options));
      });
    });
  }
};
