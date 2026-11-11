// The write tools' definitions. Every write names what it changes by ids an
// earlier read gave, and its result says where each document landed.

module.exports = (self) => {
  const {
    handler, id, locale
  } = require('./tool-args')(self);
  const values = description => ({
    type: 'object',
    description
  });
  const widgetIds = description => ({
    type: 'array',
    items: id(),
    minItems: 1,
    maxItems: 50,
    uniqueItems: true,
    description
  });
  // Where widgets go in an area; one of the three, or the end
  const place = {
    position: {
      type: 'integer',
      minimum: 0,
      description: 'The index among the area\'s widgets where they go'
    },
    before: id('The id of the widget they go before'),
    after: id('The id of the widget they go after')
  };

  return [
    {
      name: 'create_page',
      label: 'apostrophe:aiToolCreatePage',
      description: 'Create a page at "position" from "target": its first or last child, ' +
        'or the page before or after it.',
      input: () => ({
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: getPageTypes()
          },
          title: {
            type: 'string',
            minLength: 1
          },
          target: id('A page: an id, or a slug ("/services")'),
          position: {
            type: 'string',
            enum: [ 'lastChild', 'firstChild', 'before', 'after' ],
            default: 'lastChild'
          },
          ...locale('The locale of "target", when it is a slug; the current one when ' +
            'omitted'),
          values: values('Other fields by name, as get_schema lists them; areas as ' +
            '{ "items": [widgets] }, relationships as lists of ids')
        },
        required: [ 'type', 'title', 'target' ],
        additionalProperties: false
      }),
      kind: 'action',
      handler: handler('createPage')
    },
    {
      name: 'create_piece',
      label: 'apostrophe:aiToolCreatePiece',
      description: 'Create a piece, a document outside the page tree.',
      input: () => ({
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: getPieceTypes()
          },
          title: {
            type: 'string',
            minLength: 1
          },
          ...locale('The current one when omitted'),
          values: values('Other fields, as for create_page')
        },
        required: [ 'type', 'title' ],
        additionalProperties: false
      }),
      kind: 'action',
      handler: handler('createPiece')
    },
    {
      name: 'update_document',
      label: 'apostrophe:aiToolUpdateDocument',
      description: 'Change fields of one or more documents. Keys of "values": a field ' +
        'name, a dot path through objects, "@<id>" to replace a widget, array item or ' +
        'object whole, or "@<id>.<field>". Relationships take lists of ids. A key naming ' +
        'an area is refused: areas change through the widget tools.',
      input: {
        type: 'object',
        properties: {
          targets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                _id: id('A document id'),
                values: {
                  ...values('The values to set, by key'),
                  minProperties: 1
                }
              },
              required: [ '_id', 'values' ],
              additionalProperties: false
            },
            minItems: 1,
            maxItems: 50
          }
        },
        required: [ 'targets' ],
        additionalProperties: false
      },
      kind: 'action',
      handler: handler('updateDocument')
    },
    {
      name: 'add_widgets',
      label: 'apostrophe:aiToolAddWidgets',
      description: 'Add new widgets to an area, at the end unless a place is given. Each ' +
        'widget: "type" and its fields, nested areas as { "items": [widgets] }. Never ' +
        'send ids; the result returns the new ones.',
      input: () => ({
        type: 'object',
        properties: {
          _id: id('A document id'),
          area: id('The area\'s path, as the outline gives it'),
          widgets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: self.getWidgetTypeNames()
                }
              },
              required: [ 'type' ]
            },
            minItems: 1,
            maxItems: 20
          },
          ...place
        },
        required: [ '_id', 'area', 'widgets' ],
        additionalProperties: false
      }),
      kind: 'action',
      handler: handler('addWidgets')
    },
    {
      name: 'move_widgets',
      label: 'apostrophe:aiToolMoveWidgets',
      description: 'Move widgets of one document, content and ids kept, in the order ' +
        'given, to an area of it, the same or another; at the end unless a place is given.',
      input: {
        type: 'object',
        properties: {
          _id: id('A document id'),
          widgets: widgetIds('The ids of the widgets to move'),
          area: id('The path of the area they go to, as the outline gives it'),
          ...place
        },
        required: [ '_id', 'widgets', 'area' ],
        additionalProperties: false
      },
      kind: 'action',
      handler: handler('moveWidgets')
    },
    {
      name: 'remove_widgets',
      label: 'apostrophe:aiToolRemoveWidgets',
      description: 'Remove widgets from one document.',
      input: {
        type: 'object',
        properties: {
          _id: id('A document id'),
          widgets: widgetIds('The ids of the widgets to remove')
        },
        required: [ '_id', 'widgets' ],
        additionalProperties: false
      },
      kind: 'action',
      handler: handler('removeWidgets')
    }
  ];

  // Page types a page may be created as
  function getPageTypes() {
    const choices = self.apos.page.typeChoices.map(choice => choice.name);
    return self.getDocTypeNames().filter(name => choices.includes(name));
  }

  // Piece types a piece may be created as: not one that exists once, nor
  // one whose documents come from an upload
  function getPieceTypes() {
    return self.getDocTypeNames().filter(name => {
      const manager = self.apos.doc.getManager(name);
      const { options } = manager;
      return self.apos.instanceOf(manager, '@apostrophecms/piece-type') &&
        !options.singleton &&
        !options.singletonAuto &&
        !options.insertViaUpload &&
        (options.showCreate !== false);
    });
  }
};
