module.exports = self => {
  return {
    get: {
      // This route serves the existing styles stylesheet,
      // constructed from the global object.
      // We do it this way so the browser can cache the styles as often as possible.
      //
      // The locale-qualified alias (`stylesheet/locale/:locale/:mode`)
      // produces a distinct path per locale so that static-build
      // tools that key on the URL path (e.g. Astro) don't
      // overwrite one locale's stylesheet with another's.
      stylesheet(req) {
        return self.serveStylesheet(req);
      },
      'stylesheet/locale/:locale/:mode': async function(req) {
        const { locale, mode } = req.params;
        if (!locale || !self.apos.i18n.isValidLocale(locale)) {
          throw self.apos.error('invalid');
        }
        const validModes = [ 'published', 'draft' ];
        const safeMode = validModes.includes(mode) ? mode : 'published';
        if (safeMode === 'draft' && !self.apos.permission.can(req, 'view-draft')) {
          throw self.apos.error('forbidden');
        }
        req.locale = locale;
        req.mode = safeMode;
        // Force re-fetch global for the correct locale
        delete req.data.global;
        await self.apos.global.addGlobalToData(req);
        return self.serveStylesheet(req);
      }
    },
    post: {
      async render(req) {
        // Basic check to avoid DOS attacks via the renderer, nothing actually
        // saves on these calls
        if (!req.user) {
          throw self.apos.error('forbidden');
        }
        const piece = {};
        await self.convert(req, req.body.data, piece);

        req.res.setHeader('Content-Type', 'text/css');

        return self.getStylesheet(piece);
      }
    }
  };
};
