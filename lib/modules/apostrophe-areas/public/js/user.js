apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    return async.series({
      getTemplates: function(callback) {
        return self.getTemplates(callback);
      }
    }, function(err) {
      self.enableCkeditor();
      self.enableOnEnhance();
      self.enableShift();
      // the enhance event already happened while
      // we were waiting for our templates, so call
      // this ourselves
      self.enableAll();
    });
  },

  construct: function(self, options) {

    // The area editor has a number of DOM templates that
    // it clones as needed. We don't push DOM templates with
    // every page anymore, so fetch them and append them
    // to the DOM now. This is pretty much the only place
    // we still use this technique heavily.

    self.getTemplates = function(callback) {
      $.post(self.options.action + '/editor',
        function(markup) {
          $('body').append(markup);
          return setImmediate(callback);
        }
      );
    };

    self.fromTemplate = function(sel) {
      // console.log($('[data-area-editor-templates]').find(sel));
      return $('[data-area-editor-templates]').find(sel).clone();
    };

    self.enableCkeditor = function() {

      // Automatic inline use of ckeditor is not suitable as it can't handle AJAX,
      // making it unsuitable for our uses, and it interferes with explicit
      // ckeditor instantiation, the only workaround for the AJAX problem.
      //
      // So we have to globally shut this off if we are active at all. If you wish
      // to make direct use of ckeditor you must do it explicitly with
      // CKEDITOR.inline(id) like we do. Hey, it's not our fault.

      CKEDITOR.disableAutoInline = true;

      // This clears the auto-populated Title attribute CKEditor puts on stuff, makes for ugly tooltips

      CKEDITOR.on('instanceReady',function(event){
        $(event.editor.element.$).attr('title', '');
      });

      CKEDITOR.plugins.addExternal('split', apos.prefix + self.options.action + '/js/ckeditorPlugins/split/', 'plugin.js');

      // This particular plugin has proven difficult for our users and therefore,
      // we're removing it for now. --Joel (joel@punkave.com)
      CKEDITOR.config.removePlugins = 'magicline';
    };

    self.enableOnEnhance = function() {
      apos.on('enhance', function($context) {
        self.enableAll($context);
      });
    };

    self.enableAll = function(sel) {
      if (!sel) {
        sel = 'body';
      }
      $(sel).find('[data-area]').each(function() {
        var $el = $(this);
        if ($el.attr('data-initialized')) {
          return;
        }
        var instance = apos.create('apostrophe-area-editor', { $el: $el, action: self.options.action });
      });
    };

    self.enableShift = function() {

      // listen for shiftActive for power up/down nudge
      apos.on('shiftDown', function() {
        $('[data-move-item]').each(function() {
          $self = $(this);
          if ($self.attr('data-move-item') === 'up') {
            $self.children('i').toggleClass('icon-double-angle-up');
            $self.attr('data-move-item', 'top');
          } else if ($self.attr('data-move-item') === 'down') {
            $self.children('i').toggleClass('icon-double-angle-down');
            $self.attr('data-move-item', 'bottom');
          }
        });
      });

      apos.on('shiftUp', function() {
        $('[data-move-item]').each(function() {
          $self = $(this);
          $self.children('i').removeClass('icon-double-angle-up');
          $self.children('i').removeClass('icon-double-angle-down');
          if ($self.attr('data-move-item') === 'top') {
            $self.attr('data-move-item', 'up');
          } else if ($self.attr('data-move-item') === 'bottom') {
            $self.attr('data-move-item', 'down');
          }
        });
      });
    };
  }
});
