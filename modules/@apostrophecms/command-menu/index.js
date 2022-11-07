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

          const composed = pipe(self.composeCommand, self.composeRemove, self.composeGroup)({ rawCommands: self.rawCommands });
          self.commands = composed.command;
          self.groups = composed.group;
        }
      }
    };
  },
  methods(self) {
    return {
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
      getBrowserData() {
        return {
          commands: self.commands // TODO filter entries using self.apos.permissions.can
        };
      }
    };
  }
};
