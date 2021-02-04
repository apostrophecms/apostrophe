module.exports = (self, options) => {
  return {
    parse(parser, nodes, lexer) {
      try {
        // get the tag token
        const token = parser.nextToken();
        const args = new nodes.NodeList(token.lineno, token.colno);
        // TODO this only allows a simple name, we need
        // to permit at least a dotted expression to
        // accommodate imports. We can't parse it as an
        // expression because that would invoke it
        // as a function with the args
        const invocation = parser.parsePrimary();
        args.addChild(invocation);
        parser.advanceAfterBlockEnd(token.value);
        return { args };
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    async run(context, info) {
      try {
        const req = context.env.opts.req;
        const input = {};
        let i = 0;
        for (const param of info.params) {
          if (i === info.args.length) {
            break;
          }
          input[param] = info.args[i];
          i++;
        }
        const body = info.body();

        const env = self.getEnv(req, context.env.opts.module);

        input.apos = self.templateApos;
        input.__ = req.res.__;

        const result = await require('util').promisify((s, args, callback) => {
          return env.renderString(s, args, callback);
        })(body, input);
        return result;
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  };
};
