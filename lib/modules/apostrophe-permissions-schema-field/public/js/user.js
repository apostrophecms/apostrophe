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
        $fieldset.findByName(p).prop('checked', true);
      });
      $fieldset.on('change', 'input[type="checkbox"]', function() {
       self.refreshGroup($(this).closest('[data-permissions]'));
      });
      $fieldset.find('[data-permissions]').each(function() {
        self.refreshGroup($(this));
      });
      $fieldset.on('change', 'input[name="admin"]', function() {
        self.refreshAdmin($fieldset);
      });
      self.refreshAdmin($fieldset, true);
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

    self.refreshAdmin = function($fieldset, initial) {
      console.log('initial is ' + initial);
      var $admin = $fieldset.find('input[name="admin"]');
      if ($admin.prop('checked')) {
        $fieldset.find('input[type="checkbox"]').prop('checked', true);
        $fieldset.find('input[type="checkbox"],select').not($admin).prop('disabled', true);
        toggle('addClass');
      } else if (!initial) {
        $fieldset.find('input[type="checkbox"]').prop('checked', false);
        $fieldset.find('input[type="checkbox"],select').prop('disabled', false);
        toggle('removeClass');
      }
      function toggle(method) {
        $fieldset.find('[data-type-group],[data-independent-group]').each(disableOther);
        $fieldset.find('[data-independent-group="default"] [data-independent-permission]').each(disableOther);
        function disableOther() {
          var $el = $(this);
          if (!$el.find('input[name="admin"]').length) {
            $el[method]('apos-permissions-disabled');
          }
        }
      }
    };

    self.refreshGroup = function($permissionGroup) {
      var $admin = $permissionGroup.find('[data-verb="admin"]');
      var $update = $permissionGroup.find('[data-verb="update"]');
      var $updateany = $permissionGroup.find('[data-verb="updateany"]');
      var $trash = $permissionGroup.find('[data-verb="trash"]');
      var $move = $permissionGroup.find('[data-verb="move"]');
      var $insert = $permissionGroup.find('[data-verb="insert"]');
      if ($admin.prop('checked')) {
        $permissionGroup.find('[data-nuanced] input[type="checkbox"]').prop('disabled', true).prop('checked', false);
        $permissionGroup.find('[data-nuanced]').addClass('apos-permissions-disabled');
      } else {
        $permissionGroup.find('[data-nuanced] input[type="checkbox"]').prop('disabled', false);
        $permissionGroup.find('[data-nuanced]').removeClass('apos-permissions-disabled');
        if (!($update.prop('checked') || $updateany.prop('checked'))) {
          $trash.prop('checked', false);
          $trash.prop('disabled', true);
          $trash.closest('[data-trash-clause]').addClass('apos-permissions-disabled');
          $move.prop('checked', false);
          $move.prop('disabled', true);
          $move.closest('[data-move-clause]').addClass('apos-permissions-disabled');
        } else {
          $trash.prop('disabled', false);
          $trash.closest('[data-trash-clause]').removeClass('apos-permissions-disabled');
          $move.prop('disabled', false);
          $move.closest('[data-move-clause]').removeClass('apos-permissions-disabled');
        }
        if ($updateany.prop('checked')) {
          $update.prop('checked', false);
          $update.prop('disabled', true);
          $update.closest('[data-update-clause]').addClass('apos-permissions-disabled');
        } else {
          $update.prop('disabled', false);
          $update.closest('[data-update-clause]').removeClass('apos-permissions-disabled');
        }
      }
      var permissions = [];
      if ($admin.prop('checked')) {
        permissions.push('admin');
      }
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

