module.exports = {
  construct: function(self, options) {
    if (self.apos.modules['apostrophe-i18n'].options.tooltips) {
      self.pushAsset('script', 'user');
      self.pushAsset('stylesheet', 'user');
      self.expressMiddleware = function(req, res, next) {
        if (req.query.i18nTooltips === '1') {
          req.session.i18nTooltipsActive = true;
        } else if (req.query.i18nTooltips === '0') {
          req.session.i18nTooltipsActive = false;
        }
        if (req.query.i18nTooltips && req.query.i18nTooltips.length) {
          return res.redirect(self.apos.urls.build(req.url, { i18nTooltips: null }));
        }
        return next();
      };
      self.menu = function(req) {
        if (!req.user) {
          return '';
        }
        return self.partial('menu', { active: req.session.i18nTooltipsActive });
      };
      self.apiRoute('post', 'fetch', function(req, res, next) {
        return next(null, {
          tooltips: req.session.i18nTooltips || {}
        });
      });
      self.apos.pages.addAfterContextMenu(self.menu);
      var superI18n = self.apos.templates.i18n;
      self.apos.templates.i18n = function(req, name, key) {
        req.session.i18nTooltips = req.session.i18nTooltips || {};
        var s = superI18n.apply(null, Array.prototype.slice.call(arguments));
        req.session.i18nTooltips[s] = key;
        return '⸨' + s + '⸩';
      };
    }
  }
};
