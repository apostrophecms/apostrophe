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

const buildModal = ({ source, modal = {} }) => {
  const formatModal = (acc, [ modalName, groups ]) => {
    const built = buildGroup({
      source: {},
      group: groups
    });

    return {
      ...acc,
      [modalName]: built
    };
  };

  return Object.entries(modal).reduce(formatModal, source);
};

const validate = ({
  properties,
  moduleName,
  cascadeName
}) => {
  if (!properties) {
    return;
  }

  const valid = [ 'add', 'remove', 'order', 'group', 'modal' ];
  for (const key of Object.keys(properties)) {
    if (!valid.includes(key)) {
      throw `${moduleName}: ${key} is not valid inside "${cascadeName}".\nPossibly you forgot to nest a field in "add".`;
    }
  }
};

const build = ({
  source,
  properties,
  cascadeName
}) => {
  if (!properties) {
    return source;
  }

  const result = {
    [cascadeName]: (source[cascadeName] && klona(source[cascadeName])) || {},
    [`${cascadeName}Groups`]: (source[`${cascadeName}Groups`] && klona(source[`${cascadeName}Groups`])) || {},
    [`${cascadeName}Modals`]: (source[`${cascadeName}Modals`] && klona(source[`${cascadeName}Modals`])) || {}
  };

  result[cascadeName] = buildAdd({
    source: result[cascadeName],
    add: properties.add
  });
  result[cascadeName] = buildRemove({
    source: result[cascadeName],
    remove: properties.remove
  });
  result[cascadeName] = buildOrder({
    source: result[cascadeName],
    order: properties.order
  });
  result[`${cascadeName}Groups`] = buildGroup({
    source: result[`${cascadeName}Groups`],
    group: properties.group
  });
  result[`${cascadeName}Modals`] = buildModal({
    source: result[`${cascadeName}Modals`],
    modal: properties.modal
  });

  return result;
};

module.exports = {
  validate,
  build
};
