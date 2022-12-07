const assert = require('assert').strict;
const pipe = (...functions) => (initial) => functions.reduce((accumulator, current) => current(accumulator), initial);

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
            type: 'open-modal',
            payload: {
              name: 'AposCommandMenuShortcut',
              props: { moduleName: '@apostrophecms/command-menu' }
            }
          },
          shortcut: '?'
        }
      },
      group: {
        '@apostrophecms/command-menu:general': {
          label: 'apostrophe:commandMenuGeneral',
          fields: [
            `${self.__meta.name}:show-shortcut-list`
          ]
        }
      }
    };
  },
  init(self) {
    self.rawCommands = [];
    self.removes = [];
    self.commands = {};
    self.groups = {};
    self.modals = {}; // TODO keep or update

    self.addShortcutModal();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        composeCommands() {
          self.rawCommands = Object.values(self.apos.modules).flatMap(self.composeCommandsForModule);
          self.removes = [];
          self.commands = {};
          self.groups = {};
          self.modals = {};

          const composed = pipe(self.composeCommand, self.composeRemove, self.composeGroup)({ rawCommands: self.rawCommands });
          try {
            const validationResult = [].concat(
              Object.entries(composed.command)
                .map(([ name, command ]) => self.validateCommand({
                  name,
                  command
                })),
              Object.entries(composed.group)
                .map(([ name, group ]) => self.validateGroup({
                  name,
                  group
                }))
            );
            self.compileErrors(validationResult);

            self.removes = composed.remove;
            self.commands = composed.command;
            self.groups = composed.group;
            self.modals = composed.modal;
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
      compileErrors(result) {
        const errors = result
          .filter(([ success ]) => !success)
          .map(([ , error ]) => error);
        if (errors.length) {
          throw new Error('Invalid', { cause: errors });
        }
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
      composeRemove(initialState) {
        const concatenate = []
          .concat(...initialState.rawCommands.map(command => command.remove))
          .filter(isNotEmpty => isNotEmpty);

        return {
          ...initialState,
          remove: concatenate
        };
      },
      composeGroup(initialState) {
        const formatGroups = (state, { group = {} }) => {
          return Object.entries(group)
            .reduce(
              (groups, [ name, attributes ]) => {
                return {
                  ...groups,
                  [name]: {
                    ...attributes,
                    fields: (groups[name]?.fields || []).concat(attributes.fields)
                  }
                };
              },
              state
            );
        };

        const concatenate = initialState.rawCommands.reduce(formatGroups, {});

        return {
          ...initialState,
          group: concatenate
        };
      },
      composeCommand(initialState) {
        const concatenate = []
          .concat(...initialState.rawCommands.map(command => command.add))
          .filter(isNotEmpty => isNotEmpty);

        return {
          ...initialState,
          command: concatenate
            .reduce(
              (acc, command) => ({
                ...acc,
                ...command
              }),
              {}
            )
        };
      },
      composeModal(initialState) { // TODO keep or remove
        const formatModals = (state, { group }) => {
          return state;
        };

        const concatenate = initialState.rawCommands.reduce(formatModals, {});

        return {
          ...initialState,
          modal: concatenate
        };
      },
      composeCommandsForModule(aposModule) {
        return aposModule.__meta.chain
          .map(entry => {
            const metadata = aposModule.__meta.commands[entry.name] || null;

            return typeof metadata === 'function'
              ? metadata(aposModule)
              : metadata;
          })
          .filter(entry => entry !== null);
      },
      isCommandVisible(req, command) {
        return command.permission
          ? self.apos.permissions.can(req, command.permission.action, command.permission.type, command.permission.mode || 'draft')
          : true;
      },
      getVisibleGroups(commands) {
        const keys = Object.keys(commands);

        return Object.fromEntries(
          Object.entries(self.groups)
            .map(([ key, group ]) => {
              const fields = group.fields
                .reduce(
                  (acc, field) => keys.includes(field)
                    ? {
                      ...acc,
                      [field]: commands[field]
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
            .filter(groups => groups.length)
        );
      },
      getVisibleModals(req, commands) {
        const keys = Object.keys(commands);

        const groups = Object.fromEntries(
          Object.entries(self.groups)
            .map(([ key, group ]) => {
              const fields = group.fields
                .reduce(
                  (acc, field) => keys.includes(field)
                    ? {
                      ...acc,
                      [field]: commands[field]
                    }
                    : acc,
                  {}
                );

              return Object.keys(fields).length
                ? [ key, {
                  ...group,
                  fields
                } ]
                : [];
            })
            .filter(groups => groups.length)
        );

        const shortcuts = {
          standard: {},
          global: [],
          conflicts: []
        };

        const modals = Object.entries(groups)
          .reduce(
            (acc, [ key, group ]) => {
              Object.entries(group.fields)
                .forEach(([ name, field ]) => {
                  self.detectShortcutConflict({
                    shortcuts,
                    shortcut: field.shortcut,
                    standard: !!field.modal,
                    moduleName: name
                  });

                  const modal = field.modal || null;
                  acc[modal] = {
                    ...acc[modal],
                    [key]: {
                      ...(acc[modal]?.[key] || group),
                      fields: {
                        ...acc[modal]?.[key]?.fields,
                        [name]: field
                      }
                    }
                  };
                });

              return acc;
            },
            {}
          );

        for (const conflict of shortcuts.conflicts) {
          self.apos.notify(req, conflict, {
            type: 'warning',
            dismiss: 10
          });
        }

        return modals;
      },
      detectShortcutConflict({
        shortcuts, shortcut, standard, moduleName
      }) {
        let existingShortcut;
        if (standard) {
          shortcuts.standard[moduleName] = shortcuts.standard[moduleName] || [];
          existingShortcut =
            shortcuts.standard[moduleName].includes(shortcut);
        } else {
          existingShortcut = shortcuts.global.includes(shortcut);
        }

        if (existingShortcut) {
          shortcuts.conflicts.push(
            `Shortcut conflict on ${moduleName} for '${shortcut}'`
          );
        } else {
          standard
            ? shortcuts.standard[moduleName].push(shortcut)
            : shortcuts.global.push(shortcut);
        }

        return shortcuts;
      },
      getVisible(req) {
        const commands = Object.fromEntries(
          Object.entries(self.commands)
            .map(([ key, command ]) => {
              return !self.removes.includes(key) && self.isCommandVisible(req, command)
                ? [ key, command ]
                : [];
            })
        );

        const groups = self.getVisibleGroups(commands);
        const modals = self.getVisibleModals(req, commands);

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

        const visible = self.getVisible(req);

        return {
          components: { the: self.options.components.the || 'TheAposCommandMenu' },
          groups: visible.groups,
          modals: visible.modals
        };
      }
    };
  }
};
