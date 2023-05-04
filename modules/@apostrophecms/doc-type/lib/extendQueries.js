module.exports = extendQueries;

function extendQueries(queries, extensions) {
  for (const [ name, fn ] of Object.entries(extensions)) {
    if (typeof fn === 'object' && !Array.isArray(fn) && fn !== null) {
      // Nested structure is allowed
      queries[name] = queries[name] || {};
      return extendQueries(queries[name], fn);
    }

    if (typeof fn !== 'function' || typeof queries[name] !== 'function') {
      queries[name] = fn;
      continue;
    }

    const superMethod = queries[name];
    queries[name] = function(...args) {
      return fn(superMethod, ...args);
    };
  }
};
