module.exports = {
  extend: '@apostrophecms/doc-type',
  extendMethods(self) {
    return {
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).type(false);
      }
    };
  }
};
