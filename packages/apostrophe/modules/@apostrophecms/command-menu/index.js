const assert = require('assert').strict;

module.exports = {
  options: {
    components: {},
    alias: 'commandMenu'
  },
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:show-shortcut-list`]: {
          type: 'item',
          label: 'apostrophe:commandMenuShowShortcutList',
          action: {
            type: '@apostrophecms/command-menu:open-modal',
            payload: {
              name: 'AposCommandMenuShortcut',
              props: { moduleName: '@apostrophecms/command-menu' }
            }
          },
          shortcut: '?'
        }
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:general': {
            label: 'apostrophe:commandMenuGeneral',
            commands: [
              `${self.__meta.name}:show-shortcut-list`
            ]
          }
        }
      }
    };
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
            const composed = self.apos.util.pipe(
              self.composeRemoves,
              self.composeCommands,
              self.composeGroups,
              self.composeModals
            )({ definitions });

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

            const built = self.apos.util.pipe(
              self.buildCommands,
              self.buildGroups,
              self.buildModals
            )({ composed });
            self.commands = built.commands;
            self.groups = built.groups;
            self.modals = built.modals;
          } catch (error) {
            self.apos.util.error(error, 'Command-Menu validation error');
          }
        }
      }
    };
  },
  methods(self) {
    return {
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
      composeRemoves(initialState) {
        const formatRemove = (state, chain) => {
          return chain
            .reduce(
              (removes, { add = {}, remove = [] }) => {
                const existingCommands = Object.keys(add);

                return removes
                  .filter(key => !existingCommands.includes(key))
                  .concat(remove);
              },
              state
            );
        };

        const concatenate = Object
          .values(initialState.definitions)
          .reduce(formatRemove, []);

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

        const concatenate = Object
          .values(initialState.definitions)
          .reduce(formatCommands, {});

        return {
          ...initialState,
          commands: concatenate || {}
        };
      },
      composeGroups(initialState) {
        const removeDuplicates = (left, right) => {
          const commands = Object.values(right).flatMap(group => group.commands);

          return Object.fromEntries(
            Object.entries(left)
              .map(([ name, group ]) => {
                return [
                  name,
                  {
                    ...group,
                    commands: (group.commands || [])
                      .filter(command => !commands.includes(command))
                  }
                ];
              })
          );
        };

        const formatGroups = (state, chain) => {
          return chain
            .reduce(
              (groups, { group = {} }) => {
                return self.apos.util.merge(removeDuplicates(groups, group), group);
              },
              state
            );
        };

        const concatenate = Object
          .values(initialState.definitions)
          .reduce(formatGroups, {});

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

        const concatenate = Object
          .values(initialState.definitions)
          .reduce(formatModals, {});

        return {
          ...initialState,
          modals: concatenate || {}
        };
      },
      validateCommand({ name, command }) {
        try {
          assert.equal(command.type, 'item', `Invalid command type, must be "item", for ${name}`);
          command.label && typeof command.label === 'object'
            ? assert.equal(typeof command.label.key, 'string', `Invalid command label key for ${name}`)
            : assert.equal(typeof command.label, 'string', `Invalid command label, must be a string, for ${name} "${typeof command.label}" provided`);
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
          command.shortcut !== false &&
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
          assert.equal(Array.isArray(group.commands), true, `Invalid group commands, must be an array for ${name}`);
          assert.ok(group.commands.every(field => typeof field === 'string'), `Invalid group commands, must contains strings, for ${name}`);

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
          const error = new Error('Invalid', { cause: errors });
          // For bc with node 14 and below we need to check cause
          if (!error.cause) {
            error.cause = errors;
          }
          throw error;
        }
      },
      buildCommands(initialState) {
        const additionalRemoves = Object.entries(initialState.composed.commands)
          .filter(([ , field ]) => field.shortcut === false)
          .map(([ name ]) => name);

        const concatenate = self.apos.util.omit(
          initialState.composed.commands,
          initialState.composed.removes.concat(additionalRemoves)
        );

        return {
          ...initialState,
          commands: concatenate || {}
        };
      },
      buildGroups(initialState) {
        const filterGroups = (state, [ name, group ]) => {
          const commands = group.commands
            .map(field => [ field, initialState.commands[field] ])
            .filter(([ , isNotEmpty ]) => isNotEmpty);

          return commands.length
            ? {
              ...state,
              [name]: {
                ...group,
                commands: Object.fromEntries(commands)
              }
            }
            : state;
        };

        const concatenate = Object
          .entries(initialState.composed.groups)
          .reduce(filterGroups, {});

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

        const concatenate = Object
          .entries(initialState.composed.modals)
          .reduce(formatModals, {});

        return {
          ...initialState,
          modals: concatenate || {}
        };
      },
      isCommandVisible(req, command) {
        return command.permission
          ? self.apos.permission.can(req, command.permission.action, command.permission.type, command.permission.mode || 'draft')
          : true;
      },
      getVisibleGroups(visibleCommands, groups = self.groups) {
        const formatGroup = (state, [ name, field ]) =>
          visibleCommands.includes(name)
            ? {
              ...state,
              [name]: field
            }
            : state;

        return Object.fromEntries(
          Object.entries(groups)
            .map(([ key, group ]) => {
              const commands = Object.entries(group.commands).reduce(formatGroup, {});

              return [
                key,
                {
                  ...group,
                  commands
                }
              ];
            })
            .filter(([ , { commands = {} } ]) => Object.keys(commands).length)
        );
      },
      getVisibleModals(visibleCommands, modals = self.modals) {
        return Object.fromEntries(
          Object.entries(modals)
            .map(([ key, groups ]) => [
              key,
              self.getVisibleGroups(visibleCommands, groups)
            ])
            .filter(([ , groups ]) => Object.keys(groups).length)
        );
      },
      getVisible(req) {
        const visibleCommands = Object.entries(self.commands)
          .map(([ key, command ]) => self.isCommandVisible(req, command) ? key : null)
          .filter(isNotEmpty => isNotEmpty);

        const groups = self.getVisibleGroups(visibleCommands);
        const modals = self.getVisibleModals(visibleCommands);

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
        if (!req.user) {
          return false;
        }

        const { groups, modals } = self.getVisible(req);
        self.notifyConflicts(req, modals);

        return {
          components: { the: self.options.components.the || 'TheAposCommandMenu' },
          groups,
          modals
        };
      },
      notifyConflicts(req, modals = self.modals) {
        const shortcuts = {
          modal: {},
          list: {},
          conflict: {}
        };

        Object.entries(modals)
          .forEach(([ modal, groups ]) => Object.values(groups)
            .forEach(group => Object.entries(group.commands)
              .forEach(([ name, field ]) => {
                field.shortcut
                  .toUpperCase()
                  .split(' ')
                  .forEach(shortcut => {
                    self.detectShortcutConflict({
                      shortcuts,
                      shortcut,
                      modal: modal === 'default' ? 'admin-bar' : modal,
                      moduleName: name
                    });
                  });
              })
            )
          );

        if (Object.entries(shortcuts.conflict).length) {
          self.apos.util.warnDev(
            req.t('apostrophe:shortcutConflictNotification'),
            shortcuts.conflict
          );
        }
      },
      detectShortcutConflict({
        shortcuts, shortcut, modal, moduleName
      }) {
        shortcuts.modal[modal] = shortcuts.modal[modal] || [];
        shortcuts.list[modal] = shortcuts.list[modal] || {};
        shortcuts.list[modal][shortcut] = shortcuts.list[modal][shortcut] || [];

        const existingShortcut = shortcuts.modal[modal].includes(shortcut);

        if (existingShortcut) {
          shortcuts.conflict[modal] = shortcuts.conflict[modal] || {};
          shortcuts.conflict[modal][shortcut] = shortcuts.list[modal][shortcut];
        } else {
          shortcuts.modal[modal].push(shortcut);
        }
        shortcuts.list[modal][shortcut].push(moduleName);

        return shortcuts;
      }
    };
  }
};
