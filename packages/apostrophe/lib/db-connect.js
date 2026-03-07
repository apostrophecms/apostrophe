const mongodbAdapter = require(
  '../modules/@apostrophecms/db/adapters/mongodb.js'
);
const postgresAdapter = require(
  '../modules/@apostrophecms/db/adapters/postgres.js'
);

module.exports = async function(uri, options = {}) {
  // Build adapter map: built-ins first, then custom overrides
  const named = new Map();
  for (const adapter of [
    mongodbAdapter,
    postgresAdapter,
    ...(options.adapters || [])
  ]) {
    named.set(adapter.name, adapter);
  }

  // Match protocol from URI
  const matches = uri.match(/^([^:]+):\/\//);
  if (!matches) {
    throw new Error(`Invalid database URI: ${uri}`);
  }
  const protocol = matches[1];

  for (const adapter of named.values()) {
    if (adapter.protocols.includes(protocol)) {
      return adapter.connect(uri, options);
    }
  }

  throw new Error(
    `No adapter found for protocol: ${protocol}`
  );
};
