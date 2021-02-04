module.exports = (self, options) => {
  return {
    async run(context, name, ...args) {
      const req = context.env.opts.req;
      const program = req.aposPrograms && req.aposPrograms[name];
      console.log('ARGUMENTS IN RUN:', arguments);
      if (!program) {
        throw new Error(`Invoked undefined template program ${name}`);
      }
      const input = {};
      let i = 0;
      for (const arg of program.args) {
        if (i === args.length) {
          break;
        }
        input[arg] = args[i];
        i++;
      }
      const body = program.body();

      const env = self.getEnv(req, context.env.opts.module);

      console.log('input is:', input);
      input.apos = self.templateApos;
      input.__ = req.res.__;

      const result = await require('util').promisify((s, args, callback) => {
        return env.renderString(s, args, callback);
      })(body, input);
      return result;
    }
  };
};
