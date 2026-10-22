module.exports = async ({
  app, httpServer, hasHMR, hmrPort
}) => {

  // Esnure we don't share the server if custom HMR port is provided.
  /** @type {import('vite').UserConfig} */
  const config = {
    base: '/__vite',
    server: {
      middlewareMode: (hmrPort && hasHMR)
        ? true
        : {
          server: app
        },
      hmr: hasHMR
        ? {
          server: hmrPort ? null : httpServer,
          port: hmrPort
        }
        : false
    }
  };

  if (!hasHMR) {
    config.server.watch = null;
  }

  return config;
};
