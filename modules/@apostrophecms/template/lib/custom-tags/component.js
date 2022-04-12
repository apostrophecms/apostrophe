// Implements {% component 'moduleName:componentName' with dataObject %}

const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = function(self) {
  return {
    // We need a custom parser because of the "with" syntax
    parse(parser, nodes, lexer) {
      // get the tag token
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
      parser.advanceAfterBlockEnd(token.value);
      return { args };
    },
    // Do the actual work
    async run(context, name, data) {
      const req = context.ctx.__req;
      if (!data) {
        data = {};
      }

      const telemetry = self.apos.telemetry;
      const spanName = `component:${name}`;
      return telemetry.startActiveSpan(spanName, async (span) => {
        span.setAttribute(telemetry.Attributes.TEMPLATE, name);

        try {
          const parsed = name.match(/^([^:]+):(.+)$/);
          if (!parsed) {
            throw new Error('When using {% component %} the component name must be a string like: module-name:componentName');
          }
          // eslint-disable-next-line no-unused-vars
          const [ dummy, moduleName, componentName ] = parsed;
          span.setAttribute(SemanticAttributes.CODE_FUNCTION, componentName);
          span.setAttribute(SemanticAttributes.CODE_NAMESPACE, moduleName);
          const module = self.apos.modules[moduleName];
          if (!module) {
            throw new Error(`{% component %} was invoked with the name of a module that does not exist. Hint:\nit must be a module that is actually live in your project, not a base class\nlike @apostrophecms/piece-type.\nModule name: ${moduleName} Component name: ${componentName}`);
          }
          if (!(module.components && module.components[componentName])) {
            throw new Error(`{% component %} was invoked with the name of a component that does not exist.\nModule name: ${moduleName} Component name: ${componentName}`);
          }
          const result = await self.apos.util.recursionGuard(req, `component:${moduleName}:${componentName}`, async () => {
            const input = await module.components[componentName](req, data);
            return module.render(req, componentName, input);
          });
          span.setStatus({ code: telemetry.api.SpanStatusCode.OK });

          if (result === undefined) {
            // Recursion guard stopped it, nunjucks expects a string
            return '';
          } else {
            return result;
          }
        } catch (err) {
          telemetry.handleError(span, err);
          throw err;
        } finally {
          span.end();
        }
      });
    }
  };
};
