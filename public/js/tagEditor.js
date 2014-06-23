/* global apos, _, alert, confirm */

function AposTagEditor(options) {
  var self = this;
  if (!options) {
    options = {};
  }

  // PUBLIC API

  // Call this method after constructing the object
  self.modal = function() {
    self.$el = apos.modalFromTemplate(options.template || '.apos-tag-editor', self);
  };

  // MODAL CALLBACKS

  self.init = function(callback) {
    self.$tags = self.$el.find('[data-tags]');
    $.getJSON(options.browseUrl || '/apos/tags', function(data) {
      if (!data.tags) {
        alert('An error occurred.');
        return callback('error');
      }
      self.$tagTemplate = self.$el.find('[data-tag]');
      _.each(data.tags, function(tag) {
        var $tag = apos.fromTemplate(self.$tagTemplate);
        $tag.find('[data-tag-text]').text(tag);
        self.$tags.find('tr:last').after($tag);
      });
    });
    self.$el.on('click', '[data-rename-open]', function() {
      var $tag = $(this).closest('[data-tag]');
      $tag.find('[data-rename-open]').hide();
      var text = $tag.find('[data-tag-text]').text();
      var $renameForm = $tag.find('[data-rename-form]');
      var $name = $renameForm.find('[name="name"]');
      $name.val(text);
      $name.focus();
      $renameForm.show();
      return false;
    });
    self.$el.on('click', '[data-rename-go]', function() {
      var $tag = $(this).closest('[data-tag]');
      var $text = $tag.find('[data-tag-text]');
      var text = $text.text();
      var $renameForm = $tag.find('[data-rename-form]');
      var newTag = $renameForm.find('[name="name"]').val();
      if (newTag === text) {
        // No change
        $renameForm.hide();
        $tag.find('[data-rename-open]').show();
      } else {
        $.jsonCall(options.renameUrl || '/apos/rename-tag', {
          tag: text,
          newTag: newTag
        }, function(result) {
          if (result.status === 'ok') {
            // Mop up on merge - remove any duplicate
            self.$el.find('[data-tag]').each(function() {
              var $tag = $(this);
              var $text = $tag.find('[data-tag-text]');
              var text = $text.text();
              if (text === newTag) {
                $tag.remove();
              }
            });
            $text.text(newTag);
            $renameForm.hide();
            $tag.find('[data-rename-open]').show();
          } else {
            alert('An error occurred.');
          }
        });
      }
      return false;
    });

    self.$el.on('click', '[data-rename-cancel]', function() {
      var $tag = $(this).closest('[data-tag]');
      $tag.find('[data-rename-form]').hide();
      $tag.find('[data-rename-open]').show();
      return false;
    });

    self.$el.on('click', '[data-delete]', function() {
      var $tag = $(this).closest('[data-tag]');
      var $text = $tag.find('[data-tag-text]');
      var text = $text.text();
      if (confirm('Are you sure you want to completely remove the tag ' + text + '? This cannot be undone!')) {
        $.jsonCall(options.deleteUrl || '/apos/delete-tag', {
          tag: text
        }, function(result) {
          if (result.status === 'ok') {
            $tag.remove();
          } else {
            alert('An error occurred.');
          }
        });
      }
      return false;
    });

    return callback(null);
  };
}

