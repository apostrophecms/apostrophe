module.exports = {
  improve: '@apostrophecms/template',
  extendMethods(self) {
    return {
      getRenderArgs(_super, req, data, module) {
        const args = _super(req, data, module);
        req.nonce = req.nonce || self.apos.util.generateId();
        args.nonce = req.nonce;
        return args;
      }
    };
  }
};
