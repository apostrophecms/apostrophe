apos.define('apostrophe-video-fields', {

  afterConstruct: function(self) {
    self.addFieldType();
    self.debouncePreview();
  },

  construct: function(self, options) {
    self.name = options.name;
    self.oembedType = options.oembedType;

    self.addFieldType = function() {
      apos.schemas.addFieldType({
        name: self.name,
        populate: self.populate,
        convert: self.convert
      });
    };

    self.populate = function(object, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      $field.on('textchange', function() {
        self.preview($fieldset, { url: $field.val() }, field);
      });
      $field.val(object[name] && object[name].url);
      self.preview($fieldset, object[name], field);
      return setImmediate(callback);
    };

    self.convert = function(data, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      if ($fieldset.data('busy')) {
        // If preview is in progress keep calling back until preview
        // completes. It's essential because the preview also validates the oembed type.
        setTimeout(function() {
          return self.convert(data, name, $field, $el, field, callback);
        }, 100);
        return;
      }
      if (!$fieldset.data('valid')) {
        return setImmediate(_.partial(callback, 'invalid'));
      }
      var $player = $fieldset.find('[data-apos-video-player]');
      data[name] = {
        url: $field.val(),
        title: $player.data('title'),
        thumbnail: $player.data('thumbnail')
      };
      if (field.required && (!data[name])) {
        return setImmediate(_.partial(callback, 'required'));
      }
      return setImmediate(callback);
    };

    // Preview the given value. Also acts as a validator by updating
    // the `valid` jquery data attribute of the fieldset to true or false
    // after it clears the `busy` attribute.

    self.preview = function($fieldset, value, field) {
      $fieldset.data('busy', true);
      $fieldset.find('[data-apos-video-error]').hide();
      return apos.oembed.queryAndPlay(
        $fieldset.find('[data-apos-video-player]'),
        {
          url: value && value.url,
          type: self.oembedType,
          neverOpenGraph: (self.oembedType === 'video') ? 1 : undefined
        }, function(err, result) {
          if (err) {
            $fieldset.find('[data-apos-video-error="' + err + '"]').show();
            $fieldset.data('busy', false);
            $fieldset.data('valid', false);
            return;
          }
          $fieldset.data('busy', false);
          $fieldset.data('valid', true);
        });
    };

    self.debouncePreview = function() {
      // If already in progress, try again in 250ms
      var superPreview = self.preview;
      self.preview = function($fieldset, value, field) {
        if ($fieldset.data('busy')) {
          return setTimeout(function() {
            self.preview($fieldset, value, field);
          }, 250);
        }
        superPreview($fieldset, value, field);
      };
      // Debounce requests. A pity _.debounce isn't async
      self.preview = _.debounce(self.preview, 250, { leading: false, trailing: true });
    };

    apos.videoFields = self;

  }
});
