module.exports = {
  improve: '@apostrophecms/login',
  extendMethods(self) {
    return {
      // With the regular login page turned off, login has moved to the
      // strategies: say where (see `getSiteLoginUrl` in passport-bridge)
      getLoginUrl(_super) {
        const url = _super();
        if (url) {
          return url;
        }
        const bridge = self.apos.modules['@apostrophecms/passport-bridge'];
        return bridge ? bridge.getSiteLoginUrl() : null;
      }
    };
  }
};
