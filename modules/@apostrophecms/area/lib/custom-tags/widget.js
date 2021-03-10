// Implements {% widget item, { options ...} %}
// Usually not called directly, see {% singleton %} and {% area %}

module.exports = function(self) {

  return {
    // We need a custom parser because of the "with" syntax
    parse(parser, nodes, lexer) {
      // get the tag token
      const token = parser.nextToken();

      const args = new nodes.NodeList(token.lineno, token.colno);
      let argsCount = 0;

      while (true) {
        // get the arguments before "with"
        const object = parser.parseExpression();

        if (argsCount < 2) {
          args.addChild(object);
          argsCount++;
        } else {
          throw new Error('Too many arguments were passed to the widget tag before the "with" keyword.');
        }

        const w = parser.peekToken();
        if (!(w.type === 'comma')) {
          break;
        }
        parser.nextToken();
      }

      const w = parser.peekToken();
      if ((w.type === 'symbol') && (w.value === 'with')) {
        parser.nextToken();
        const _with = parser.parseExpression();
        args.addChild(_with);
      }
      parser.advanceAfterBlockEnd(token.value);
      return { args };
    },
    async run(context, item, options, _with) {
      const req = context.env.opts.req;
      if (!item) {
        self.apos.util.warn('a null widget was encountered.');
        return '';
      }
      if (!options) {
        options = {};
      }

      let contextOptions = {};
      if (typeof _with === 'object' && _with[item.type]) {
        contextOptions = typeof _with[item.type] === 'object' ? _with[item.type] : {};
      }

      const manager = self.getWidgetManager(item.type);
      if (!manager) {
        // Not configured in this project
        self.warnMissingWidgetType(item.type);
        return '';
      }
      return manager.output(req, item, options, contextOptions);
    }
  };

};
