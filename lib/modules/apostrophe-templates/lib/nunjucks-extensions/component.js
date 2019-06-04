// Implements {% component 'moduleName:componentName' with dataObject %}

module.exports = function() {

  this.tags = [ 'component' ];

  this.parse = function(parser, nodes, lexer) {
      // get the tag token
      const token = parser.nextToken();

      var args = new nodes.NodeList(token.lineno, token.colno);

      // get the component name expression
      const name = parser.parseExpression();
      args.addChild(name);
      const w = parser.peekToken();
      if ((w.type === 'symbol') && (w.value === 'with')) {
        parser.nextToken();
        const data = parser.parseExpression();
        args.addChild(data);
      }
      parser.advanceAfterBlockEnd(token.value);
      return new nodes.CallExtensionAsync(this, 'run', args, []);
  };

  this.run = async function(context, name, data, callback) {
    try {
      if (!callback) {
        callback = data;
        data = {};
      }
      const parsed = name.match(/^([^:]+):(.+)$/);
      if (!parsed) {
        return callback(new Error('When using {% component %} the component name must be a string like: module-name:componentName'));
      }
      const [ dummy, moduleName, componentName ] = parsed;
      const apos = context.env.opts.apos;
      const module = apos.modules[moduleName];
      if (!module) {
        return callback(new Error('{% component %} was invoked with the name of a module that does not exist. Hint:\nit must be a module that is actually live in your project, not a base class\nlike apostrophe-pieces.'));
      }
      const req = context.env.opts.req;
      if (!module.components[componentName]) {
        return callback(new Error('{% component %} was invoked with the name of a component that does not exist in ' + moduleName + '. Hint: you must register components with .addComponent("name", fn).'));
      }
      const input = await module.components[componentName](req, data);
      const result = await module.render(req, componentName, input);
      return callback(null, apos.templates.safe(result));
    } catch(e) {
      return callback(e);
    }
  };

};

