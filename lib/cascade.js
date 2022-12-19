const { klona } = require('klona');

const buildAdd = ({ source, add = {} }) => {
  return {
    ...source,
    ...add
  };
};

const buildRemove = ({ source, remove = [] }) => {
  return Object.fromEntries(
    Object.entries(source).filter(([ key ]) => !remove.includes(key))
  );
};

const buildOrder = ({ source, order = [] }) => {
  const first = order.map(key => [ key, source[key] ]);
  const last = Object.entries(source)
    .filter(([ key, value ]) => value.last === true && !order.includes(key));
  const lastKeys = last.map(([ key ]) => key);
  const rest = Object.entries(source)
    .filter(([ key ]) => !order.includes(key) && !lastKeys.includes(key));

  return Object.fromEntries(
    [].concat(first, rest, last)
  );
};

const buildGroup = ({ source, group = {} }) => {
  if (!Object.keys(group).length) {
    return source;
  }

  // create source by removing all fields in source.*.fields|commands that exists in fields|commands
  const formatSource = ({
    fields,
    commands
  }) => (acc, [ key, value ]) => {
    return {
      ...acc,
      [key]: {
        ...value,
        ...(fields.length && { fields: value.fields.filter(field => !fields.includes(field)) }),
        ...(commands.length && { commands: value.commands.filter(command => !commands.includes(command)) })
      }
    };
  };

  // create group candidate by merging group with existing state group
  const formatGroup = (state) => (acc, [ key, value ]) => {
    return {
      ...acc,
      [key]: {
        ...value,
        ...(value.fields && { fields: (state[key]?.fields || []).concat(value.fields) }),
        ...(value.commands && { commands: (state[key]?.commands || []).concat(value.commands) }),
        ...((value.label || state[key]?.label) && { label: value.label || state[key]?.label })
      }
    };
  };

  const groupFields = Object.values(group).flatMap(({ fields = [] }) => fields);
  const groupCommands = Object.values(group).flatMap(({ commands = [] }) => commands);
  const state = Object.entries(source)
    .reduce(
      formatSource({
        fields: groupFields,
        commands: groupCommands
      }),
      {}
    );
  const groupCandidate = Object.entries(group).reduce(formatGroup(state), {});

  return {
    ...state,
    ...groupCandidate
  };
};

const buildGroupLegacy = ({ source, group = {} }) => {
  console.log(source, group);
  if (Object.keys(group).length) {
    const groups = klona(source);
    for (const value of Object.values(group)) {
      for (const field of value.fields || []) {
        // Remove fields from existing groups if they're added to a new
        // group.
        for (const val of Object.values(groups)) {
          if (val.fields && val.fields.includes(field)) {
            val.fields = val.fields.filter(_field => _field !== field);
          }
        }
      }
    }

    // Combine groups of the same name now that inherited groups are
    // filtered
    for (const [ key, value ] of Object.entries(group)) {
      if (groups[key] && Array.isArray(groups[key].fields)) {
        value.fields = groups[key].fields.concat(value.fields);
        value.label = value.label || groups[key].label;
      }
    }

    console.log({ ...groups, ...klona(group) });
    return {
      ...groups,
      ...klona(group)
    };
  }

  return source;
};

const cascade = ({
  steps,
  validKeys,
  upgradeHints,
  clarifyModuleName,
  options,
  that
}) => {
  const result = {};

  let cascades = [];
  for (const step of steps) {
    if (step.cascades) {
      cascades = cascades.concat(step.cascades);
    }
    for (const key of Object.keys(step)) {
      if (!(validKeys.includes(key) || cascades.includes(key))) {
        const message = upgradeHints[key] || `${key} is not a valid top level property for an Apostrophe 3.x module. Make sure you nest regular module options in the new "options" property.`;
        throw `${clarifyModuleName(step.__meta.name)}: ${message}`;
      }
    }

    for (const cascade of cascades) {
      if (!result[cascade]) {
        result[cascade] = {};
      }
      if (!result[`${cascade}Groups`]) {
        result[`${cascade}Groups`] = {};
      }
      // You can have access to options within a function, if you choose to provide one
      const properties = ((typeof step[cascade]) === 'function')
        ? step[cascade](
          Object.assign(that, result), // TODO mutation problem to be fixed
          options
        )
        : step[cascade];
      if (properties) {
        const valid = [ 'add', 'remove', 'order', 'group', 'modal' ];
        for (const key of Object.keys(properties)) {
          if (!valid.includes(key)) {
            throw `${clarifyModuleName(step.__meta.name)}: ${key} is not valid inside "${cascade}".\nPossibly you forgot to nest a field in "add".`;
          }
        }

        result[cascade] = buildAdd({ source: result[cascade], add: properties.add });
        result[cascade] = buildRemove({ source: result[cascade], remove: properties.remove });
        result[cascade] = buildOrder({ source: result[cascade], order: properties.order });
        // console.log('source', result[`${cascade}Groups`], properties.group);
        result[`${cascade}Groups`] = buildGroup({ source: result[`${cascade}Groups`], group: properties.group });
        // TODO build modal with nested groups
        // result[`${cascade}Groups`] = buildGroupLegacy({ source: result[`${cascade}Groups`], group: properties.group });
        // console.log('after', result[`${cascade}Groups`]);
      }
    }
  }

  return result;
};

module.exports = cascade;
