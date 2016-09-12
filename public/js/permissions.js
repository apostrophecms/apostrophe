/* global _, apos, async */

apos.permissions = {};

(function() {
  var self = apos.permissions;

  // "Brief" the permissions editor, telling it what it needs to know about
  // an existing page's permissions and setting it up for editing.
  //
  // $el should be a div containing the page permissions editor markup.
  // data is typically a page object and is used to prepopulate the editor.
  //
  // If options.propagate is true then "propagate to child pages"
  // checkboxes are implemented.

  self.brief = function($el, data, options) {
    // Non-admin users can't manipulate edit permissions.
    // (Hackers could try, but the server ignores anything submitted.)

    if (!(apos.data.permissions.admin || options.editorsCanChangeEditPermissions)) {
      $el.find('[data-edit-permissions-container]').hide();
    }

    // This is more or less deprecated with our new design.
    // Leaving for now as a historical record.
    $el.find('[data-show-view-permissions]').click(function() {
      $(this).toggleClass('apos-active');
      $el.find('[data-view-permissions]').toggle();
      return false;
    });

    var $loginRequired = $el.findByName('loginRequired');
    $loginRequired.val(data.loginRequired);
    $loginRequired.change(function() {
      var $certainPeople = $el.find('.apos-view-certain-people');
      if ($(this).val() === 'certainPeople') {
        $certainPeople.show();
      } else {
        $certainPeople.hide();
      }
    }).trigger('change');

    // In Mongo we store permissions in a single array of
    // strings, which look like this:
    //
    // edit-xxx <- where xxx is a user or group id
    //
    // Flip these into arrays by permission verb.
    //
    // The autocomplete routes can sort out which IDs are people and
    // which are gruops.

    var permissions = {};
    var ids = _.map(data.pagePermissions || [], function(permission) {
      var matches = permission.split(/\-/);
      var verb = matches[0];
      var id = matches[1];
      if (!permissions[verb]) {
        permissions[verb] = [];
      }
      permissions[verb].push(id);
    });

    var people;
    var groups;


    // This is more or less deprecated with our new design.
    // Leaving for now as a historical record.
    $el.find('[data-show-edit-permissions]').click(function() {
      $(this).toggleClass('apos-active');
      $el.find('[data-edit-permissions]').toggle();
      return false;
    });

    $el.find('[data-name="viewGroupIds"]').selective({
      // Unpublished people and groups can still have permissions
      source: '/apos-groups/autocomplete?published=any',
      data: permissions.view || [],
      propagate: options.propagate,
      preventDuplicates: true
    });

    $el.find('[data-name="viewPersonIds"]').selective({
      source: '/apos-people/autocomplete?published=any',
      data: permissions.view || [],
      propagate: options.propagate,
      preventDuplicates: true
    });

    // In the database, edit and publish are separate permissions.
    // In the UI, we know that publish is superior to edit, so we
    // use a "Can Publish" checkbox that appears once someone is
    // added as an editor. Set ourselves up to repopulate jquery
    // selective with that extra property. Once again, the
    // server-side autocomplete routes can sort out for us which
    // IDs were people and which were groups.

    var edit = [];
    var found = {};
    _.each(permissions.publish || [], function(id) {
      found[id] = true;
      edit.push({ value: id, publish: true });
    });
    _.each(permissions.edit || [], function(id) {
      if (!found[id]) {
        edit.push({ value: id });
      }
    });

    $el.find('[data-name="editGroupIds"]').selective({
      source: '/apos-groups/autocomplete?published=any',
      data: edit,
      propagate: options.propagate,
      extras: true,
      preventDuplicates: true
    });

    $el.find('[data-name="editPersonIds"]').selective({
      source: '/apos-people/autocomplete?published=any',
      data: edit,
      propagate: options.propagate,
      extras: true,
      preventDuplicates: true
    });
  };

  // "Debrief" the permissions editor, copying everything it knows
  // into properties of the "data" object, which is typically a page.
  //
  // These properties are data.loginRequired (false, "loginRequired" or
  // "certainPeople"), data.loginRequiredPropagate, and data.permissions.
  //
  // If options.propagate is not true, the "permissions" property of
  // "data" will be set as you see it on the server: an array of
  // strings like "view-xxx" where xxx is a person or group id.
  //
  // If options.propagate is true, the "permissions" property will
  // contain an array of objects in which the "value" property is the
  // actual user permission name as you would see on the server.
  // The "removed" property, if true, indicates the permission is
  // being removed rather than added, and the "propagate" property,
  // if true, indicates the permission should be propagated to descendant
  // pages.
  //
  // Actual propagation is carried out on the server side, not by
  // this method.

  self.debrief = function($el, data, options) {
    data.loginRequired = $el.findByName('loginRequired').val();
    data.loginRequiredPropagate = $el.findByName('loginRequiredPropagate').is(':checked') ? '1' : '0';
    data.pagePermissions = [];

    function debriefOne(field, filter) {
      var results = $el.find('[data-name="' + field + '"]').selective('get', { incomplete: true });
      _.each(results, function(result) {
        data.pagePermissions = data.pagePermissions.concat(filter(result));
      });
    }

    function viewFilter(result) {
      // when propagation is not an option result *is* the id
      var name = 'view-' + (result.value || result);
      if (!options.propagate) {
        return [ name ];
      }
      result.value = name;
      return [ result ];
    }

    function editPublishFilter(result) {
      // when propagation is not an option result *is* the id
      var value = result.value || result;
      if (!options.propagate) {
        // We don't have to send propagation rules so it's
        // easy, just return the appropriate permission name
        if (result.publish) {
          return [ 'publish-' + value ];
        } else {
          return [ 'edit-' + value ];
        }
      }

      // Always send two rules, one for edit and one for publish,
      // so we can propagate both if needed

      var edit;

      if (result.removed) {
        // Remove for both edit and publish
        edit = _.cloneDeep(result);
        edit.value = 'edit-' + value;
        result.value = 'publish-' + value;
        return [ edit, result ];
      }

      if (result.publish) {
        // Remove edit, add publish, so edit is not
        // left lying around too
        edit = _.cloneDeep(result);
        edit.value = 'edit-' + value;
        edit.removed = 1;
        result.value = 'publish-' + value;
        return [ edit, result ];
      }

      // Removing publish, adding edit
      var publish = _.cloneDeep(result);
      publish.value = 'publish-' + value;
      publish.removed = 1;
      result.value = 'edit-' + value;
      return [ publish, result ];
    }

    debriefOne('viewGroupIds', viewFilter);
    debriefOne('viewPersonIds', viewFilter);
    debriefOne('editGroupIds', editPublishFilter);
    debriefOne('editPersonIds', editPublishFilter);

    return data;
  };

})();
