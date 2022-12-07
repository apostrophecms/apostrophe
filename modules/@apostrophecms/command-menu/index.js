const assert = require('assert').strict;

module.exports = {
  options: {
    alias: 'commandMenu'
  },
  init(self) {
    self.commands = {};
    self.groups = {};
    self.modals = {};

    self.addShortcutModal();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        composeCommands() {
          const definitions = Object.fromEntries(
            Object.values(self.apos.modules)
              .map(self.composeCommandsForModule)
              .filter(([ , commands = [] ]) => commands.length)
          );

          try {
            const composed = self.apos.util.pipe(self.composeRemoves, self.composeCommands, self.composeGroups, self.composeModals)({ definitions });

            const validationResult = [].concat(
              Object.entries(composed.commands)
                .map(([ name, command ]) => self.validateCommand({
                  name,
                  command
                })),
              Object.entries(composed.groups)
                .map(([ name, group ]) => self.validateGroup({
                  name,
                  group
                })),
              Object.entries(composed.modals)
                .flatMap(([ name, modal ]) => self.validateModal({
                  name,
                  modal
                }))
            );
            self.compileErrors(validationResult);

            const built = self.apos.util.pipe(self.buildCommands, self.buildGroups, self.buildModals)({ composed });
            self.commands = built.commands;
            self.groups = built.groups;
            self.modals = built.modals;
          } catch (error) {
            self.apos.util.error('Command-Menu validation error');
            self.apos.util.error(error);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      composeRemoves(initialState) {
        const formatRemove = (state, chain) => {
          return chain
            .reduce(
              (removes, { remove = [] }) => removes.concat(remove),
              state
            );
        };

        const concatenate = Object.values(initialState.definitions).reduce(formatRemove, []);

        return {
          ...initialState,
          removes: concatenate || []
        };
      },
      composeCommands(initialState) {
        const formatCommands = (state, chain) => {
          return chain
            .reduce(
              (commands, { add = {} }) => self.apos.util.merge(commands, add),
              state
            );
        };

        const concatenate = Object.values(initialState.definitions).reduce(formatCommands, {});

        return {
          ...initialState,
          commands: concatenate || {}
        };
      },
      composeGroups(initialState) {
        const formatGroups = (state, chain) => {
          return chain
            .reduce(
              (groups, { group = {} }) => self.apos.util.merge(groups, group),
              state
            );
        };

        const concatenate = Object.values(initialState.definitions).reduce(formatGroups, {});

        return {
          ...initialState,
          groups: concatenate || {}
        };
      },
      composeModals(initialState) {
        const formatModals = (state, chain) => {
          return chain
            .reduce(
              (modals, { modal = {} }) => self.apos.util.merge(modals, modal),
              state
            );
        };

        const concatenate = Object.values(initialState.definitions).reduce(formatModals, {});

        return {
          ...initialState,
          modals: concatenate || {}
        };
      },
      validateCommand({ name, command }) {
        try {
          assert.equal(command.type, 'item', `Invalid command type, must be "item", for ${name}`);
          assert.equal(typeof command.label, 'string', `Invalid command label, must be a string, for ${name} "${typeof command.label}" provided`);
          assert.equal(typeof command.action, 'object', `Invalid command action, must be an object for ${name}`) &&
            assert.equal(typeof command.action.type, 'string', `Invalid command action type for ${name}`) &&
            assert.equal(typeof command.action.payload, 'object', `Invalid command action payload for ${name}`);
          command.permission && (
            assert.equal(typeof command.permission, 'object', `Invalid command permission for ${name}`) &&
            assert.equal(typeof command.permission.action, 'string', `Invalid command permission action for ${name}`) &&
            assert.equal(typeof command.permission.type, 'string', `Invalid command permission type for ${name}`)
          );
          command.modal &&
            assert.equal(typeof command.modal, 'string', `Invalid command modal for ${name}`);
          assert.equal(typeof command.shortcut, 'string', `Invalid command shortcut, must be a string, for ${name}`);

          return [ true, null ];
        } catch (error) {
          return [ false, error ];
        }
      },
      validateGroup({ name, group }) {
        try {
          group.label && typeof group.label === 'object'
            ? assert.equal(typeof group.label.key, 'string', `Invalid group label key for ${name}`)
            : assert.equal(typeof group.label, 'string', `Invalid group label, must be a string, for ${name} "${typeof group.label}" provided`);
          assert.equal(Array.isArray(group.fields), true, `Invalid command fields, must be an array for ${name}`);
          assert.ok(group.fields.every(field => typeof field === 'string'), `Invalid command fields, must contains strings, for ${name}`);

          return [ true, null ];
        } catch (error) {
          return [ false, error ];
        }
      },
      validateModal({ name, modal }) {
        return Object.entries(modal)
          .map(([ groupName, group ]) => self.validateGroup({
            name: `${name}:${groupName}`,
            group
          }));
      },
      compileErrors(result) {
        const errors = result
          .filter(([ success ]) => !success)
          .map(([ , error ]) => error);
        if (errors.length) {
          throw new Error('Invalid', { cause: errors });
        }
      },
      buildCommands(initialState) {
        const concatenate = self.apos.util.omit(
          initialState.composed.commands,
          initialState.composed.removes
        );

        return {
          ...initialState,
          commands: concatenate || {}
        };
      },
      buildGroups(initialState) {
        const filterGroups = (state, [ name, group ]) => {
          const fields = group.fields
            .map(field => [ field, initialState.commands[field] ])
            .filter(([ , isNotEmpty ]) => isNotEmpty);

          return fields.length
            ? {
              ...state,
              [name]: {
                ...group,
                fields: Object.fromEntries(fields)
              }
            }
            : state;
        };

        const concatenate = Object.entries(initialState.composed.groups).reduce(filterGroups, {});

        return {
          ...initialState,
          groups: concatenate || {}
        };
      },
      buildModals(initialState) {
        const formatModals = (state, [ modal, groups ]) => {
          const built = self.buildGroups({
            commands: initialState.commands,
            composed: { groups }
          });

          return {
            ...state,
            [modal]: built.groups
          };
        };

        const concatenate = Object.entries(initialState.composed.modals).reduce(formatModals, {});

        return {
          ...initialState,
          modals: concatenate || {}
        };
      },

      composeCommandsForModule(aposModule) {
        return [
          aposModule.__meta.name,
          aposModule.__meta.chain
            .map(entry => {
              const metadata = aposModule.__meta.commands[entry.name] || null;

              return typeof metadata === 'function'
                ? metadata(aposModule)
                : metadata;
            })
            .filter(entry => entry !== null)
        ];
      },
      isCommandVisible(req, command) {
        return command.permission
          ? self.apos.permissions.can(req, command.permission.action, command.permission.type, command.permission.mode || 'draft')
          : true;
      },
      getVisibleGroups(commands, groups) {
        const keys = Object.keys(commands);

        return Object.fromEntries(
          Object.entries(groups)
            .map(([ key, group ]) => {
              const fields = Object.entries(group.fields)
                .reduce(
                  (acc, [ name, field ]) => keys.includes(name)
                    ? {
                      ...acc,
                      [name]: field
                    }
                    : acc,
                  {}
                );

              return Object.keys(fields).length
                ? [
                  key,
                  {
                    ...group,
                    fields
                  }
                ]
                : [];
            })
            .filter(fields => fields.length)
        );
      },
      getVisibleModals(commands) {
        return Object.fromEntries(
          Object.entries(self.modals)
            .map(([ key, groups ]) => [ key, self.getVisibleGroups(commands, groups) ])
            .filter(modals => modals.length)
        );
      },
      getVisible(req) {
        const commands = Object.fromEntries(
          Object.entries(self.commands)
            .map(([ key, command ]) => {
              return self.isCommandVisible(req, command)
                ? [ key, command ]
                : [];
            })
        );

        const groups = self.getVisibleGroups(commands, self.groups);
        const modals = self.getVisibleModals(commands);

        return {
          groups,
          modals
        };
      },
      addShortcutModal() {
        self.apos.modal.add(
          `${self.__meta.name}:shortcut`,
          self.getComponentName('shortcutModal', 'AposCommandMenuShortcut'),
          { moduleName: self.__meta.name }
        );
      },
      getBrowserData(req) {
        return {
          groups: self.getVisibleGroups(req)
        };
      }
    };
  }
};
