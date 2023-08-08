module.exports = {
  extend: '@apostrophecms/doc-type',
  extendMethods(self) {
    return {
      find(_super, req, criteria, options) {
        return _super(req, criteria, options).type(false);
      }
    };
  }
};
