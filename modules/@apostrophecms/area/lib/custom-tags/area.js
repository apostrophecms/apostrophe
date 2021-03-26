// Implements {% area docOrWidget, 'areaName', { options... } %}

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
          const argList = args.children;
          if (
            argList && argList[1] &&
            typeof argList[1].value === 'string'
          ) {
            throw usage(`Too many arguments were passed to the "${argList[1].value}" area before the "with" keyword.`);
          } else {
            throw usage('Too many arguments were passed to an area before the "with" keyword.');
          }
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
    async run(context, doc, name, _with) {
      const req = context.env.opts.req;
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
        // Problem: area is in schema but that doesn't guarantee it
        // has a value, for instance the field could be new in the schema.
        // But we need an area _id. Stub it into the db on the fly
        // without race conditions
        area = {
          metaType: 'area',
          _id: self.apos.util.generateId(),
          items: []
        };
        doc[name] = area;
        const docId = doc._docId || doc._id;
        if (docId) {
          let mainDoc = await self.apos.doc.db.findOne({ _id: docId });
          if (!mainDoc) {
            throw self.apos.error('notfound');
          }
          let docDotPath;
          try {
            docDotPath = (doc._id === docId) ? '' : self.apos.util.findNestedObjectAndDotPathById(mainDoc, doc._id).dotPath;
          } catch (e) {
            // Race condition: someone removed the area's parent object.
            // Unlikely thanks to advisory locking
            throw self.apos.error('notfound');
          }
          const areaDotPath = docDotPath ? `${docDotPath}.${name}` : name;
          await self.apos.doc.db.updateOne({
            _id: docId,
            // Prevent race condition
            [areaDotPath]: {
              $eq: null
            }
          }, {
            $set: {
              [areaDotPath]: self.apos.util.clonePermanent(area)
            }
          });
          mainDoc = await self.apos.doc.db.findOne({ _id: docId });
          // Prevent race condition
          area._id = self.apos.util.get(mainDoc, areaDotPath)._id;
        }
      }
      const manager = self.apos.util.getManagerOf(doc);
      const field = manager.schema.find(field => field.name === name);
      if (!field) {
        throw new Error(`The doc of type ${doc.type} with the slug ${doc.slug} has no field named ${name}.
In Apostrophe 3.x areas must be part of the schema for each page or piece type.`);
      }
      area._fieldId = field._id;
      area._docId = doc._docId || ((doc.metaType === 'doc') ? doc._id : null);
      // For existing areas this is propagated at load time, areas in
      // array items will always be existing areas
      area._edit = area._edit || doc._edit;

      self.apos.area.prepForRender(area, doc, name);

      const content = await self.apos.area.renderArea(req, area, _with);
      return content;
    }
  };

  function usage(message) {
    return new Error(`${message}

Usage: {% area data.page, 'areaName' with { optional object visible as data.context in widgets } %}
`
    );
  }
};
