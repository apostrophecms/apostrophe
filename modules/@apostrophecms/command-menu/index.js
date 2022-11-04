const { klona } = require('klona');
const pipe = (...functions) => (initial) => functions.reduce((accumulator, current) => current(accumulator), initial);

module.exports = {
  options: {
    alias: 'commandMenu'
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        composeCommands() {
          // self.rawCommands = Object.values(self.apos.modules)
          //   .reduce(
          //     (acc, aposModule) => {
          //       // TODO self.apos.util.helpers.merge is used here as an example, the final implementation will use another
          //       // deep merge method
          //       return self.apos.util.helpers.merge(acc, ...self.composeCommandsForModule(aposModule));
          //     },
          //     {
          //       commands: {},
          //       groups: {},
          //       remove: {},
          //       order: {}
          //     }
          //   );

          // self.commands = pipe(self.order, self.remove, self.group)(self.rawCommands);
        }
      }
    };
  },
  methods(self) {
    return {
      composeRemove(initialState, commands) {
        const concatenate = []
          .concat(...commands.map(command => command.remove))
          .filter(isNotEmpty => isNotEmpty);

        return {
          ...initialState,
          remove: concatenate
        };
      },
      composeGroup(initialState, commands) {
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

        return commands.reduce(formatGroups, initialState);
      },
      composeCommand(initialState, commands) {
        const concatenate = []
          .concat(...commands.map(command => command.add))
          .filter(isNotEmpty => isNotEmpty);

        return {
          ...initialState,
          commands: concatenate
            .reduce(
              (acc, command) => ({
                ...acc,
                ...command
              }),
              {}
            )
        };
        // const formatCommands = (state, { add }) => {
        //   return Object.entries(add)
        //     .reduce(
        //       (commands, [ name, attributes ]) => {
        //         return {
        //           ...commands,
        //           [name]: {
        //             ...attributes
        //           }
        //         };
        //       },
        //       state
        //     );
        // };

        // return commands.reduce(formatCommands, initialState);
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
