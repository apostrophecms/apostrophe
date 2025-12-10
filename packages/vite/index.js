const fs = require('fs-extra');
const internalLib = require('./lib/internals.js');

module.exports = {
  before: '@apostrophecms/asset',
  i18n: {
    aposVite: {}
  },
  async init(self) {
    self.buildSourceFolderName = 'src';
    self.distFolderName = 'dist';
    self.buildRoot = null;
    self.buildRootSource = null;
    self.distRoot = null;
    self.buildManifestPath = null;

    // Cached metadata for the current run
    self.currentSourceMeta = null;
    self.entrypointsManifest = [];

    // Populated after a build has been triggered
    self.buildOptions = {};
    self.viteDevInstance = null;
    self.shouldCreateDevServer = false;

    // Populated when a watch is triggered
    // UI folder -> index
    self.currentSourceUiIndex = {};
    // /absolute/path -> index
    self.currentSourceFsIndex = {};
    // ui/relative/path/file -> [ index1, index2 ]
    self.currentSourceRelIndex = new Map();

    // IMPORTANT: This should not be removed.
    // Vite depends on both process.env.NODE_ENV and the `mode` config option.
    // They should be in sync and ALWAYS set. We need to patch the environment
    // and ensure it's set here.
    // Read more at https://vite.dev/guide/env-and-mode.html#node-env-and-modes
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development';
    }
  },

  handlers(self) {
    return {
      '@apostrophecms/asset:afterInit': {
        async registerExternalBuild() {
          self.apos.asset.configureBuildModule(self, {
            alias: 'vite',
            devServer: true,
            hmr: true
          });
          await self.initWhenReady();
        }
      },
      '@apostrophecms/express:afterListen': {
        async prepareViteDevServer() {
          if (self.shouldCreateDevServer) {
            await self.createViteInstance(self.buildOptions);
          }
        }
      },
      'apostrophe:destroy': {
        async destroyBuildWatcher() {
          if (self.viteDevInstance) {
            await self.viteDevInstance.close();
            self.viteDevInstance = null;
          }
        }
      }
    };
  },

  middleware(self) {
    if (process.env.NODE_ENV === 'production') {
      return {};
    }
    return {
      viteDevServer: {
        before: '@apostrophecms/express',
        url: '/__vite',
        middleware: async (req, res, next) => {
          if (!self.shouldCreateDevServer || !self.viteDevInstance) {
            return res.status(403).send('forbidden');
          }

          // Intercept 403 responses to provide helpful error messages
          // for host validation issues
          const originalWriteHead = res.writeHead;
          const hostname = req.headers.host;

          res.writeHead = function(code, ...args) {
            if (
              code === 403 &&
              hostname &&
              !self.isHostnameAllowed(
                hostname,
                self.viteDevInstance?.config?.server?.allowedHosts
              )
            ) {
              const hostnameWithoutPort = hostname.includes('[')
                ? hostname.split(']')[0] + ']'
                : hostname.split(':')[0];
              self.apos.util.warnDevOnce(
                'vite-dev-server-host-validation',
                'Vite dev server blocked a request from hostname: ' + hostname + '\n' +
                  '   This hostname is not in the allowed hosts list.\n' +
                  '   To fix this, add the hostname to your Vite configuration:\n\n' +
                  '   // apos.vite.config.js\n' +
                  '   import { defineConfig } from \'@apostrophecms/vite/vite\';\n\n' +
                  '   export default defineConfig({\n' +
                  '     server: {\n' +
                  '       allowedHosts: [\'' + hostnameWithoutPort + '\', \'localhost\']\n' +
                  '     }\n' +
                  '   });\n'
              );
            }
            return originalWriteHead.apply(this, [ code, ...args ]);
          };

          // Do not provide `next` to the middleware, we want to stop the chain here
          // if the request is handled by Vite. It provides its own 404 handler.
          self.viteDevInstance.middlewares(req, res);
        }
      }
    };
  },

  methods(self) {
    return {
      // see @apostrophecms/assset:getBuildOptions() for the options shape.
      // A required interface for the asset module.
      async build(options = {}) {
        self.printDebug('build-options', { buildOptions: options });
        self.buildOptions = options;
        await self.buildBefore(options);

        await self.buildPublic(options);
        const ts = await self.buildApos(options);

        const viteManifest = await self.getViteBuildManifest();
        self.entrypointsManifest = await self.applyManifest(
          self.entrypointsManifest, viteManifest
        );
        return {
          entrypoints: self.entrypointsManifest,
          sourceMapsRoot: self.distRoot,
          devServerUrl: null,
          ts
        };
      },
      // A required interface for the asset module.
      async startDevServer(options) {
        self.printDebug('dev-server-build-options', { buildOptions: options });
        self.buildOptions = options;
        self.shouldCreateDevServer = true;
        await self.buildBefore(options);

        const {
          scenes: currentScenes,
          build: currentBuild
        } = self.getCurrentMode(options.devServer);

        self.ensureViteClientEntry(self.entrypointsManifest, currentScenes, options);

        let ts;
        if (currentBuild === 'public') {
          await self.buildPublic(options);
        }
        if (currentBuild === 'apos') {
          ts = await self.buildApos(options);
        }

        const viteManifest = await self.getViteBuildManifest(currentBuild);
        self.entrypointsManifest = await self.applyManifest(
          self.entrypointsManifest, viteManifest
        );

        return {
          entrypoints: self.entrypointsManifest,
          hmrTypes: [ ...new Set(
            self.getBuildEntrypointsFor(options.devServer)
              .map((entry) => entry.type)
          ) ],
          ts,
          devServerUrl: self.getDevServerUrl()
        };
      },
      // A required interface for the asset module.
      // Initialize the watcher for triggering vite HMR via file
      // copy to the build source. This method is called always
      // after the `startDevServer` method.
      // `chokidar` is a chockidar `FSWatcher` or compatible instance.
      async watch(chokidar, buildOptions) {
        self.printDebug('watch-build-options', { buildOptions });
        self.buildWatchIndex();
        // Initialize our voting system to detect what entrypoints
        // are concerned with a given source file change.
        self.setWatchVoters(
          self.getBuildEntrypointsFor(buildOptions.devServer)
        );

        chokidar
          .on('add', (p) => self.onSourceAdd(p, false))
          .on('addDir', (p) => self.onSourceAdd(p, true))
          .on('change', (p) => self.onSourceChange(p))
          .on('unlink', (p) => self.onSourceUnlink(p, false))
          .on('unlinkDir', (p) => self.onSourceUnlink(p, true));
      },
      // A required interface for the asset module.
      // This method is called when build and watch are not triggered.
      // Enhance and return any entrypoints that are included in the manifest
      // when an actual build/devServer is triggered.
      // The options are same as the ones provided in the `build` and
      // `startDevServer` methods.
      async entrypoints(options) {
        self.printDebug('entrypoints-build-options', { buildOptions: options });
        const entrypoints = self.apos.asset.getBuildEntrypoints(options.types)
          .filter(entrypoint => entrypoint.condition !== 'nomodule');

        self.ensureInitEntry(entrypoints);

        if (options.devServer) {
          const { scenes } = self.getCurrentMode(options.devServer);
          self.ensureViteClientEntry(entrypoints, scenes, options);
        }

        return entrypoints;
      },
      // A required interface for the asset module.
      async clearCache() {
        await fs.remove(self.cacheDirBase);
      },
      // A required interface for the asset module.
      async reset() {
        await fs.remove(self.buildRoot);
        await fs.mkdir(self.buildRoot, { recursive: true });
      },
      // Check if a hostname is allowed based on Vite's allowedHosts configuration
      // Implements the same logic as Vite's host validation
      isHostnameAllowed(hostname, allowedHosts) {
        if (!hostname) {
          return true;
        }

        if (allowedHosts === true) {
          return true;
        }

        const hostWithoutPort = parseHostname(hostname);
        if (!hostWithoutPort) {
          return false;
        }

        // If allowedHosts is not set, Vite allows localhost and 127.0.0.1
        if (!allowedHosts) {
          return [ 'localhost', '127.0.0.1', '::1' ].includes(hostWithoutPort);
        }

        // Check if hostname matches any allowed host pattern.
        // Normalize by removing square brackets for IPv6 addresses,
        // the same as done in the parseHostname.
        return allowedHosts.some(allowedHost => {
          allowedHost = allowedHost.replace(/^\[|\]$/g, '');
          // Exact match
          if (allowedHost === hostWithoutPort) {
            return true;
          }
          // Wildcard pattern (e.g., '.example.com')
          if (allowedHost.startsWith('.')) {
            return hostWithoutPort.endsWith(allowedHost) ||
                   hostWithoutPort === allowedHost.slice(1);
          }
          return false;
        });

        function parseHostname(hostname) {
          try {
            const { hostname: parsedHostname } = new URL(
              `https://${hostname}`
            );
            return parsedHostname.replace(/^\[|\]$/g, '');
          } catch (e) {
            self.logWarn(
              'parse-hostname-failed',
              `Failed to parse hostname: ${hostname}`,
              {
                hostname,
                error: e.message,
                stack: e.stack.split('\n').slice(1).map(line => line.trim())
              }
            );
            return null;
          }
        }
      },
      // Internal implementation.
      ...internalLib(self)
    };
  }
};
