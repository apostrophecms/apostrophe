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
       self.refresh($(this).closest('[data-permissions]'));
      });
      $fieldset.find('[data-permissions]').each(function() {
        self.refresh($(this));
      });
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

    self.refresh = function($permissionGroup) {
      var $update = $permissionGroup.find('[data-verb="update"]');
      var $updateany = $permissionGroup.find('[data-verb="updateany"]');
      var $trash = $permissionGroup.find('[data-verb="trash"]');
      var $move = $permissionGroup.find('[data-verb="move"]');
      var $insert = $permissionGroup.find('[data-verb="insert"]');
      if (!($update.prop('checked') || $updateany.prop('checked'))) {
        $trash.prop('checked', false);
        $trash.prop('readOnly', true);
        $trash.closest('[data-trash-clause]').addClass('apos-permissions-disabled');
        $move.prop('checked', false);
        $move.prop('readOnly', true);
        $move.closest('[data-move-clause]').addClass('apos-permissions-disabled');
      } else {
        $trash.prop('readOnly', false);
        $trash.closest('[data-trash-clause]').removeClass('apos-permissions-disabled');
        $move.prop('readOnly', false);
        $move.closest('[data-move-clause]').removeClass('apos-permissions-disabled');
      }
      if ($updateany.prop('checked')) {
        $update.prop('checked', false);
        $update.prop('readOnly', true);
        $update.closest('[data-update-clause]').addClass('apos-permissions-disabled');
      } else {
        $update.prop('readOnly', false);
        $update.closest('[data-update-clause]').removeClass('apos-permissions-disabled');
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
      if ($move.prop('checked')) {
        permissions.push('move');
      }
      permissions = permissions.join(' ');
      $permissionGroup.find('[data-permissions-summary]').hide();
      $permissionGroup.find('[data-permissions-summary="' + permissions + '"]').show();
    };

  }
});

