/* global rangy, $, _ */
/* global alert, prompt, apos */

// @class A base class for all widget editors, such as slideshow, video, etc.
// Integrates with AposEditor for inclusion in an area. Also invoked directly
// for singleton (standalone) widgets. You must call init() after constructing
// the object in order to actually launch the modal for the widget. This
// two-stage construction makes subclassing simpler.

function AposWidgetEditor(options) {
  var self = this;
  self.editor = options.editor;
  self.timers = [];
  self.exists = false;

  // What will be in the data attributes of the widget
  self.data = {};

  // Figure out our existing properties from our DOM attributes
  if (options.$widget) {
    // AposEditor2 just passes us a jQuery element
    self.$widget = options.$widget;
  } else if (options.widgetId) {
    // AposEditor classic insists on making us drive
    self.$widget = options.editor.$editable.find('.apos-widget[data-id="' + options.widgetId + '"]');
  }
  if (self.$widget) {
    self.data = apos.getWidgetData(self.$widget);
  }

  // When displayed as a singleton or an area that does not involve a
  // rich text editor as the larger context for all widgets, our data is passed in
  if (options.data) {
    self.data = options.data;
  }

  self.data.type = self.type;

  if (self.data.id) {
    self.exists = true;
  }

  if (!self.data.id) {
    self.data.id = apos.generateId();
  }

  // Careful, relevant only when we are in a rich text editor context
  if (self.editor && self.editor.$editable) {
    // Make sure the selection we return to
    // is actually on the editor
    self.editor.$editable.focus();
  }

  // Invoked after the widget is dismissed. By default this method cleans up interval timers.
  self.afterHide = function(callback) {
    _.map(self.timers, function(timer) { clearInterval(timer); });
    return callback(null);
  };

  // Invoked before the widget is dismissed. Can be overridden to force the user to confirm.
  self.beforeCancel = function(callback) {
    return callback();
  };

  // Create a new widget for insertion into the main content editor.
  // See also the server-side itemNormalView.html template, which
  // does the same thing
  self.createWidget = function() {
    if (!self.editor) {
      return;
    }
    self.$widget = $('<div></div>');
    // self.$widget.attr('unselectable', 'on');
    self.$widget.addClass('apos-widget');
    self.$widget.addClass('apos-' + self.type);
    self.$widget.attr('data-type', self.type);
  };

  // Update the widget placeholder in the main content editor, then ask the server
  // to render the widget placeholder. We *don't* call the widget player inside
  // the main content editor because those are not restricted to content that
  // behaves inside contentEditable.

  self.updateWidget = function(callback) {
    if (!self.editor) {
      return callback(null);
    }
    // When we update the widget placeholder we also clear its
    // markup and call populateWidget to insert the latest
    self.$widget.html('');
    self.editor.addButtonsToWidget(self.$widget);
    self.updateWidgetData();
    self.renderWidget(callback);
  };

  // Update the widget's data attributes. The main `data` attribute receives a JSON representation
  // of self.data. The id and the type are also available as `data-id` and `data-type`. Typically
  // no need to override this.
  self.updateWidgetData = function() {
    if (!self.editor) {
      return;
    }
    self.$widget.attr('data', apos.jsonAttribute(self.data));
    // These need to be visible separately
    self.$widget.attr('data-id', self.data.id);
    self.$widget.attr('data-type', self.data.type);
  };

  // Ask the server to render the widget's contents and stuff them into `self.$widget`, which is
  // the placeholder element in the main content editor for this widget.
  self.renderWidget = function(callback) {
    if (!self.editor) {
      return callback(null);
    }
    var info = apos.getWidgetData(self.$widget);

    // Some widgets have content - markup that goes inside the widget
    // that was actually written by the user and can't be generated
    // dynamically. Examples: pullquotes, code samples
    if (self.getContent) {
      info.content = self.getContent();
    } else {
      info.content = undefined;
    }

    // Ask the server to generate a nice rendering of the widget's contents
    // for us, via its normal view renderer. This avoids code duplication
    // and an inevitable drift into different behavior between browser
    // and server. At some point perhaps we'll run the same rendering code
    // on both client and server
    info._options = options.options || {};
    // Transmit the data as JSON so objects with
    // property names that look like numbers don't get
    // converted into flat arrays
    return $.ajax({
      type: 'POST',
      url: '/apos/render-widget?bodyOnly=1&editView=1',
      processData: false,
      contentType: 'application/json',
      data: JSON.stringify(info),
      dataType: 'html',
      success: function(html) {
        self.$widget.append(html);
        if (apos.widgetPlayers[self.type]) {
          apos.widgetPlayers[self.type](self.$widget);
        }
        return callback(null);
      }
    });
  };

  // Decorate self.$widget, the widget's element in the main content editor, with suitable attributes for a brand new widget.
  self.insertWidget = function() {
    if (!self.editor) {
      return;
    }
    self.editor.insertWidget(self.$widget);
  };

  // Populate self.$previewContainer with a preview of the widget's appearance. Used to
  // preview widgets while the widget editor modal is displayed.
  self.preview = function() {

    function go() {
      self.$previewContainer.find('.apos-widget-preview').remove();
      if (self.exists) {
        // Ask the server to generate a nice preview of the widget's contents
        // for us, via its normal view renderer. This avoids code duplication
        // and an inevitable drift into different behavior between browser
        // and server. At some point perhaps we'll run the same rendering code
        // on both client and server... if it matters, Node is terribly fast
        var info = {};
        _.defaults(info, self.data);
        // Comes in from self.data and breaks serialization ):
        delete info['uiResizable'];
        info.type = self.type;
        info.size = 'full';
        info.position = 'center';
        if (self.getContent) {
          info.content = self.getContent();
        } else {
          info.content = undefined;
        }
        info._options = options.options || {};
        $.post('/apos/render-widget', info, function(html) {
          // jQuery 1.9+ is super fussy about constructing elements from html
          // more explicitly. Trim the markup so we don't wind up with a
          // text node instead of a widget due to whitespace, sigh
          var previewWidget = $($.parseHTML($.trim(html)));
          previewWidget.addClass('apos-widget-preview');
          self.$previewContainer.prepend(previewWidget);
          self.$el.find('.apos-requires-preview').show();
          if (apos.widgetPlayers[self.type]) {
            apos.widgetPlayers[self.type](previewWidget);
          }
        });
      }
      else
      {
        self.$el.find('.apos-requires-preview').hide();
      }
    }

    if (self.prePreview) {
      self.prePreview(go);
    } else {
      go();
    }
  };

  // Override if you need to carry out an action such
  // as fetching video metadata from YouTube before the save can
  // take place. Takes a callback which completes the
  // save operation, or gracefully refuses it if
  // self.exists has not been set to true. (This is not the only place
  // you can set self.exists to true, and it is already true for a
  // pre-existing widget.)
  self.preSave = function(callback) {
    callback();
  };

  self.init = function() {
      // Use apos.modalFromTemplate to manage our lifecycle as a modal

    self.$el = apos.modalFromTemplate(options.template, {
      init: function(callback) {
        self.$previewContainer = self.$el.find('.apos-widget-preview-container');

        // Allow afterCreatingEl to optionally take a callback
        var after;
        if (self.afterCreatingEl) {
          if (self.afterCreatingEl.length === 1) {
            after = self.afterCreatingEl;
          } else {
            after = function(callback) {
              self.afterCreatingEl();
              return apos.afterYield(callback);
            };
          }
        } else {
          after = function(callback) {
            return apos.afterYield(callback);
          };
        }

        return after(function() {
          self.$el.find('[data-preview]').click(function() {
            self.preview();
            return false;
          });

          self.preview();
          return callback(null);
        });
      },

      save: function(callback) {
        self.preSave(function() {
          if (!self.exists) {
            alert(options.messages.missing);
            return callback('error');
          }
          if (self.editor) {
            if (self.editor.undoPoint) {
              self.editor.undoPoint();
            }
            var _new = false;
            if (!self.$widget) {
              self.createWidget();
              _new = true;
            }
          }
          self.updateWidget(function(err) {
            if (_new) {
              self.insertWidget();
              // apos.hint('What are the arrows for?', "<p>They are there to show you where to add other content before and after your rich content.</p><p>Always type text before or after the arrows, never between them.</p><p>This is especially helpful when you are floating content next to text.</p><p>You can click your rich content to select it along with its arrows, then cut, copy or paste as usual.</p><p>Don\'t worry, the arrows automatically disappear when you save your work.</p>");
            }
            // Widget backups are probably a bad idea since they would defeat
            // copy and paste between pages or at least sites
            // self.editor.updateWidgetBackup(self.widgetId, self.$widget);

            if (options.save) {
              // Used to implement save for singletons and non-rich-text-based areas.
              // Note that in this case options.data was passed in by reference,
              // so the end result can be read there. Pay attention to the callback so
              // we can allow the user a second chance
              options.save(function(err) {
                return callback(err);
              });
            } else {
              return callback(null);
            }
          });
        });
      },

      afterHide: function(callback) {
        // Support legacy afterHide methods with no callback
        if (!self.afterHide.length) {
          self.afterHide();
          return callback(null);
        } else {
          return self.afterHide(callback);
        }
      },

      beforeCancel: function(callback) {
        return self.beforeCancel(callback);
      }
    });
  };
}

