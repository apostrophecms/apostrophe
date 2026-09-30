// Compiles Apostrophe `.jsx` template files via Babel and registers a
// `require.extensions['.jsx']` hook so they can be loaded with `require()`
// (and `import` after CommonJS transformation) just like normal modules.
//
// Each compiled module is automatically prefixed with a `require()` of our
// JSX runtime so the `h` and `Fragment` identifiers produced by the Babel
// transform resolve without the user importing them. Both `import` and
// `require` work inside `.jsx` files because the CommonJS transform also
// runs.
//
// Source maps are kept in memory and wired through `source-map-support`,
// which means stack traces from a JSX template point at the original
// `views/page.jsx` line/column rather than the compiled output.

const fs = require('fs');
const Module = require('module');
const babel = require('@babel/core');
const sourceMapSupport = require('source-map-support');

const runtimePath = require.resolve('./jsxRuntime.js');

const sourceMaps = new Map();
let installed = false;

// Idempotent: register the require hook + source-map handler once per
// process even if multiple Apostrophe instances boot in the same Node
// process (e.g. tests, multisite).
function install() {
  if (installed) {
    return;
  }
  installed = true;

  sourceMapSupport.install({
    environment: 'node',
    hookRequire: false,
    handleUncaughtExceptions: false,
    retrieveSourceMap(filename) {
      const map = sourceMaps.get(filename);
      if (!map) {
        return null;
      }
      return {
        url: filename,
        map
      };
    }
  });

  Module._extensions['.jsx'] = function(module, filename) {
    const src = fs.readFileSync(filename, 'utf-8');
    const compiled = compile(src, filename);
    sourceMaps.set(filename, compiled.map);
    module._compile(compiled.code, filename);
  };
}

// Compile a JSX source string for `filename`. Returns `{ code, map }`.
// `code` is CommonJS-compatible JS with our runtime injected at the top.
function compile(src, filename) {
  let result;
  try {
    result = babel.transformSync(src, {
      filename,
      sourceMaps: true,
      sourceFileName: filename,
      babelrc: false,
      configFile: false,
      compact: false,
      plugins: [
        [
          require.resolve('@babel/plugin-transform-react-jsx'),
          {
            pragma: '__aposJsx.h',
            pragmaFrag: '__aposJsx.Fragment',
            useBuiltIns: false,
            throwIfNamespace: false
          }
        ],
        require.resolve('@babel/plugin-transform-modules-commonjs')
      ]
    });
  } catch (e) {
    // Babel errors already include code frames pointing at the offending
    // line/column. Preserve that detail and add the file path for clarity.
    const err = new Error(`JSX compile error in ${filename}: ${e.message}`);
    err.cause = e;
    err.code = 'APOS_JSX_COMPILE_ERROR';
    err.filename = filename;
    throw err;
  }

  // Inject runtime references. Using a single `__aposJsx` namespace avoids
  // colliding with user variables named `h` or `Fragment` while still
  // matching the pragma we passed to Babel above. Source maps remain valid
  // because we only prepend a single line and rely on a leading `\n` to
  // keep line numbers stable.
  const prefix = `var __aposJsx = require(${JSON.stringify(runtimePath)});\n`;
  return {
    code: prefix + result.code,
    map: result.map
  };
}

// Drop a single .jsx file from the require cache and our source-map cache.
// Called by the template module's chokidar watcher when a JSX file changes,
// so the next render picks up the new code without restarting the process.
function invalidate(filename) {
  sourceMaps.delete(filename);
  delete Module._cache[filename];
}

// Drop every cached .jsx module and source map. Used when watcher events
// don't carry a specific path or when an unknown view file was modified.
function invalidateAll() {
  for (const filename of sourceMaps.keys()) {
    delete Module._cache[filename];
  }
  sourceMaps.clear();
}

module.exports = {
  install,
  compile,
  invalidate,
  invalidateAll,
  runtimePath
};
