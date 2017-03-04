apos.define('apostrophe-rich-text-widgets-editor', {

  afterConstruct: function(self) {
    return self.start();
  },

  construct: function(self, options) {
    self.options = options;
    self.$widget = options.$widget;

    // Start contextual editing (on click for instance)

    self.start = function() {

      if (self.started) {
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

      if (self.options.defaultElement) {
        self.defaultElement = self.options.defaultElement;
      } else if (self.styles.length) {
        self.defaultElement = self.styles[0].element;
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
          var plugin = CKEDITOR.plugins.get(plugin.name) || plugin;
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
          ckeditorInstanceReady: function(ck) {
            ck.editor.a2Area = self;
            ck.editor.$a2Item = self.$richText.closest('[data-apos-widget]');
            ck.editor.removeMenuItem('tablecellproperties');
          }
        }
      };

      if (!self.toolbar.length) {
        self.config.removePlugins = 'toolbar';
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
        // This should not be necessary, but without the &nbsp; we are unable to
        // focus on an "empty" rich text after first clicking away an then clicking back.
        // And without the call to focus() people have to double click for no
        // apparent reason
        if (self.$richText.html() === "" || self.$richText.html() === ' ') {
          var emptyState = '<' + (self.defaultElement || 'div') + '>&nbsp;</' + (self.defaultElement || 'div') + '>';
          self.$richText.html(emptyState);
        }
        self.ckeditorInstance.focus();
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
