module.exports = self => {
  return {
    get: {
      // This route serves the existing styles stylesheet,
      // constructed from the global object
      // We do it this way so the browser can cache the styles as often as possible
      stylesheet(req) {
        req.res.setHeader('Content-Type', 'text/css');
        req.res.setHeader('Cache-Control', 'public, max-age=31557600');
        return req.data.global.stylesStylesheet;
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

        return self.getStylesheet(piece).css;
      }
    }
  };
};
