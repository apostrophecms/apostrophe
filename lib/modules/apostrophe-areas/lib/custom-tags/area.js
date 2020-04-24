// Implements {% area docOrWidget, 'areaName', { options... } %}

module.exports = function(self, options) {
  return {
    // We need a custom parser because of the "with" syntax
    parse(parser, nodes, lexer) {
      // get the tag token
      const token = parser.nextToken();

      const args = new nodes.NodeList(token.lineno, token.colno);

      while (true) {
        // get the arguments before "with"
        const object = parser.parseExpression();
        args.addChild(object);
        let w = parser.peekToken();
        if (!(w.type === 'comma')) {
          break;
        }
        parser.nextToken();
      }

      const w = parser.peekToken();
      if ((w.type === 'symbol') && (w.value === 'with')) {
        parser.nextToken();
        const context = parser.parseExpression();
        args.addChild(context);
      }
      parser.advanceAfterBlockEnd(token.value);
      return args;
    },
    async run(req, doc, name, context) {
      let area;
      if ((!doc) || ((typeof doc) !== 'object')) {
        throw usage('You must pass an existing doc or widget as the first argument.');
      }
      if ((typeof name) !== 'string') {
        throw usage('The second argument must be an area name.');
      }
      if (!name.match(/^\w+$/)) {
        throw usage('area names should be made up only of letters, underscores and digits. Otherwise they will not save properly.');
      }
      area = doc[name];
      if (!area) {
        area = {
          metaType: 'area'
        };
      }
      const manager = self.apos.utils.getManagerOf(doc);
      const field = manager.schema.find(field => field.name === name);
      if (!field) {
        throw new Error(`The doc of type ${doc.type} with the slug ${doc.slug} has no field named ${name}.`);
      }
      area._fieldId = field._id;
      area._docId = doc._docId || doc._id;
      area._edit = doc._edit;

      const content = await self.apos.areas.renderArea(req, area, context);
      return content;
      function usage(message) {
        return new Error(`${message}

  Usage: {% area data.page, 'areaName' with { optional object visible as data.context in widgets } %}
`
        );
      }
    }
  };
};
