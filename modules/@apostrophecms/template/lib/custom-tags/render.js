const util = require('util');
const _ = require('lodash');

module.exports = (self) => {
  // Create the render input object, used to parse the fragment source
  function createRenderInput(info) {
    const input = {
      ...info.context.ctx
    };
    let i = 0;
    let kwparams = null;
    for (const param of info.params) {
      // Grab kw param if available, it's the last one
      if (param && typeof param !== 'string' && param.__keywords === true) {
        kwparams = param;
        break;
      }
      // loop through everything (because kwargs are always last) and don't assign if
      // no argument is provided
      if (typeof info.args[i] !== 'undefined') {
        input[param] = info.args[i];
      }
      i++;
    }

    // Deal with kwargs
    if (kwparams) {
      // Those are the defaults
      Object.assign(input, kwparams);
      // Those are the passed arguments
      // and they are ALWAYS the last array item
      const kwargs = info.args[info.args.length - 1];
      // Be sure it's an object!
      if (kwargs && _.isPlainObject(kwargs) && kwargs.__keywords === true) {
        Object.assign(input, kwargs);
      }
    }
    return input;
  };

  // `parse` factory for `render` and `rendercall`
  const parseRenderFactory = (hasBody = false) => function parse(parser, nodes, lexer) {
    try {
      // get the tag token
      const token = parser.nextToken();
      const args = new nodes.NodeList(token.lineno, token.colno);

      // parse function name and arguments
      const invocation = parser.parsePrimary();
      args.addChild(invocation);
      parser.advanceAfterBlockEnd(token.value);

      // get the body if it's `rendercall` block
      if (hasBody) {
        const body = parser.parseUntilBlocks('end' + token.value);
        parser.advanceAfterBlockEnd();

        return {
          args,
          blocks: [ body ]
        };
      }

      return { args };
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // `run` factory for `render` and `rendercall`
  const runRenderFactory = (hasBody = false) => async function run(context, ...rest) {
    try {
      // A `noop` function for `rendercaller`
      let rendercaller = () => '';
      if (hasBody) {
        // wait for the body to be parsed to a string and let caller return safe string
        const renderBody = await util.promisify(rest.pop())();
        rendercaller = () => self.safe(renderBody);
      }

      const info = rest.pop();
      const source = info.body();
      const input = createRenderInput(info);

      const req = context.env.opts.req;
      const env = self.getEnv(req, context.env.opts.module);
      input.apos = self.templateApos;
      input.__ = req.res.__;
      // attach the render caller as a function
      // it's just a string, but we keep
      // the convention from the macro `call`
      input.rendercaller = rendercaller;

      const result = await require('util').promisify((s, args, callback) => {
        return env.renderString(s, args, callback);
      })(source, input);
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return {
    render: {
      parse: parseRenderFactory(),
      run: runRenderFactory()
    },

    rendercall: {
      parse: parseRenderFactory(true),
      run: runRenderFactory(true)
    }
  };
};
