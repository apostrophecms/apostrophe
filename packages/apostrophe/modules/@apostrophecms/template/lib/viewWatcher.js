// File-watching for view directories shared by Nunjucks and JSX.
//
// Owns one chokidar watcher per directory and dispatches change events to
// any number of registered handlers. The template module wires this up at
// init time with two handlers: clear every Nunjucks loader's cache, and
// invalidate compiled `.jsx` modules so the next render reloads them.
//
// WSL safety: chokidar's underlying file events are unreliable on WSL, so
// we deliberately skip watching there — same behavior as the previous
// in-loader code. Developers running on WSL will need to restart to pick
// up template edits, but the rest of Apostrophe still functions.
//
// Returns a methods mixin compatible with `@apostrophecms/module`'s
// `methods` factory pattern, the same way `bundlesLoader` and `jsxRender`
// are mixed in.

const fs = require('fs');
const chokidar = require('chokidar');
const isWsl = require('is-wsl');

module.exports = (self) => {
  // Lazily-allocated state. Lives on `self` so it survives across method
  // calls and can be inspected by tests if needed.
  if (!self._viewWatchers) {
    self._viewWatchers = [];
  }
  if (!self._viewWatchedDirs) {
    self._viewWatchedDirs = new Set();
  }
  if (!self._viewChangeHandlers) {
    self._viewChangeHandlers = [];
  }

  return {
    // Begin watching the supplied directories for change events. Idempotent
    // per absolute path: subsequent calls with the same dir do not create
    // duplicate watchers. Honors the WSL skip flag and the loader's
    // `noWatch` option (templates module exposes this via
    // `options.loader.noWatch`).
    watchViewFolders(dirs) {
      if (self.options.loader && self.options.loader.noWatch) {
        return;
      }
      // chokidar's recursive watching is not reliable on WSL; preserve the
      // historical behavior of skipping watch setup entirely there.
      if (isWsl) {
        return;
      }
      for (const dir of dirs) {
        if (self._viewWatchedDirs.has(dir)) {
          continue;
        }
        if (!fs.existsSync(dir)) {
          continue;
        }
        self._viewWatchedDirs.add(dir);
        try {
          const watcher = chokidar.watch(dir);
          watcher.on('change', (filePath) => {
            for (const handler of self._viewChangeHandlers) {
              try {
                handler(filePath);
              } catch (e) {
                self.apos.util.error(e);
              }
            }
          });
          self._viewWatchers.push(watcher);
        } catch (e) {
          // Don't crash in broken environments. Warn at most once so the
          // logs don't get spammed for every dir we fail to watch.
          if (!self._viewFirstWatchFailure) {
            self._viewFirstWatchFailure = true;
            self.apos.util.warn(
              'WARNING: fs.watch does not work on this system. That is OK but you\n' +
              'will have to restart to see any template changes take effect.'
            );
          }
          self.apos.util.error(e);
        }
      }
    },

    // Register a callback invoked with the absolute path of the changed
    // file every time chokidar reports a `change` event. Handlers run in
    // registration order. Errors thrown by a handler are logged but never
    // stop other handlers from running.
    onViewChange(handler) {
      self._viewChangeHandlers.push(handler);
    },

    // Tear down every chokidar watcher created via `watchViewFolders`.
    // Called from the `apostrophe:destroy` handler so a process that
    // builds and tears down multiple Apostrophe instances (tests, the
    // multisite harness) doesn't leak file descriptors.
    async closeViewWatchers() {
      const watchers = self._viewWatchers.splice(0, self._viewWatchers.length);
      self._viewWatchedDirs.clear();
      for (const watcher of watchers) {
        try {
          await watcher.close();
        } catch (e) {
          self.apos.util.error(e);
        }
      }
    }
  };
};
