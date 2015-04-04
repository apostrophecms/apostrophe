apos.define('apostrophe-areas', {
  afterConstruct: function(self) {
    self.enableSingletons();
  },
  construct: function(self, options) {
    self.options = options;
    self.enableSingletons = function() {
      $('body').on('click', '[data-edit-singleton]', function() {
        var $singleton = $(this).closest('[data-singleton]');
        var options = JSON.parse($singleton.attr('data-options'));
        var docId = $singleton.attr('data-doc-id');
        var dotPath = $singleton.attr('data-dot-path');
        var $item = $singleton.find('[data-widget]:first');
        var data;

        if ($item.length) {
          data = JSON.parse($singleton.attr('data'));
        }

        var editor = apos.create(options.type + '-widget-editor', {
          data: data,
          save: function(callback) {
            if (docId) {
              // Has a docId, save it
              $.jsonCall(self.options.action + '/save-singleton',
                {
                  dataType: 'html',
                },
                {
                  docId: docId,
                  dotPath: dotPath,
                  options: options,
                  data: editor.getData()
                },
                function(markup) {
                  var $wrapper = $singleton.find('[data-widget-wrapper]');
                  $wrapper.html('');
                  $wrapper.append(markup);
                  apos.emit('enhance', $wrapper);
                  return callback(null);
                },
                function() {
                  alert(self.options.messages.tryAgain);
                  return callback('error');
                }
              );
            } else {
              // Virtual singletons must be saved in other ways. Add it as a
              // data attribute of the singleton, and post an event
              $singleton.attr('data-item', JSON.stringify(itemData));
              $singleton.trigger('aposEdited', itemData);
              return callback();
            }
          },
          // Options passed from the template or other environment
          options: $singleton.data('options')
        });
        return false;
      });
      $('body').on('click', '[data-page-versions]', function() {
        var slug = $(this).attr('data-page-versions');
        aposPages.browseVersions({ slug: slug });
        return false;
      });

    };
  }
});
