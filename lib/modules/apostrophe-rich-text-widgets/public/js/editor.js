apos.define('apostrophe-rich-text-widgets-editor', {

  afterConstruct: function(self) {
    return self.start();
  },

  construct: function(self, options) {
    self.options = options;
    self.$widget = options.$widget;

    // Start contextual editing (on click for instance)

    self.start = function() {

      if (self.started || options.readOnly) {
        return;
      }

      self.$widget.trigger('aposRichTextStarting');

      self.$richText = self.$widget.find('[data-rich-text]:first');
      self.id = self.$richText.attr('id');
      if (!self.id) {
        // Must have one for ckeditor
        self.id = apos.utils.generateId();
        self.$richText.attr('id', self.id);
      }
      self.$richText.attr('contenteditable', 'true');

      // Support for ckeditor4 styles
      self.styles = self.options.styles || [];

      // Allow both universal A2 and ckeditor-specific controls in the toolbar.
      // Don't worry about widgets, those are presented separately.

      self.toolbar = self.options.toolbar || [];

      if (!self.defaultStyle) {
        if (self.options.defaultElement) {
          // eslint-disable-next-line new-cap
          self.defaultStyle = new CKEDITOR.style({
            element: self.options.defaultElement
          });
        } else if (self.styles.length) {
          var defaultStyle = _.find(self.styles, {
            name: self.options.defaultStyle
          });

          if (defaultStyle) {
            // eslint-disable-next-line new-cap
            self.defaultStyle = new CKEDITOR.style(defaultStyle);
          }
        }
      }

      // This will allow loading of extra plugins for each editor
      var extraPlugins = [ 'split' ];
      // Additional standard plugins can be configured
      // simply by name, third-party plugins need an
      // object with name and path properties
      _.each(options.plugins, function(plugin) {
        if (plugin.path) {
          // Make sure we don't have it already due to
          // another instance
          plugin = CKEDITOR.plugins.get(plugin.name) || plugin;
          if (plugin !== null) {
            CKEDITOR.plugins.addExternal(plugin.name, plugin.path);
          }
        }
        extraPlugins.push(plugin.name || plugin);
      });
      extraPlugins = extraPlugins.join(',');

      self.config = {
        extraPlugins: extraPlugins,
        toolbar: [ self.toolbar ],
        stylesSet: self.styles,
        on: {
          // TODO these event handlers should check whether the ckeditor ckeditorInstance
          // really belongs to apostrophe and play nice if not
          pluginsLoaded: function(evt) {
            var cmd = evt.editor.getCommand('table');
            // Don't allow table elements, properties and styles that
            // complicate responsive design
            cmd.allowedContent = 'table tr th td';
          },
          instanceReady: function(ck) {
            ck.editor.aposWidgetEditor = self;
          }
        }
      };

      if (!self.toolbar.length) {
        // We can't remove the toolbar because of:
        // https://github.com/ckeditor/ckeditor-dev/issues/654`
        // To avoid errors and a nonfunctional editor we have to put up
        // with an empty toolbar; it would be further progress to figure
        // out a way to at least hide it
        // self.config.removePlugins = 'toolbar';
      } else {
        // These are the buttons that we want to remove from CKEDITOR's default
        // config, but not if the developer has requested them
        var removeButtons = ['Underline', 'Subscript', 'Superscript'].filter(function(button) {
          return !_.includes(self.toolbar, button);
        });

        self.config.removeButtons = removeButtons.join(',');
      }

      self.beforeCkeditorInline();

      self.ckeditorInstance = CKEDITOR.inline(self.id, self.config);

      self.focus = false;

      self.ckeditorInstance.on('focus', function() {
        self.focus = true;
        self.setActive(true);
      });

      self.ckeditorInstance.on('blur', function() {
        self.focus = false;
        self.setActive(false);
      });

      self.ckeditorInstance.on('instanceReady', function(event) {
        self.ckeditorInstance.focus();

        if (self.ckeditorInstance.getData() === '') {
          if (self.defaultStyle) {
            self.ckeditorInstance.applyStyle(self.defaultStyle);
          }
        }

        self.$richText.data('aposRichTextState', 'started');
        self.$widget.trigger('aposRichTextStarted');
      });

      self.setActive(true);
      self.started = true;

    };

    // End contextual editing (on blur for instance)

    self.stop = function() {

      // make sure there is a blur event before
      // the destruction takes place
      var data = self.ckeditorInstance.getData();
      self.ckeditorInstance.focusManager.blur(true);
      self.ckeditorInstance.destroy();
      self.ckeditorInstance = null;
      self.$richText.removeAttr('contenteditable');
      self.$richText.html(data);
      self.$richText.data('aposRichTextState', undefined);
      self.$widget.trigger('aposRichTextStopped');
      self.started = false;
      self.setActive(false);
    };

    // Trigger `aposRichTextActive` or `aposRichTextInactive`
    // on the widget's DOM element and set or clear the
    // `apos-active` CSS class. Reflects what has already happened
    // at the ckeditor level, called on blur and focus events.
    // Does not start and stop editing, not to be called directly.

    self.setActive = function(state) {
      self.$widget.trigger(state ? 'aposRichTextActive' : 'aposRichTextInactive');
      return self.$widget.toggleClass('apos-active', state);
    };

    // A convenient override point just before
    // `self.id` and `self.config` are passed to
    // `CKEDITOR.inline` to launch editing
    self.beforeCkeditorInline = function() {
    };

  }
});
