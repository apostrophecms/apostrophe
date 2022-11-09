const assert = require('assert').strict;
const pipe = (...functions) => (initial) => functions.reduce((accumulator, current) => current(accumulator), initial);

module.exports = {
  options: {
    alias: 'commandMenu'
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        composeCommands() {
          self.rawCommands = Object.values(self.apos.modules).flatMap(self.composeCommandsForModule);
          self.commands = {};
          self.groups = {};

          const composed = pipe(self.composeCommand, self.composeRemove, self.composeGroup)({ rawCommands: self.rawCommands });
          try {
            Object.entries(composed.command).every(([ name, command ]) => self.validateCommand({ name, command }));
            Object.entries(composed.group).every(([ name, group ]) => self.validateGroup({ name, group }));

            self.commands = composed.command;
            self.groups = composed.group;
          } catch (error) {
            self.apos.util.error('Command-Menu', error.message);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      validateCommand({ name, command }) {
        assert.equal(command.type, 'item', `Invalid command type, must be "item", for ${name}`);
        assert.equal(typeof command.label, 'string', `Invalid command label, must be a string, for ${name} "${typeof command.label}" provided`);
        assert.equal(typeof command.action, 'object', `Invalid command action, must be an object for ${name}`);
        assert.equal(typeof command.action.type, 'string', `Invalid command action type for ${name}`);
        assert.equal(typeof command.action.payload, 'object', `Invalid command action payload for ${name}`);
        if (command.permission) {
          assert.equal(typeof command.permission, 'object', `Invalid command permission for ${name}`);
          assert.equal(typeof command.permission.action, 'string', `Invalid command permission action for ${name}`);
          assert.equal(typeof command.permission.type, 'string', `Invalid command permission type for ${name}`);
        }
        assert.equal(typeof command.modal, 'string', `Invalid command modal for ${name}`);
        assert.equal(typeof command.shortcut, 'string', `Invalid command shortcut, must be a string, for ${name}`);

        return true;
      },
      validateGroup({ name, group }) {
        assert.equal(typeof group.label, 'string', `Invalid group label, must be a string, for ${name}`);
        assert.equal(Array.isArray(group.fields), true, `Invalid command fields, must be an array for ${name}`);
        assert.ok(group.fields.every(field => typeof field === 'string'), `Invalid command fields, must contains strings, for ${name}`);

        return true;
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
        const formatGroups = (state, { group }) => {
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
      getVisibleGroups(req) {
        const commands = Object.fromEntries(
          Object.entries(self.commands)
            .map(([ key, command ]) => {
              return self.isCommandVisible(req, command)
                ? [ key, command ]
                : [];
            })
        );

        const keys = Object.keys(commands);

        return Object.fromEntries(
          Object.entries(self.groups)
            .map(([ key, group ]) => {
              const fields = group.fields
                .filter(field => keys.includes(field))
                .map(field => commands[field]);

              return fields.length
                ? [ key, { ...group, fields } ]
                : [];
            })
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
