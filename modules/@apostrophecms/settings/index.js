module.exports = {
  options: {
    alias: 'settings',
    subforms: {},
    // XXX not implemented until Phase 2
    groups: {}
  },

  init(self) {
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
      hasSchema() {
        return self.userSchema.length > 0;
      },

      // Initialize the subforms configuration
      initSubforms() {
        self.userSchema = self.inferUserSchema();

        for (const [ name, config ] of Object.entries(self.options.subforms)) {
          const schema = self.getSubformSchema(name);
          self.subforms.push({
            ...config,
            name,
            schema
          });
        }
      },

      // Get the subset of the user schema that is relevant to the configured
      // subforms.
      inferUserSchema() {
        const schema = [];
        const subforms = self.options.subforms;
        const userSchema = self.apos.user.schema;
        const allSettingsFields = [
          ...new Set(
            Object.keys(subforms)
              .reduce((acc, subform) => {
                return acc.concat(subforms[subform].fields);
              }, [])
          )
        ];
        self.validateSettingsSchema(allSettingsFields, userSchema);

        for (const field of userSchema) {
          if (allSettingsFields.includes(field.name)) {
            schema.push(field);
          }
        }
        return schema;
      },

      // Validate that the fields configured in the settings module exist in the
      // user schema and are not forbidden.
      // XXX Temporary (Phase 2,3) extend the forbidden protected fields.
      validateSettingsSchema(settingsFieldNames, userSchema) {
        const forbiddenFields = [
          'role',
          // These will be allowed in Phase 2 and 3
          'username',
          'password',
          'email'
        ];
        for (const name of settingsFieldNames) {
          if (!userSchema.some(field => field.name === name)) {
            throw new Error(`[@apostrophecms/settings] The field "${name}" is not a valid user field.`);
          }
          if (forbiddenFields.includes(name)) {
            throw new Error(`[@apostrophecms/settings] The field "${name}" is forbidden.`);
          }
        }
      },

      // Get subform fields by subform name.
      getSubformSchema(name) {
        const subform = self.options.subforms[name];
        if (!subform) {
          throw self.apos.error('notfound', `Subform "${name}" not found.`);
        }
        return subform.fields.map(fieldName => {
          return self.userSchema.find(field => field.name === fieldName);
        });
      },

      getSubform(name) {
        return self.subforms.find(subform => subform.name === name);
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
        return {
          subforms: self.subforms,
          action: self.action
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
          const subform = self.getSubform(
            self.apos.launder.string(req.params.subform)
          );

          if (!subform || !subform.schema.length) {
            throw self.apos.error('notfound');
          }

          const user = await self.apos.user
            .find(req, { _id: req.user._id })
            .permission(false)
            .toObject();

          if (!user) {
            throw self.apos.error('notfound');
          }

          await self.apos.schema.convert(req, subform.schema, req.body, user);
          await self.apos.user.update(req, user, { permissions: false });

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
