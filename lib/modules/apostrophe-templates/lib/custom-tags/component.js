// Implements {% component 'moduleName:componentName' with dataObject %}

module.exports = function(self, options) {
  return {
    // We need a custom parser because of the "with" syntax
    parse(parser, nodes, lexer) {
      // get the tag token
      console.log('**** parsing');
      const token = parser.nextToken();

      const args = new nodes.NodeList(token.lineno, token.colno);

      // get the component name expression
      const name = parser.parseExpression();
      args.addChild(name);
      const w = parser.peekToken();
      if ((w.type === 'symbol') && (w.value === 'with')) {
        parser.nextToken();
        const data = parser.parseExpression();
        args.addChild(data);
      }
      console.log('**** before advance');
      parser.advanceAfterBlockEnd(token.value);
      console.log('****', args);
      return args;
    },
    // Do the actual work
    async run(req, name, data) {
      console.log('**** in run');
      if (!data) {
        data = {};
      }
      const parsed = name.match(/^([^:]+):(.+)$/);
      if (!parsed) {
        throw new Error('When using {% component %} the component name must be a string like: module-name:componentName');
      }
      const [ dummy, moduleName, componentName ] = parsed;
      const module = self.apos.modules[moduleName];
      if (!module) {
        throw new Error('{% component %} was invoked with the name of a module that does not exist. Hint:\nit must be a module that is actually live in your project, not a base class\nlike apostrophe-pieces.');
      }
      if (!module.components[componentName]) {
        throw new Error('{% component %} was invoked with the name of a component that does not exist in ' + moduleName + '. Hint: you must register components with .addComponent("name", fn).');
      }
      const input = await module.components[componentName](req, data);
      return module.render(req, componentName, input);
    }
  };
};

