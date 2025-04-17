// Enable users to manage their personal settings (user record).
//
// ## Options
//
// `subforms`
//
// An object with subform configurations. The key is the subform name, the value
// is the subform configuration described below. Subforms rendered on the client
// side have two modes - preview and edit. The initial mode is preview. The
// configuration provides the necessary information for both modes.
//
// ```js
// subforms: {
//   // The subform name
//   name: {
//     // Required subform fields, shown in the order specified. The fields should
//     // exist in the user schema. The information is used in edit mode only.
//     // Currently supported system user fields are 'adminLocale' and 'password'.
//     // Keep in mind 'adminLocale' is available only if the `apostrophecms/i18n` module
//     // has the appropriate configuration.
//     fields: [ 'firstName', 'lastName' ],
//     // Optional subform label. Used in both preview and edit mode.
//     label: 'Profile',
//     // Optional subform help text. It is rendered instead
//     // of the subform preview value in preview mode only.
//     help: 'Your full name',
//     // The subform value rendered in preview mode, but only if `help` option is not
//     // provided. A string or i18n key / template can be specified.
//     // If not specified, the UI will attempt to generate a
//     // preview value based on the subform schema and field values (space separated).
//     preview: '{{ firstName }} {{ lastName }}',
//     // In effect ONLY if `preview` and `help` options are not present.
//     // Provide a custom, already registered (admin UI) component to render the subform
//     // preview value. The subform config object and current field values will be
//     // passed as props. previewComponent: 'MyComponent',
//     // Optional protection type. Currently allowed values are `password`
//     // and `true` (alias of `password`). If specified, the subform will be
//     // protected by the user current password.
//     protection: true,
//     // Optional flag to indicate that the subform should be reloaded after save.
//     reload: true
//   }
// }
// ```
//
// `groups`
//
// An object with group configurations. The key is the group name, the value
// is the group configuration, described below. Groups are used to organize
// subforms in the settings modal (tabs). If no groups are configured, a single
// group named "ungrouped" will be created. The order of the groups is
// respected.
//
// ```js
// groups: {
//   // The group name
//   account: {
//     // The group label.
//     label: 'Account',
//     // The subforms that belong to the group. The order is respected.
//     subforms: [ 'name', 'password' ]
//   }
// }
// ```
//
// ## API
//
// Add a protected field to the system protected fields list. This will ensure
// that any subform containing that field will be ALWAYS protected by
// the user's current password. It is recommended to use this method in the
// `apostrophe:modulesRegistered` event handler.
// `self.apos.settings.addProtectedField(fieldName, protectionType)`
//
// Add a forbidden field to the forbidden fields list. This will ensure that
// the field will not be allowed in any subform. It is recommended to use this
// method in the `apostrophe:modulesRegistered` event handler.
// `self.apos.settings.addForbiddenField(fieldName)`
//
// Add a field to the reload after save fields list. This will ensure that
// the page will be reloaded after subform containing the field is saved.
// It is recommended to use this method in the `apostrophe:modulesRegistered`
// event handler.
// `self.apos.settings.addReloadAfterSaveField(fieldName)`
//
// ## UI
//
// An example of a custom `previewComponent` with the core components explained
// can be found in the relevant PR:
// https://github.com/apostrophecms/apostrophe/pull/4236
const { klona } = require('klona');

