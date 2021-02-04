module.exports = (self, options) => {
  return {
    parse(parser, nodes, lexer) {
      try {
        // get the tag token
        const token = parser.nextToken();
        // TODO this only allows a simple name, we need
        // to permit at least a dotted expression to
        // accommodate imports. We can't parse it as an
        // expression because that would invoke it
        // as a function with the args
        const name = parser.parsePrimary(true);
        const args = parser.parseSignature();
        args.addChild(new nodes.Literal(name.lineno, name.colno, name.value));
        parser.advanceAfterBlockEnd(token.value);
        return { args };
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    async run(context, ...args) {
      try {
        // const args = invocation.args;
        const req = context.env.opts.req;
        const name = args.pop();
        const fragment = context.getVariables()[name];
        if ((!fragment) || (!fragment.body)) {
          throw new Error(`Invoked undefined template fragment ${name}`);
        }
        const input = {};
        let i = 0;
        for (const arg of fragment.args) {
          if (i === args.length) {
            break;
          }
          input[arg] = args[i];
          i++;
        }
        const body = fragment.body();

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
