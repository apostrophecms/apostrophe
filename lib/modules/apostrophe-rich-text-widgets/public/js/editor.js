apos.define('apostrophe-rich-text-editor', {

  afterConstruct: function(self) {
    return self.start();
  },

  construct: function(self, options) {
    self.options = options;
    self.$widget = options.$widget;

    self.start = function() {

      // Areas are interested because they want to stop
      // other editors in the same area first

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
      self.styles = self.options.styles;

      // Allow both universal A2 and ckeditor-specific controls in the toolbar.
      // Don't worry about widgets, those are presented separately.

      self.toolbar = self.options.toolbar || [];

      // This will allow loading of extra plugins for each editor
      var extraPlugins = [ 'split' ];
      // Additional standard plugins can be configured
      // simply by name, third-party plugins need an
      // object with name and path properties
      _.each(options.plugins, function(plugin) {
        if (plugin.path) {
          // Make sure we don't have it already due to
          // another instance
          var plugin = CKEDITOR.plugins.get(plugin.name);
          if (!plugin) {
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
            ck.editor.$a2Item = self.$richText.closest('[data-widget]');
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

      // Why is this necessary? Without it we don't get focus. If we don't use a timeout
      // focus is stolen back. As it is we still lose our place in the text. ):
      setTimeout(function() {
        // This should not be necessary, but without the &nbsp; we are unable to
        // focus on an "empty" rich text after first clicking away an then clicking back.
        // And without the call to focus() people have to double click for no
        // apparent reason
        if (self.$richText.html() === "" || self.$richText.html() === ' ') {
          self.$richText.html('<div>&nbsp;</div>');
        }
        self.ckeditorInstance.focus();
        self.$richText.data('aposRichTextState', 'started');
        self.$widget.trigger('aposRichTextStarted');
      }, 100);

      self.setActive(true);
      self.started = true;

    };

    self.stop = function() {

      // make sure there is a blur event before
      // the destruction takes place

      var data = self.ckeditorInstance.getData();
      self.ckeditorInstance.destroy();
      self.$richText.removeAttr('contenteditable');
      self.$richText.html(data);
      self.$richText.data('aposRichTextState', undefined);
      self.$widget.trigger('aposRichTextStopped');
      self.started = false;
      self.setActive(false);
    };

    self.setActive = function(state) {
      return self.$widget.toggleClass('apos-active', state);
    };

    self.beforeCkeditorInline = function() {
    };

  }
});