module.exports = {
  options: {
    alias: 'settings',
    subforms: {},
    groups: {}
  },

  commands(self) {
    if (!self.hasSchema()) {
      return {};
    }

    return {
      add: {
        [`${self.__meta.name}:taskbar-manager`]: {
          type: 'item',
          label: 'apostrophe:settings',
          action: {
            type: '@apostrophecms/command-menu:open-modal',
            payload: {
              name: 'AposSettingsManager',
              props: { moduleName: '@apostrophecms/settings' }
            }
          },
          shortcut: 'T,S'
        }
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:taskbar': {
            label: 'apostrophe:commandMenuTaskbar',
            commands: [
              `${self.__meta.name}:taskbar-manager`
            ]
          }
        }
      }
    };
  },

  init(self) {
    // List of all allowed protection types and their aliases
    // (`subform.protection: type`). The key is the type or alias, the value is
    // the actual type (always a string). All subforms `protection` prop will be
    // converted to the actual type. Invalid protection type will panic.
    self.protectionTypes = {
      // Protection type to be used if protected is simply set to `true`.
      true: 'password',
      password: 'password'
      // TODO phase 3
      // email: 'email'
    };
    // Collection of fieldName: protectionType objects for system forced
    // protected fields. The order is important, the first match is used (first
    // have higher priority). If there are multiple fields in the subform,
    // having a system protected field, the first match from this list wins. If
    // there is specifically `password` field in the subform, the schema will be
    // completely replaced with the auto-generated password schema. Do not
    // modify this object directly, use
    // `self.apos.settings.addProtectedField(fieldName, protectionType)`
    // instead.
    self.systemProtectedFields = {
      password: self.protectionTypes.password
      // TODO phase 3
      // username: self.protectionTypes.password,
      // email: self.protectionTypes.email
    };
    // Completely forbidden fields, they are not allowed in the subforms.
    // Do not modify this array directly, use
    // `self.apos.settings.addForbiddenField(fieldName)` instead.
    self.systemForbiddenFields = [
      'role',
      'disabled',
      // TODO remove in phase 3
      'username',
      'email'
    ];
    // Fields that should trigger reload after saving.
    // Do not modify this array directly, use
    // `self.apos.settings.addReloadAfterSaveField(fieldName)` instead.
    self.systemReloadAfterSaveFields = [
      'adminLocale'
    ];
    self.userSchema = [];
    self.subforms = [];
    self.initSubforms();
    self.enableBrowserData();
    self.addToAdminBar();
  },

  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        addModal() {
          self.addSettingsModal();
        }
      }
    };
  },

  methods(self) {
    return {
      // Public API method.
      // Add a protected field to the system protected fields list.
      // Modules can add their own protected fields here
      // via 'apostrophe:modulesRegistered' event handler:
      // ```js
      // self.apos.settings.addProtectedField('myField', true);
      // self.apos.settings.addProtectedField('myField', 'password');
      // self.apos.settings.addProtectedField('myField', 'email');
      // ```
      addProtectedField(fieldName, protectionType) {
        if (!self.protectionTypes[protectionType]) {
          throw new Error(
            `[@apostrophecms/settings] Attempt to add a protected field "${fieldName}" with invalid protection type "${protectionType}".`
          );
        }
        if (!self.systemProtectedFields[fieldName]) {
          self.systemProtectedFields[fieldName] = self.protectionTypes[protectionType];
        }
      },

      // Public API method.
      // Add a forbidden field to the forbidden fields list.
      // Modules can add their own forbidden fields here
      // via 'apostrophe:modulesRegistered' event handler:
      // `self.apos.settings.addForbiddenField('myField');`
      addForbiddenField(fieldName) {
        if (!self.systemForbiddenFields.includes(fieldName)) {
          self.systemForbiddenFields.push(fieldName);
        }
      },

      // Public API method.
      // Add a field to the reload after save fields list.
      // Modules can add their own reload after save fields here
      // via 'apostrophe:modulesRegistered' event handler:
      // `self.apos.settings.addReloadAfterSaveField('myField');`
      addReloadAfterSaveField(fieldName) {
        if (!self.systemReloadAfterSaveFields.includes(fieldName)) {
          self.systemReloadAfterSaveFields.push(fieldName);
        }
      },

      hasSchema() {
        return self.userSchema.length > 0;
      },

      // Initialize the subforms configuration.
      initSubforms() {
        self.userSchema = self.inferUserSchema();

        for (const [ name, config ] of Object.entries(self.options.subforms)) {
          // Don't allow malformed subform.fields, the only required prop.
          if (!Array.isArray(config.fields) || config.fields.length === 0) {
            throw new Error(`[@apostrophecms/settings] The subform "${name}" must have at least one field.`);
          }
          // Don't allow malformed subform.protection.
          if (config.protection && !self.protectionTypes[config.protection]) {
            throw new Error(`[@apostrophecms/settings] The protection type "${config.protection}" is not valid.`);
          }
          if (config.protection) {
            config.protection = self.protectionTypes[config.protection];
          }
          // Auto reload after save.
          config.reload = config.reload || self.systemReloadAfterSaveFields
            .some(field => config.fields.includes(field));
          // No one is allowed to set the flag but us.
          delete config._passwordChangeForm;
          const schema = self.getSubformSchema(name);

          self.subforms.push({
            ...config,
            name,
            schema,
            // constrain the fields to the ones that are actually in the user
            fields: schema.map(field => field.name)
          });
        }

        this.initGroups();
        this.enhanceSubforms();
      },

      // Initialize groups based on the configuration given. Fallback to
      // a single group (Other) if none is configured. Move fields that
      // are not in a group to the "Ungrouped" group.
      // This method requires initialized self.subforms.
      initGroups() {
        if (!self.hasSchema()) {
          return;
        }
        // Contains properly sorted fields by groups
        const newSubforms = [];
        // Transformed to array groups
        const groups = [];
        const subforms = self.subforms;
        const otherGroup = {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        };

        // Transform to array groups
        for (const [ name, group ] of Object.entries(self.options.groups || {})) {
          groups.push({
            name,
            label: group.label || name[0].toUpperCase() + name.slice(1),
            subforms: group.subforms || []
          });
        }
        // Push and Sort subfields to the newSubforms, add group to every
        // subform.
        for (const group of groups) {
          if (!group.subforms.length) {
            continue;
          }
          group.subforms.forEach(name => {
            const subform = subforms.find(subform => subform.name === name);
            if (subform) {
              newSubforms.push({
                ...subform,
                group: {
                  name: group.name,
                  label: group.label
                }
              });
            }
          });
        }
        // Push the leftover to ungrouped. It shouldn't be possible though.
        const leftover = subforms
          .filter(subform =>
            !newSubforms.some(newSubform => newSubform.name === subform.name)
          );
        for (const subform of leftover) {
          newSubforms.push({
            ...subform,
            group: otherGroup
          });
        }
        self.subforms = newSubforms;
      },

      // Get the subset of the user schema that is relevant to the configured
      // subforms.
      inferUserSchema() {
        const subforms = self.options.subforms;
        const userSchema = self.apos.user.schema;
        const allSettingsFields = [
          ...new Set(
            Object.keys(subforms)
              .reduce((acc, subform) => {
                // Do not allow password field alongside other fields in a
                // subform
                if (subforms[subform].fields.includes('password')) {
                  subforms[subform].fields = [ 'password' ];
                }
                return acc.concat(subforms[subform].fields || []);
              }, [])
          )
        ];
        self.validateSettingsSchema(allSettingsFields, userSchema);

        return allSettingsFields
          .filter(field => {
            return userSchema.some(userField => userField.name === field);
          })
          // extra safety
          .filter(Boolean)
          .map(field => {
            return klona(userSchema.find(userField => userField.name === field));
          });
      },

      // Validate that the fields configured in the settings module exist in the
      // user schema and are not forbidden.
      validateSettingsSchema(settingsFieldNames, userSchema) {
        for (const name of settingsFieldNames) {
          if (!userSchema.some(field => field.name === name)) {
            throw new Error(`[@apostrophecms/settings] The field "${name}" is not a valid user field.`);
          }
          if (self.systemForbiddenFields.includes(name)) {
            throw new Error(`[@apostrophecms/settings] The field "${name}" is forbidden.`);
          }
        }
      },

      // Enhance the subforms - `protection` security.
      // This method requires initialized self.subforms.
      enhanceSubforms() {
        // 1. Add protection flag to subforms for system protected fields.
        const fields = Object.entries(self.systemProtectedFields);
        for (const [ fieldName, protectionType ] of fields) {
          self.subforms = self.subforms.map(subform => {
            if (subform.fields.includes(fieldName)) {
              subform.protection = protectionType || true;
            }
            return subform;
          });
        }

        // 2. Ehhance the protected forms schema.
        self.subforms = self.subforms.map(subform => {
          if (!subform.protection) {
            return subform;
          }

          // 2.1. Special case for the change password subform
          const passwordField = subform.schema.find(field => field.name === 'password');
          if (passwordField) {
            self.enhancePasswordSubform(passwordField, subform);
            return subform;
          }

          // 2.2. General case for all other protected subforms
          self.enhanceProtectedSubform(subform);
          return subform;
        });
      },

      // Auto-generate and replace the subform schema for the "password change"
      // scenario.
      enhancePasswordSubform(passwordField, subform) {
        const templateField = self.getPasswordTemplateField();
        subform.help = subform.help || 'apostrophe:passwordChangeHelp';
        if (!subform.label) {
          subform.label = 'apostrophe:password';
        }
        subform.schema = [];
        // Indicates the edge case of password change form
        subform._passwordChangeForm = true;
        subform.schema.push({
          ...passwordField,
          label: 'apostrophe:passwordNew',
          required: true
        });
        subform.schema.push({
          ...templateField,
          label: 'apostrophe:passwordRepeat',
          name: 'passwordRepeat',
          required: true
        });
        subform.schema.push({
          ...templateField,
          label: 'apostrophe:passwordCurrent',
          name: 'passwordCurrent',
          required: true
        });
      },

      // Enhance the protected subform schema based on the protection type.
      enhanceProtectedSubform(subform) {
        switch (subform.protection) {
          case self.protectionTypes.password: {
            // Last field so that it doesn't mess up with the "first field
            // label" detection on the client side (when form label is not
            // specified).
            subform.schema.push({
              ...self.getPasswordTemplateField(),
              label: 'apostrophe:passwordCurrent',
              name: 'passwordCurrent',
              required: true
            });
            break;
          }
          // TODO `self.protectionTypes.email' in phase 3

          default: {
            throw new Error(`[@apostrophecms/settings] Not supported protection type "${subform.protection}".`);
          }
        }
      },

      // Clone the password field from the user schema to be used as a template
      // for auto generated subform schema.
      getPasswordTemplateField() {
        const templateField = klona(self.apos.user.schema.find(field => field.name === 'password'));
        delete templateField.moduleName;
        delete templateField.group;
        delete templateField.name;
        delete templateField.label;
        return templateField;
      },

      // Get subform fields by subform name.
      // This method requires initialized self.subforms.
      getSubformSchema(name) {
        const subform = self.options.subforms[name];
        if (!subform) {
          throw new Error('notfound', `[@apostrophecms/settings] Subform "${name}" not found.`);
        }
        return subform.fields.map(fieldName => {
          return self.userSchema.find(field => field.name === fieldName);
        });
      },

      getSubform(name) {
        return self.subforms.find(subform => subform.name === name);
      },

      // Detect protected subforms and handle them.
      handleProtectedSubform(req, subform, payload) {
        if (!subform.protection) {
          return;
        }
        if (subform._passwordChangeForm) {
          return self.handlePasswordChangeSubform(req, subform, payload);
        }
        switch (subform.protection) {
          case self.protectionTypes.password: {
            return self.handlePasswordProtectedSubform(req, subform, payload);
          }
          // TODO `self.protectionTypes.email' in phase 3

          // Should not happen as we validate the protected type in the init
          // phase.
          default: {
            throw self.apos.error('invalid', `Not supported protected type "${subform.protection}".`);
          }
        }
      },

      // Handle the password change subform.
      handlePasswordChangeSubform(req, subform, payload) {
        const { password, passwordRepeat } = payload;
        if (!password || passwordRepeat !== password) {
          const invalid = self.apos.error('invalid', {
            errors: 'invalid'
          });
          invalid.path = 'passwordRepeat';
          throw [ invalid ];
        }

        return self.handlePasswordProtectedSubform(req, subform, payload);
      },

      // Handle the password protected subform.
      async handlePasswordProtectedSubform(req, subform, payload) {
        try {
          await self.apos.user.verifyPassword(req.user, payload.passwordCurrent);
        } catch (e) {
          throw self.apos.error(
            'forbidden',
            'apostrophe:passwordCurrentError',
            {
              path: 'passwordCurrent'
            }
          );
        }
        return subform;
      },

      // Handle the after save logic. If the saved subform requires reload
      // after save, we will add session indicator that will allow the client
      // to restore its state. The client is responsible for the actual reload.
      // The session value contains the current subform name. The value is sent
      // once via the `getBrowserData` method and then removed from the session.
      handleAfterSave(req, subform) {
        if (!subform.reload) {
          return;
        }
        req.session.aposSettingsReload = subform.name;
        // TODO email(s) in phase 3
      },

      addToAdminBar() {
        if (!self.hasSchema()) {
          return;
        }
        self.apos.adminBar.add(
          `${self.__meta.name}:settings`,
          'apostrophe:settings',
          false,
          {
            user: true
          }
        );
      },

      addSettingsModal() {
        if (!self.hasSchema()) {
          return;
        }
        self.apos.modal.add(
          `${self.__meta.name}:settings`,
          self.getComponentName('settingsModal', 'AposSettingsManager'),
          { moduleName: self.__meta.name }
        );
      },

      getBrowserData(req) {
        const restore = req.session.aposSettingsReload;
        delete req.session.aposSettingsReload;

        return {
          subforms: self.subforms,
          action: self.action,
          restore
        };
      }
    };
  },

  restApiRoutes(self) {
    return {
      async getAll(req) {
        if (!self.hasSchema() || !req.user) {
          throw self.apos.error('notfound');
        }
        const user = await self.apos.user
          .find(req, { _id: req.user._id })
          .permission(false)
          .toObject();

        if (!user) {
          throw self.apos.error('notfound');
        }

        const values = {
          _id: user._id
        };
        for (const field of self.userSchema) {
          values[field.name] = user[field.name];
        }
        return values;
      }
    };
  },

  apiRoutes(self) {
    return {
      patch: {
        ':subform': async (req) => {
          if (!self.hasSchema() || !req.user) {
            throw self.apos.error('notfound');
          }
          let subform = self.getSubform(
            self.apos.launder.string(req.params.subform)
          );

          if (!subform || !subform.schema.length) {
            throw self.apos.error('notfound');
          }

          await self.handleProtectedSubform(req, subform, req.body);
          // Remove the auto-generated fields from the schema
          subform = klona(subform);
          subform.schema = subform.schema
            .filter(field => self.userSchema
              .some(userField => userField.name === field.name));

          const user = await self.apos.user
            .find(req, { _id: req.user._id })
            .permission(false)
            .toObject();

          if (!user) {
            throw self.apos.error('notfound');
          }

          await self.apos.schema.convert(req, subform.schema, req.body, user);
          await self.apos.user.update(req, user, { permissions: false });

          await self.handleAfterSave(req, subform, user);

          const values = {
            _id: user._id
          };
          for (const field of subform.schema) {
            values[field.name] = user[field.name];
          }
          return values;
        }
      }
    };
  }
};
