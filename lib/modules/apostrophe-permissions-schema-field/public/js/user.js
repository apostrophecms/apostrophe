apos.define('apostrophe-permissions-schema-field', {

  afterConstruct: function(self) {
    self.addFieldType();
  },

  construct: function(self, options) {
  
    self.addFieldType = function() {
      apos.schemas.addFieldType({
        name: 'permissions',
        populate: self.populate,
        convert: self.convert
      });
    };

    self.populate = function(object, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      var existing = object[name] || [];
      _.each(existing, function(p) {
        $fieldset.findByName(p).props('checked', true);
      });
      $fieldset.on('change', 'input[type="checkbox"]', function() {
       self.refresh($fieldset);
      });
      self.refresh($fieldset);
      return setImmediate(callback);
    };

    self.convert = function(data, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      var output = [];
      var $checked = $fieldset.find('input[type="checkbox"]');
      $checked.each(function() {
        var $checkbox = $(this);
        if ($checkbox.prop('checked')) {
          output.push($checkbox.attr('name'));
        }
      });
      data[name] = output;
      return setImmediate(callback);
    };

    self.refresh = function($fieldset) {
      var $update = $fieldset.find('[data-permission="update"]');
      var $updateany = $fieldset.find('[data-permission="updateany"]');
      var $trash = $fieldset.find('[data-permission="trash"]');
      var $insert = $fieldset.find('[data-permission="insert"]');
      if (!($update.prop('checked') || $updateany.prop('checked'))) {
        $trash.prop('checked', false);
      }
      if ($updateany.prop('checked')) {
        $update.prop('checked', false);
      }
      var permissions = [];
      if ($update.prop('checked')) {
        permissions.push('update');
      }
      if ($updateany.prop('checked')) {
        permissions.push('updateany');
      }
      if ($insert.prop('checked')) {
        permissions.push('insert');
      }
      if ($trash.prop('checked')) {
        permissions.push('trash');
      }
      permissions = permissions.join(' ');
      $fieldset.find('[data-permissions-summary]').hide();
      $fieldset.find('[data-permissions-summary="' + permissions + '"]').show();
    };

  }
});

