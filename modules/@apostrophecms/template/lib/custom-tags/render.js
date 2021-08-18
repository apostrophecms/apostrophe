const util = require('util');

module.exports = (self) => {
  // Create the render input object, used to parse the fragment source
  function createRenderInput(info) {
    const input = {
      ...info.context.ctx
    };
    let i = 0;
    let params = info.params;
    let args = info.args;

    // test for kw parameters and arguments
    let kwparams = info.params.slice(-1)[0] || {};
    let kwargs = info.args.slice(-1)[0] || {};

    // remove kw from the equation
    if (isKwObject(kwparams)) {
      params = info.params.slice(0, -1);
    } else {
      kwparams = {};
    }
    if (isKwObject(kwargs)) {
      args = info.args.slice(0, -1);
    } else {
      kwargs = {};
    }

    // assign positional
    for (const param of params) {
      const arg = args[i];

      // don't assign if no argument is available
      if (typeof arg !== 'undefined') {
        input[param] = arg;
      }

      i++;
    }

    // assign kwparams (defaults) and filter kwargs
    Object.assign(input, kwparams);
    Object.keys(kwparams).forEach((key) => {
      if (typeof kwargs[key] !== 'undefined') {
        input[key] = kwargs[key];
      }
    });

    return input;
  };

  function isKwObject(obj) {
    return obj && typeof obj === 'object' && obj.__keywords === true;
  }

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
