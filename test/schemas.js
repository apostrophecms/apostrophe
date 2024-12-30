const assert = require('assert').strict;
const _ = require('lodash');
const t = require('../test-lib/test.js');

describe('Schemas', function() {

  let apos;

  const simpleFields = [
    {
      name: 'name',
      label: 'Name',
      type: 'string'
    },
    {
      name: 'address',
      label: 'Address',
      type: 'string',
      textarea: true
    },
    {
      name: 'variety',
      label: 'Variety',
      type: 'select',
      choices: [
        {
          value: 'candy',
          label: 'Candy'
        },
        {
          value: 'cheese',
          label: 'Cheese'
        }
      ],
      def: 'candy'
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'slug'
    }
  ];

  const realWorldCase = {
    addFields: [
      {
        type: 'string',
        name: 'title',
        label: 'Title',
        required: true,
        sortify: true
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true
      },
      {
        type: 'boolean',
        name: 'archive',
        label: 'apostrophe:archived',
        contextual: true,
        def: false
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Old URL',
        required: true,
        page: true
      },
      {
        name: 'title',
        label: 'Description',
        type: 'string',
        required: true
      },
      {
        name: 'urlType',
        label: 'Link To',
        type: 'select',
        choices: [
          {
            label: 'Internal Page',
            value: 'internal'
          },
          {
            label: 'External URL',
            value: 'external'
          }
        ]
      },
      {
        name: 'externalUrl',
        label: 'URL',
        type: 'url',
        if: {
          urlType: 'external'
        }
      },
      {
        name: '_newPage',
        type: 'relationship',
        limit: 1,
        withType: '@apostrophecms/any-page-type',
        label: 'Page Title',
        idsStorage: 'pageId',
        if: {
          urlType: 'internal'
        }
      }
    ],
    arrangeFields: [
      {
        name: 'basics',
        label: 'Basics',
        fields: [
          'title',
          'slug'
        ]
      },
      {
        name: 'permissions',
        label: 'Permissions',
        fields: [
          'visibility'
        ],
        last: true
      },
      {
        name: 'otherFields',
        label: 'Other fields',
        fields: [
          'slug',
          'urlType',
          '_newPage',
          'title',
          'externalUrl'
        ]
      }
    ]
  };

  const pageSlug = [
    {
      type: 'slug',
      name: 'slug',
      page: true
    }
  ];

  const regularSlug = [
    {
      type: 'slug',
      name: 'slug'
    }
  ];

  const hasArea = {
    addFields: [
      {
        type: 'area',
        name: 'body',
        label: 'Body',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'styles', 'bold' ],
              styles: [
                {
                  tag: 'p',
                  label: 'Paragraph'
                },
                {
                  tag: 'h4',
                  label: 'Header 4'
                }
              ]
            }
          }
        }
      }
    ]
  };

  const hasGroupedArea = {
    addFields: [
      {
        type: 'area',
        name: 'body',
        label: 'Body',
        options: {
          expanded: true,
          groups: {
            content: {
              label: 'Content Widgets',
              columns: 2,
              widgets: {
                '@apostrophecms/rich-text': {
                  toolbar: [ 'bold' ]
                },
                '@apostrophecms/form': {}
              }
            },
            media: {
              label: 'Media',
              columns: 3,
              widgets: {
                '@apostrophecms/image': {},
                '@apostrophecms/video': {}
              }
            },
            layout: {
              label: 'Layout Widgets',
              columns: 4,
              widgets: {
                'two-column': {}
              }
            }
          }
        }
      }
    ]
  };

  const hasAreaWithoutWidgets = {
    addFields: [
      {
        type: 'area',
        name: 'body',
        label: 'Body',
        options: {
          widgets: {}
        }
      }
    ]
  };

  const warnMessages = [];

  this.timeout(t.timeout);

  beforeEach(async function () {
    apos.schema.validatedSchemas = {};
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/util': {
          extendMethods() {
            return {
              warn(_super, ...args) {
                warnMessages.push(...args);
                return _super(...args);
              }
            };
          }
        },
        'external-condition': {
          methods() {
            return {
              async externalCondition() {
                return 'yes';
              },
              async externalCondition2(req, { docId }) {
                return `yes - ${req.someReqAttr} - ${docId}`;
              }
            };
          }
        },
        choices: {
          methods() {
            return {
              async getChoices(req, { docId }) {
                return [
                  {
                    label: 'One',
                    value: 'one'
                  },
                  {
                    label: 'Two',
                    value: 'two'
                  },
                  {
                    label: 'DocId',
                    value: docId
                  }
                ];
              }
            };
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          fields(self) {
            return {
              add: {
                title: {
                  label: '',
                  type: 'string',
                  required: true
                },
                area: {
                  label: 'Area',
                  type: 'area',
                  options: {
                    widgets: {
                      '@apostrophecms/rich-text': {}
                    }
                  }
                },
                array: {
                  label: 'Array',
                  type: 'array',
                  fields: {
                    add: {
                      arrayTitle: {
                        label: 'Array Title',
                        type: 'string'
                      }
                    }
                  }
                }
              }
            };
          }
        },
        topic: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'topic'
          },
          fields(self) {
            return {
              add: {
                title: {
                  label: 'Title',
                  type: 'string',
                  required: true
                },
                area: {
                  label: 'Area',
                  type: 'area',
                  options: {
                    widgets: {
                      '@apostrophecms/image': {}
                    }
                  }
                },
                _rel: {
                  label: 'Rel',
                  type: 'relationship',
                  withType: 'article'
                },
                array: {
                  label: 'Array',
                  type: 'array',
                  fields: {
                    add: {
                      _arrayRel: {
                        label: 'Array Rel',
                        type: 'relationship',
                        withType: 'article'
                      }
                    }
                  }
                },
                object: {
                  label: 'Object',
                  type: 'object',
                  fields: {
                    add: {
                      _objectRel: {
                        label: 'Object Rel',
                        type: 'relationship',
                        withType: 'article'
                      }
                    }
                  }
                }
              }
            };
          }
        }
      }
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should be a property of the apos object', function() {
    assert(apos.schema);
    apos.argv._ = [];
  });

  it('should compose schemas correctly', function() {
    const options = {
      addFields: [
        {
          name: 'name',
          type: 'string',
          label: 'Name'
        },
        {
          name: 'address',
          type: 'string',
          label: 'Address',
          textarea: true
        },
        {
          name: 'variety',
          type: 'select',
          label: 'Variety',
          choices: [
            {
              value: 'candy',
              label: 'Candy'
            },
            {
              value: 'cheese',
              label: 'Cheese'
            }
          ]
        }
      ],
      removeFields: [ 'address' ],
      alterFields: function(schema) {
        const variety = _.find(schema, { name: 'variety' });
        assert(variety);
        variety.choices.push({
          value: 'record',
          label: 'Record'
        });
      }
    };
    const schema = apos.schema.compose(options);
    assert(schema.length === 2);
    assert(schema[0].name === 'name');
    assert(schema[1].name === 'variety');
    assert(_.keys(schema[1].choices).length === 3);
  });

  it('should compose a schema for a complex real world case correctly', function() {
    const schema = apos.schema.compose(realWorldCase);
    assert(schema);
    const externalUrl = _.find(schema, { name: 'externalUrl' });
    assert(externalUrl);
    assert.strictEqual(externalUrl.group.name, 'otherFields');
    const _newPage = _.find(schema, { name: '_newPage' });
    assert(_newPage);
    assert.strictEqual(_newPage.group.name, 'otherFields');
  });

  it('should error if a field is required and an empty value is submitted for a string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'name',
          label: 'Name',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      name: ''
    };
    await testSchemaError(schema, input, 'name', 'required');
  });

  it('should error if the value submitted is less than min length for a string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'name',
          label: 'Name',
          min: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      name: 'Cow'
    };
    await testSchemaError(schema, input, 'name', 'min');
  });

  it('should convert and keep the correct value for a field which is required for a string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'name',
          label: 'Name',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      name: 'Apostrophe^CMS'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.name === 'Apostrophe^CMS');
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          min: 1,
          max: 10
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: ''
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === null);
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          min: 1,
          max: 10
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: ''
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === null);
  });

  it('should ensure a max value is being trimmed to the max length for a string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'name',
          label: 'Name',
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      name: 'Apostrophe'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.name === 'Apost');
  });

  it('should allow saving a 0 value provided as a number if a field is required for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 0
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a float if a field is required for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 0.00
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0.00);
  });

  it('should allow saving a 0 value provided as a number if a field is required for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 0
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a number if a field is required for an string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 0
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '0');
  });

  it('should allow saving a 0 value provided as a string if a field is required for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '0'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if a field is required for an string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '0'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '0');
  });

  it('should allow saving a 0 value provided as a string if a field is required for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '0'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '0'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '0'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a negative value provided as a number for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: -1
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1);
  });

  it('should allow saving a negative value provided as a float for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: -1.3
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should allow saving a negative value provided as a float for an string field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'string',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: -1.3
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '-1.3');
  });

  it('should allow saving a negative value provided as a number if a field is required for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: -1
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1);
  });

  it('should allow saving a negative value provided as a number if a field is required for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: -1.3
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should allow saving a negative value provided as a string if a field is required for an float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '-1.3'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          min: 5,
          max: 6
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '3'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          min: 5.1,
          max: 6
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '3.2'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.1);
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          min: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '1'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          min: 5.3
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '1.2'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.3);
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '8'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          max: 5.9
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '8'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.9);
  });

  it('should not modify a value if the submitted value is within min and max for an integer field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          min: 4,
          max: 6
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '5'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should not modify a value if the submitted value is within min and max for a float field type', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          min: 4,
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '4.3'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 4.3);
  });

  it('should not allow a text value to be submitted for a required integer field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a required float field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field with min and max', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          min: 1,
          max: 10
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field with min and max', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          min: 1,
          max: 10
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field with a default value set', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price',
          def: 2
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field with a default value set', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price',
          def: 2.10
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should allow a parsable string/integer value to be submitted for a non required integer field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '22a'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.price === 22);
  });

  it('should allow a parsable string/float value to be submitted for a non required float field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      price: '11.4b'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.price === 11.4);
  });

  it('should set the default range field value when undefined is given', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'range',
          name: 'rating',
          label: 'Rating',
          def: 0,
          min: 0,
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {};
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.rating === 0);
  });

  it('should set the default range field value when null is given', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'range',
          name: 'rating',
          label: 'Rating',
          def: 0,
          min: 0,
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      rating: null
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.rating === 0);
  });

  it('should set the range field value to null when a value below the min threshold is given', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'range',
          name: 'rating',
          label: 'Rating',
          def: 0,
          min: 0,
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      rating: -1
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.rating === null);
  });

  it('should set the range field value to null when a value over the max threshold is given', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'range',
          name: 'rating',
          label: 'Rating',
          def: 0,
          min: 0,
          max: 5
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      rating: 6
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.rating === null);
  });

  it('should convert simple data correctly', async function() {
    const schema = apos.schema.compose({
      addFields: simpleFields
    });
    assert(schema.length === 4);
    const input = {
      name: 'Bob Smith',
      address: '5017 Awesome Street\nPhiladelphia, PA 19147',
      irrelevant: 'Irrelevant',
      slug: 'This Is Cool'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 4);
    // expected fields came through
    assert(result.name === input.name);
    assert(result.address === input.address);
    // default
    assert(result.variety === undefined);
    assert(result.slug === 'this-is-cool');
  });

  it('should update a password if provided', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      password: 'silly'
    };
    const req = apos.task.getReq();
    const result = { password: 'serious' };
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    // hashing is not the business of schemas, see the
    // @apostrophecms/user module
    assert(result.password === 'silly');
  });

  it('should leave a password alone if not provided', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      password: ''
    };
    const req = apos.task.getReq();
    const result = { password: 'serious' };
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    // hashing is not the business of schemas, see the
    // @apostrophecms/user module
    assert(result.password === 'serious');
  });

  it('should handle array schemas', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'array',
          name: 'addresses',
          label: 'Addresses',
          schema: [
            {
              name: 'address',
              type: 'string',
              label: 'Address'
            }
          ]
        }
      ]
    });
    assert(schema.length === 1);
    const input = {
      addresses: [
        {
          address: '500 test lane'
        },
        {
          address: '602 test ave'
        }
      ]
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.addresses);
    assert(result.addresses.length === 2);
    assert(result.addresses[0]._id);
    assert(result.addresses[1]._id);
    assert(result.addresses[0].address === '500 test lane');
    assert(result.addresses[1].address === '602 test ave');
  });

  it('should check for duplicates in arrays when relevant', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          type: 'array',
          name: 'addresses',
          label: 'Addresses',
          schema: [
            {
              name: 'address',
              type: 'string',
              label: 'Address',
              unique: true
            }
          ]
        }
      ]
    });

    const input = {
      addresses: [
        {
          address: '500 test lane'
        },
        {
          address: '602 test ave'
        }
      ]
    };
    const result = {};
    const req = apos.task.getReq();
    await apos.schema.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.addresses);
    assert(result.addresses.length === 2);
    assert(result.addresses[0]._id);
    assert(result.addresses[1]._id);
    assert(result.addresses[0].address === '500 test lane');
    assert(result.addresses[1].address === '602 test ave');

    input.addresses[1] = '500 test lane';
    await apos.schema.convert(req, schema, input, result);
    assert.throws(() => {
      throw apos.error('duplicate', 'Address in Addresses must be unique');
    }, {
      name: 'duplicate',
      message: 'Address in Addresses must be unique'
    });
  });

  it('should convert string values to areas correctly', async function() {
    const schema = apos.schema.compose(hasArea);
    assert(schema.length === 1);
    const input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: 'This is the greatest <h1>thing</h1>'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(result.body.items[0]);
    assert(result.body.items[0].type === '@apostrophecms/rich-text');
    assert(result.body.items[0].content === apos.util.escapeHtml(input.body));
  });

  it('should convert arrays of widgets to areas correctly', async function() {
    const schema = apos.schema.compose(hasArea);
    assert(schema.length === 1);
    const input = {
      irrelevant: 'Irrelevant',
      body: [
        {
          metaType: 'widget',
          _id: 'abc',
          type: '@apostrophecms/rich-text',
          content: '<h4>This <em>is</em> <strong>a header.</strong></h4>'
        }
      ]
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(result.body.items[0]);
    assert(result.body.items[0].type === '@apostrophecms/rich-text');
    assert.strictEqual(result.body.items[0].content, '<h4>This is <strong>a header.</strong></h4>');
  });

  it('should not accept a widget not in the widgets object of the area', async function() {
    const schema = apos.schema.compose(hasAreaWithoutWidgets);
    assert(schema.length === 1);
    const input = {
      irrelevant: 'Irrelevant',
      body: [
        {
          metaType: 'widget',
          _id: 'abc',
          type: '@apostrophecms/rich-text',
          content: '<h4>This <em>is</em> <strong>a header.</strong></h4>'
        }
      ]
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(!result.body.items[0]);
  });

  it('should convert areas gracefully when they are undefined', async function() {
    const schema = apos.schema.compose(hasArea);
    assert(schema.length === 1);
    const input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: undefined
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(!result.body.items[0]);
  });

  it('should convert arrays of widgets when configured as groups to areas correctly', async function() {
    const schema = apos.schema.compose(hasGroupedArea);
    assert(schema.length === 1);
    const input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: 'I have <h1>groups</h1>!'
    };
    const req = apos.task.getReq();
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(result.body.items[0]);
    assert(result.body.items[0].type === '@apostrophecms/rich-text');
    assert(result.body.items[0].content === apos.util.escapeHtml(input.body));
  });

  it('should clean up extra slashes in page slugs', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    const input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert.strictEqual(result.slug, '/wiggy/wacky/wobbly/whizzle');
  });

  it('retains trailing / on the home page', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    const input = {
      slug: '/'
    };
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.slug === '/');
  });

  it('does not keep slashes when page: true not present for slug', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({ addFields: regularSlug });
    assert(schema.length === 1);
    const input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    const result = {};
    await apos.schema.convert(req, schema, input, result);
    assert(result.slug === 'wiggy-wacky-wobbly-whizzle');
  });

  it('enforces required property for ordinary field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          label: 'Age',
          type: 'integer',
          required: true
        }
      ]
    });
    await testSchemaError(schema, { age: '' }, 'age', 'required');
  });

  it('ignores required property for hidden field', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ]
        }
      ]
    });
    const output = {};
    await apos.schema.convert(req, schema, {
      ageOrShoeSize: 'shoeSize',
      age: ''
    }, output);
    assert(output.ageOrShoeSize === 'shoeSize');
  });

  it('enforces required property for shown field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, {
      ageOrShoeSize: 'age',
      age: ''
    }, 'age', 'required');
  });

  it('ignores required property for recursively hidden field', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ],
          if: {
            doWeCare: '1'
          }
        },
        {
          name: 'doWeCare',
          type: 'select',
          choices: [
            {
              label: 'Yes',
              value: '1'
            },
            {
              label: 'No',
              value: '0'
            }
          ]
        }
      ]
    });
    const output = {};
    await apos.schema.convert(req, schema, {
      ageOrShoeSize: 'age',
      doWeCare: '0',
      age: ''
    }, output);
    assert(output.ageOrShoeSize === 'age');
  });

  it('enforces required property for recursively shown field', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ],
          if: {
            doWeCare: '1'
          }
        },
        {
          name: 'doWeCare',
          type: 'select',
          choices: [
            {
              label: 'Yes',
              value: '1'
            },
            {
              label: 'No',
              value: '0'
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, {
      ageOrShoeSize: 'age',
      doWeCare: '1',
      age: ''
    }, 'age', 'required');
  });

  it('ignores required property for recursively hidden field with boolean', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ],
          if: {
            doWeCare: true
          }
        },
        {
          name: 'doWeCare',
          type: 'boolean',
          choices: [
            {
              value: true
            },
            {
              value: false
            }
          ]
        }
      ]
    });
    const output = {};
    await apos.schema.convert(req, schema, {
      ageOrShoeSize: 'age',
      doWeCare: false,
      age: ''
    }, output);
    assert(output.ageOrShoeSize === 'age');
  });

  it('enforces required property for recursively shown field with boolean', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            ageOrShoeSize: 'age'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false,
          if: {
            ageOrShoeSize: 'shoeSize'
          }
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age'
            },
            {
              label: 'shoeSize',
              value: 'shoeSize'
            }
          ],
          if: {
            doWeCare: true
          }
        },
        {
          name: 'doWeCare',
          type: 'boolean'
        }
      ]
    });
    await testSchemaError(schema, {
      ageOrShoeSize: 'age',
      doWeCare: true,
      age: null
    }, 'age', 'required');
  });

  it('should ignore required property when external condition does not match', async function() {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            'external-condition:externalCondition()': 'no'
          }
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        }
      ]
    });
    const output = {};
    await apos.schema.convert(req, schema, {
      shoeSize: 20
    }, output);
    assert(output.shoeSize === 20);
  });

  it('should enforce required property when external condition matches', async function() {
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true,
          if: {
            'external-condition:externalCondition()': 'yes'
          }
        }
      ]
    });

    await testSchemaError(schema, {}, 'age', 'required');
  });

  it('should use the field module name by default when the external condition key does not contain it', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'externalCondition()';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';

    const result = await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);

    assert(result === 'yes');
  });

  it('should pass req and the doc ID to the external condition method', async function() {
    const someReqAttr = 'some-attribute-on-req';
    const req = apos.task.getReq({
      someReqAttr
    });
    const conditionKey = 'external-condition:externalCondition2()';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';

    const result = await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);

    assert(result === `yes - ${someReqAttr} - ${docId}`);
  });

  it('should warn when an argument is passed in the external condition key', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'external-condition:externalCondition(letsNotArgue)';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';

    const result = await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);

    assert(warnMessages.pop() === 'The method "external-condition:externalCondition" defined in the "someField" field should be written without argument: "external-condition:externalCondition()".');
    assert(result === 'yes');
  });

  it('should throw when the condition key does not end with parenthesis', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'external-condition:externalCondition';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';

    try {
      await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);
    } catch (error) {
      assert(error.message === 'The method "external-condition:externalCondition" defined in the "someField" field should be written with parenthesis: "external-condition:externalCondition()".');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should not throw when the condition key does not end with parenthesis with the optionalParenthesis parameter set to true', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'external-condition:externalCondition';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';
    const optionalParenthesis = true;

    const result = await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId, optionalParenthesis);
    assert(result === 'yes');
  });

  it('should throw when the module defined in the external condition key is not found', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'unknown-module:externalCondition()';
    const fieldName = 'someField';
    const fieldModuleName = 'unknown-module';
    const docId = 'some-doc-id';

    try {
      await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);
    } catch (error) {
      assert(error.message === 'The "unknown-module" module defined in the "someField" field does not exist.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should throw when the method defined in the external condition key is not found', async function() {
    const req = apos.task.getReq();
    const conditionKey = 'external-condition:unknownMethod()';
    const fieldName = 'someField';
    const fieldModuleName = 'external-condition';
    const docId = 'some-doc-id';

    try {
      await apos.schema.evaluateMethod(req, conditionKey, fieldName, fieldModuleName, docId);
    } catch (error) {
      assert(error.message === 'The "unknownMethod" method from "external-condition" module defined in the "someField" field does not exist.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should call the evaluate-external-condition API successfully', async function() {
    apos.schema.fieldsById['some-field-id'] = {
      name: 'someField',
      moduleName: 'external-condition',
      if: {
        'externalCondition()': 'yes'
      }
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/evaluate-external-condition?fieldId=some-field-id&docId=some-doc-id&conditionKey=externalCondition()', {});
    assert(res.result === 'yes');
  });

  it('should warn when an argument is passed in the external condition key via the evaluate-external-condition API', async function() {
    apos.schema.fieldsById['some-field-id'] = {
      name: 'someField',
      moduleName: 'external-condition',
      if: {
        'externalCondition()': 'yes'
      }
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/evaluate-external-condition?fieldId=some-field-id&docId=some-doc-id&conditionKey=externalCondition(letsNotArgue)', {});

    assert(warnMessages.pop() === 'The method "externalCondition" defined in the "someField" field should be written without argument: "externalCondition()".');
    assert(res.result === 'yes');
  });

  it('should receive a clean error response when the evaluate-external-condition API call fails (module not found)', async function() {
    apos.schema.fieldsById['some-field-id'] = {
      name: 'someField',
      moduleName: 'unknown-module'
    };

    try {
      await apos.http.get('/api/v1/@apostrophecms/schema/evaluate-external-condition?fieldId=some-field-id&docId=some-doc-id&conditionKey=externalCondition()', {});
    } catch (error) {
      assert(error.status = 400);
      assert.strictEqual(error.body.message, 'externalCondition() is not registered as an external condition.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should receive a clean error response when the evaluate-external-condition API call fails (external method not found)', async function() {
    apos.schema.fieldsById['some-field-id'] = {
      name: 'someField',
      moduleName: 'external-condition'
    };

    try {
      await apos.http.get('/api/v1/@apostrophecms/schema/evaluate-external-condition?fieldId=some-field-id&docId=some-doc-id&conditionKey=unknownMethod()', {});
    } catch (error) {
      assert(error.status = 400);
      assert.strictEqual(error.body.message, 'unknownMethod() is not registered as an external condition.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should call the choices API successfully, using the field module name by default when the external condition key does not contain it', async function() {
    apos.schema.fieldTypes.select = {
      dynamicChoices: true
    };
    apos.schema.fieldsById['some-field-id'] = {
      type: 'select',
      name: 'someField',
      moduleName: 'choices',
      choices: 'getChoices'
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/choices?fieldId=some-field-id&docId=some-doc-id', {});
    assert.deepEqual(res.choices, [
      {
        label: 'One',
        value: 'one'
      },
      {
        label: 'Two',
        value: 'two'
      },
      {
        label: 'DocId',
        value: 'some-doc-id'
      }
    ]);
  });

  it('should call the choices API successfully, using parenthesis', async function() {
    apos.schema.fieldTypes.select = {
      dynamicChoices: true
    };
    apos.schema.fieldsById['some-field-id'] = {
      type: 'select',
      name: 'someField',
      moduleName: 'choices',
      choices: 'choices:getChoices()'
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/choices?fieldId=some-field-id&docId=some-doc-id', {});

    assert.deepEqual(res.choices, [
      {
        label: 'One',
        value: 'one'
      },
      {
        label: 'Two',
        value: 'two'
      },
      {
        label: 'DocId',
        value: 'some-doc-id'
      }
    ]);
  });

  it('should warn when an argument is passed in the external condition key via the choices API', async function() {
    apos.schema.fieldTypes.select = {
      dynamicChoices: true
    };
    apos.schema.fieldsById['some-field-id'] = {
      type: 'select',
      name: 'someField',
      moduleName: 'choices',
      choices: 'choices:getChoices(letsNotArgue)'
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/choices?fieldId=some-field-id&docId=some-doc-id', {});

    assert(warnMessages.pop() === 'The method "choices:getChoices" defined in the "someField" field should be written without argument: "choices:getChoices()".');
    assert.deepEqual(res.choices, [
      {
        label: 'One',
        value: 'one'
      },
      {
        label: 'Two',
        value: 'two'
      },
      {
        label: 'DocId',
        value: 'some-doc-id'
      }
    ]);
  });

  it('should receive a clean error response when the choices API call fails (module not found)', async function() {
    apos.schema.fieldTypes.select = {
      dynamicChoices: true
    };
    apos.schema.fieldsById['some-field-id'] = {
      type: 'select',
      name: 'someField',
      moduleName: 'choices',
      choices: 'unknown-module:getChoices()'
    };

    try {
      await apos.http.get('/api/v1/@apostrophecms/schema/choices?fieldId=some-field-id&docId=some-doc-id', {});
    } catch (error) {
      assert(error.status = 400);
      assert(error.body.message === 'The "unknown-module" module defined in the "someField" field does not exist.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should receive a clean error response when the choices API call fails (external method not found)', async function() {
    apos.schema.fieldTypes.select = {
      dynamicChoices: true
    };
    apos.schema.fieldsById['some-field-id'] = {
      type: 'select',
      name: 'someField',
      moduleName: 'choices',
      choices: 'choices:unknownMethod()'
    };

    try {
      await apos.http.get('/api/v1/@apostrophecms/schema/choices?fieldId=some-field-id&docId=some-doc-id', {});
    } catch (error) {
      assert(error.status = 400);
      assert(error.body.message === 'The "unknownMethod" method from "choices" module defined in the "someField" field does not exist.');
      return;
    }
    throw new Error('should have thrown');
  });

  it('should save date and time with the right format', async function () {
    const req = apos.task.getReq();
    const schema = apos.schema.compose({
      addFields: [
        {
          name: 'emptyValue',
          type: 'dateAndTime'
        },
        {
          name: 'goodValue',
          type: 'dateAndTime'
        }
      ]
    });

    const output = {};
    await apos.schema.convert(req, schema, {
      emptyValue: null,
      goodValue: '2022-05-09T22:36:00.000Z'
    }, output);

    assert(output.emptyValue === null);
    assert(output.goodValue === '2022-05-09T22:36:00.000Z');
  });

  it('should compare two document properly with the method getChanges', async function() {
    const req = apos.task.getReq();
    const instance = apos.article.newInstance();
    const article1 = {
      ...instance,
      title: 'article 1',
      area: {
        _id: 'clrth36680007mnmd3jj7cta0',
        items: [
          {
            _id: 'clt79l48g001h2061j5ihxjkv',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            aposPlaceholder: false,
            content: '<p>Some text here.</p>',
            permalinkIds: [],
            imageIds: []
          }
        ],
        metaType: 'area'
      },
      array: [
        {
          _id: 'clt79llm800242061v4dx9kv5',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.article.array',
          arrayTitle: 'array title 1'
        },
        {
          _id: 'clt79llm800242061v4d47364',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.article.array',
          arrayTitle: 'array title 2'
        }
      ]
    };
    const article2 = {
      ...article1,
      title: 'article 2'
    };
    const article3 = {
      ...instance,
      title: 'article 3',

      area: {
        _id: 'clrth36680007mnmd3jj7cta0',
        items: [
          {
            _id: 'clt79l48g001h2061j5ihxjkv',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            aposPlaceholder: false,
            content: '<p>Some text here changed.</p>',
            permalinkIds: [],
            imageIds: []
          }
        ],
        metaType: 'area'
      },
      array: [
        {
          _id: 'clt79llm800242061v4dx9kv5',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.article.array',
          arrayTitle: 'array title 1 changed'
        },
        {
          _id: 'clt79llm800242061v4d47364',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.article.array',
          arrayTitle: 'array title 2'
        }
      ]
    };

    await apos.article.insert(req, article1);
    await apos.article.insert(req, article2);
    await apos.article.insert(req, article3);

    const art1 = await apos.doc.db.findOne({ title: 'article 1' });
    const art2 = await apos.doc.db.findOne({ title: 'article 2' });
    const art3 = await apos.doc.db.findOne({ title: 'article 3' });

    const changes11 = apos.schema.getChanges(req, apos.article.schema, art1, art1);
    const changes12 = apos.schema.getChanges(req, apos.article.schema, art1, art2);
    const changes23 = apos.schema.getChanges(req, apos.article.schema, art2, art3);
    const actual = {
      changes11,
      changes12,
      changes23
    };
    const expected = {
      changes11: [],
      changes12: [ 'title', 'slug' ],
      changes23: [ 'title', 'slug', 'area', 'array' ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should allow to simulate a populate of relationships on database data', async function() {
    const req = apos.task.getReq();
    const doc = {
      _id: 'gvoyi3l0ncsj2yq36743zeum:en:draft',
      title: 'topic',
      array: [
        {
          _id: 'hy56r2znrs427m47e15yesfb',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.topic.array',
          arrayRelIds: [ 'nkr88dg4lds8noal9l4vrcgv' ],
          arrayRelFields: { nkr88dg4lds8noal9l4vrcgv: {} }
        }
      ],
      object: {
        _id: 'tfpq5v6lwlwomuampavh6zi8',
        metaType: 'object',
        scopedObjectName: 'doc.topic.object',
        objectRelIds: [ 'nkr88dg4lds8noal9l4vrcgv', 'az82H8dg4lds8noal9l4vazd' ],
        objectRelFields: {
          nkr88dg4lds8noal9l4vrcgv: {},
          az82H8dg4lds8noal9l4vazd: {}
        }
      },
      slug: 'topic',
      visibility: 'public',
      scheduledPublish: null,
      scheduledUnpublish: null,
      aposIsTemplate: false,
      aposPreviewImage: {
        _id: 'gx4ankjn1s0i2g16qs16is0q',
        items: [],
        metaType: 'area'
      },
      userPermissions: [],
      groupPermissions: [],
      archived: false,
      type: 'topic',
      aposLocale: 'en:draft',
      aposMode: 'draft',
      aposDocId: 'gvoyi3l0ncsj2yq36743zeum',
      metaType: 'doc',
      createdAt: '2024-08-07T07:11:34.234Z',
      updatedAt: '2024-08-07T07:24:17.889Z',
      cacheInvalidatedAt: '2024-08-07T07:24:17.889Z',
      updatedBy: {
        _id: 'vndh00in6p565asvbivvzjos',
        title: 'admin',
        username: 'admin'
      },
      titleSortified: 'topic',
      highSearchText: 'topic topic topic topic public',
      highSearchWords: [ 'topic', 'public' ],
      lowSearchText: 'topic topic topic topic public',
      searchSummary: '',
      aposPermissions: [],
      modified: false,
      lastPublishedAt: '2024-08-07T07:24:17.956Z',
      relIds: [ 'reyvb1txf54noynckm1xy34a' ],
      relFields: { reyvb1txf54noynckm1xy34a: {} },
      area: {
        _id: 'hfwxext12500kxy74coc3nf1',
        items: [
          {
            _id: 'x38pvsmyqie83vzy57akpwb2',
            metaType: 'widget',
            type: '@apostrophecms/image',
            aposPlaceholder: false,
            imageIds: [ 'u2gcjvq9wvds1hkd8xibn9h1' ],
            imageFields: {
              u2gcjvq9wvds1hkd8xibn9h1: {
                top: null,
                left: null,
                width: null,
                height: null,
                x: null,
                y: null
              }
            }
          }
        ],
        metaType: 'area'
      }
    };

    apos.schema.simulateRelationshipsFromStorage(req, doc);

    const actual = {
      rel: doc._rel,
      area: doc.area.items[0]._image,
      array: doc.array[0]._arrayRel,
      object: doc.object._objectRel
    };

    const expected = {
      rel: [
        {
          _id: 'reyvb1txf54noynckm1xy34a:en:draft',
          _fields: {}
        }
      ],
      area: [
        {
          _id: 'u2gcjvq9wvds1hkd8xibn9h1:en:draft',
          _fields: {
            top: null,
            left: null,
            width: null,
            height: null,
            x: null,
            y: null
          }
        }
      ],
      array: [
        {
          _id: 'nkr88dg4lds8noal9l4vrcgv:en:draft',
          _fields: {}
        }
      ],
      object: [
        {
          _id: 'nkr88dg4lds8noal9l4vrcgv:en:draft',
          _fields: {}
        },
        {
          _id: 'az82H8dg4lds8noal9l4vazd:en:draft',
          _fields: {}
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should allow to convert a document without fetching relationships', async function() {
    const req = apos.task.getReq();
    const doc = {
      _id: 'gvoyi3l0ncsj2yq36743zeum:en:draft',
      title: 'topic',
      array: [
        {
          _id: 'hy56r2znrs427m47e15yesfb',
          metaType: 'arrayItem',
          scopedArrayName: 'doc.topic.array',
          arrayRelIds: [ 'nkr88dg4lds8noal9l4vrcgv' ],
          arrayRelFields: { nkr88dg4lds8noal9l4vrcgv: {} }
        }
      ],
      object: {
        _id: 'tfpq5v6lwlwomuampavh6zi8',
        metaType: 'object',
        scopedObjectName: 'doc.topic.object',
        objectRelIds: [ 'nkr88dg4lds8noal9l4vrcgv', 'az82H8dg4lds8noal9l4vazd' ],
        objectRelFields: {
          nkr88dg4lds8noal9l4vrcgv: {},
          az82H8dg4lds8noal9l4vazd: {}
        }
      },
      slug: 'topic',
      visibility: 'public',
      scheduledPublish: null,
      scheduledUnpublish: null,
      aposIsTemplate: false,
      aposPreviewImage: {
        _id: 'gx4ankjn1s0i2g16qs16is0q',
        items: [],
        metaType: 'area'
      },
      userPermissions: [],
      groupPermissions: [],
      archived: false,
      type: 'topic',
      aposLocale: 'en:draft',
      aposMode: 'draft',
      aposDocId: 'gvoyi3l0ncsj2yq36743zeum',
      metaType: 'doc',
      createdAt: '2024-08-07T07:11:34.234Z',
      updatedAt: '2024-08-07T07:24:17.889Z',
      cacheInvalidatedAt: '2024-08-07T07:24:17.889Z',
      updatedBy: {
        _id: 'vndh00in6p565asvbivvzjos',
        title: 'admin',
        username: 'admin'
      },
      titleSortified: 'topic',
      highSearchText: 'topic topic topic topic public',
      highSearchWords: [ 'topic', 'public' ],
      lowSearchText: 'topic topic topic topic public',
      searchSummary: '',
      aposPermissions: [],
      modified: false,
      lastPublishedAt: '2024-08-07T07:24:17.956Z',
      relIds: [ 'reyvb1txf54noynckm1xy34a' ],
      relFields: { reyvb1txf54noynckm1xy34a: {} },
      area: {
        _id: 'hfwxext12500kxy74coc3nf1',
        items: [
          {
            _id: 'x38pvsmyqie83vzy57akpwb2',
            metaType: 'widget',
            type: '@apostrophecms/image',
            aposPlaceholder: false,
            imageIds: [ 'u2gcjvq9wvds1hkd8xibn9h1' ],
            imageFields: {
              u2gcjvq9wvds1hkd8xibn9h1: {
                top: null,
                left: null,
                width: null,
                height: null,
                x: null,
                y: null
              }
            }
          }
        ],
        metaType: 'area'
      }
    };

    apos.schema.simulateRelationshipsFromStorage(req, doc);
    const docToInsert = doc;
    const schema = apos.doc.getManager('topic').schema;
    await apos.schema.convert(req, schema, doc, docToInsert, {
      fetchRelationships: false
    });

    const actual = {
      rel: docToInsert._rel,
      area: docToInsert.area.items[0]._image,
      array: docToInsert.array[0]._arrayRel,
      object: docToInsert.object._objectRel
    };
    const expected = {
      rel: [ {
        _id: 'reyvb1txf54noynckm1xy34a:en:draft',
        _fields: {}
      } ],
      area: [
        {
          _id: 'u2gcjvq9wvds1hkd8xibn9h1:en:draft',
          _fields: {
            top: null,
            left: null,
            width: null,
            height: null,
            x: null,
            y: null
          }
        }
      ],
      array: [ {
        _id: 'nkr88dg4lds8noal9l4vrcgv:en:draft',
        _fields: {}
      } ],
      object: [
        {
          _id: 'nkr88dg4lds8noal9l4vrcgv:en:draft',
          _fields: {}
        },
        {
          _id: 'az82H8dg4lds8noal9l4vazd:en:draft',
          _fields: {}
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  describe('field.readOnly with default value', function() {
    const givenSchema = [
      {
        name: 'title',
        type: 'string'
      },
      {
        name: 'array',
        type: 'array',
        schema: [
          {
            name: 'planet',
            type: 'string',
            def: 'Earth',
            readOnly: true
          },
          {
            name: 'moon',
            type: 'string'
          }
        ]
      },
      {
        name: 'object',
        type: 'object',
        schema: [
          {
            name: 'planet',
            type: 'string',
            def: 'Earth',
            readOnly: true
          },
          {
            name: 'moon',
            type: 'string'
          }
        ]
      },
      {
        name: '_relationship',
        type: 'relationship',
        limit: 1,
        withType: '@apostrophecms/any-page-type',
        label: 'Page Title',
        idsStorage: 'pageId',
        schema: [
          {
            name: 'planet',
            type: 'string',
            def: 'Earth',
            readOnly: true
          },
          {
            name: 'moon',
            type: 'string'
          }
        ]
      }
    ];

    it('should keep read only values when editing a document', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: givenSchema
      });
      const home = await apos.page.find(req, { slug: '/' }).toObject();

      const data = {
        _relationship: [
          {
            ...home,
            _fields: {
              planet: 'Saturn',
              moon: 'Titan'
            }
          }
        ],
        array: [
          {
            _id: 'Jupiter-Io',
            moon: 'Io'
          },
          {
            _id: 'Mars-Phobos',
            moon: 'Phobos'
          }
        ],
        object: {
          _id: 'Neptune-Triton',
          moon: 'Triton'
        },
        pageId: [ home._id ],
        pageFields: {
          [home._id]: {
            planet: 'Saturn'
          }
        },
        title: 'Sol'
      };
      const destination = {
        _relationship: [
          {
            ...home,
            _fields: {
              planet: 'Saturn'
            }
          }
        ],
        array: [
          {
            _id: 'Jupiter-Io',
            planet: 'Jupiter'
          },
          {
            _id: 'Mars-Phobos',
            planet: 'Mars'
          }
        ],
        object: {
          _id: 'Neptune-Triton',
          planet: 'Neptune'
        },
        pageId: [ home._id ],
        pageFields: {
          [home._id]: {
            planet: 'Saturn'
          }
        },
        title: 'Default'
      };
      await apos.schema.convert(
        req,
        schema,
        data,
        destination
      );

      const actual = destination;
      const expected = {
        _relationship: [
          {
            _fields: {
              planet: 'Saturn',
              moon: 'Titan'
            },
            ...home
          }
        ],
        array: [
          {
            _id: 'Jupiter-Io',
            metaType: 'arrayItem',
            moon: 'Io',
            planet: 'Jupiter',
            scopedArrayName: undefined
          },
          {
            _id: 'Mars-Phobos',
            metaType: 'arrayItem',
            moon: 'Phobos',
            planet: 'Mars',
            scopedArrayName: undefined
          }
        ],
        object: {
          _id: 'Neptune-Triton',
          metaType: 'objectItem',
          moon: 'Triton',
          planet: 'Neptune',
          scopedObjectName: undefined
        },
        pageId: [ home._id ],
        pageFields: {
          [home._id]: {
            planet: 'Saturn'
          }
        },
        title: 'Sol'
      };

      assert.deepEqual(actual, expected);
    });
  });

  describe('field editPermission|viewPermission', function() {
    const schema = [
      {
        name: 'legacy',
        type: 'string',
        permission: {
          action: 'edit',
          type: '@apostrophecms/user'
        }
      },
      {
        name: 'edit',
        type: 'string',
        editPermission: {
          action: 'edit',
          type: '@apostrophecms/user'
        }
      },
      {
        name: 'view',
        type: 'string',
        viewPermission: {
          action: 'edit',
          type: '@apostrophecms/user'
        }
      },
      {
        name: 'array',
        type: 'array',
        schema: [
          {
            name: 'edit',
            type: 'string',
            label: 'edit',
            editPermission: {
              action: 'edit',
              type: '@apostrophecms/user'
            }
          },
          {
            name: 'view',
            type: 'string',
            label: 'view',
            viewPermission: {
              action: 'edit',
              type: '@apostrophecms/user'
            }
          }
        ]
      },
      {
        name: 'object',
        type: 'object',
        schema: [
          {
            name: 'edit',
            type: 'string',
            label: 'edit',
            editPermission: {
              action: 'edit',
              type: '@apostrophecms/user'
            }
          },
          {
            name: 'view',
            type: 'string',
            label: 'view',
            viewPermission: {
              action: 'edit',
              type: '@apostrophecms/user'
            }
          }
        ]
      }
    ];

    it('validate doc type', function() {
      const logger = apos.util.error;
      const options = {
        type: 'doc type',
        subtype: 'test'
      };

      const messages = [];
      apos.util.error = (message) => messages.push(message);
      apos.schema.validate(schema, options);
      apos.util.error = logger;

      const actual = messages;
      const expected = [
        'doc type test, string field "array.edit":\n\neditPermission or viewPermission must be defined on root fields only, provided on "array.edit"',
        'doc type test, string field "array.view":\n\neditPermission or viewPermission must be defined on root fields only, provided on "array.view"',
        'doc type test, string field "object.edit":\n\neditPermission or viewPermission must be defined on root fields only, provided on "object.edit"',
        'doc type test, string field "object.view":\n\neditPermission or viewPermission must be defined on root fields only, provided on "object.view"'
      ];

      assert.deepEqual(actual, expected);
    });

    it('validate widget type', function() {
      const logger = apos.util.error;
      const options = {
        type: 'widget type',
        subtype: 'test'
      };

      const messages = [];
      apos.util.error = (message) => messages.push(message);
      apos.schema.validate(schema, options);
      apos.util.error = logger;

      const actual = messages;
      const expected = [
        'widget type test, string field "legacy":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "edit":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "view":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "array.edit":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "array.view":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "object.edit":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided',
        'widget type test, string field "object.view":\n\neditPermission or viewPermission must be defined on doc-type schemas only, "widget type" provided'
      ];

      assert.deepEqual(actual, expected);
    });
  });

  describe('field if|ifRequired', function () {
    it('should enforce required property not equal match', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: { prop1: { $ne: 'test' } }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: 'test'
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property not equal match', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: { prop1: { $ne: 'test' } }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: 'test2'
      }, 'requiredProp', 'required');
    });

    it('should enforce required property nested boolean', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'boolean'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'boolean'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: false
        }
      }, output);

      assert(!output.requiredProp);
    });

    // HERE
    it('should not error nested required property if parent is not visible', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'object',
            type: 'object',
            if: {
              showObject: true
            },
            schema: [
              {
                name: 'subfield',
                type: 'string',
                required: true
              }
            ]
          },
          {
            name: 'showObject',
            type: 'boolean'
          }
        ]
      });
      const output = {};

      try {
        await apos.schema.convert(req, schema, {
          showObject: false
        }, output);
        assert(true);
      } catch (err) {
        assert(!err);
      }
    });

    it('should error required property nested boolean', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'boolean'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'boolean'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: true
        }
      }, 'requiredProp', 'required');
    });

    it('should enforce required property nested string', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': 'test'
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: ''
        }
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property nested string', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': 'test'
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: 'test'
        }
      }, 'requiredProp', 'required');
    });

    it('should enforce required property nested number', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': 1
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: 2
        }
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property nested number', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': 1
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: 1
        }
      }, 'requiredProp', 'required');
    });

    it('should enforce required property number min', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            required: true,
            if: {
              prop1: {
                min: 0,
                max: 10
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        prop1: -1,
        prop2: ''
      }, output);
      assert(output.prop2 === '');
    });

    it('should error required property number min', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            required: true,
            if: {
              prop1: {
                min: 0,
                max: 10
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        prop1: 0,
        prop2: ''
      }, 'prop2', 'required');
    });

    it('should enforce required property number max', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            required: true,
            if: {
              prop1: {
                min: -10,
                max: 0
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        prop1: 1,
        prop2: ''
      }, output);
      assert(output.prop2 === '');
    });

    it('should error required property number max', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            required: true,
            if: {
              prop1: {
                min: -10,
                max: 0
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        prop1: 0,
        prop2: ''
      }, 'prop2', 'required');
    });

    it('should enforce required property nested logical AND', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredProp',
            required: true,
            type: 'integer',
            if: {
              'prop1.subfield': 1,
              prop2: true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: 1
        },
        prop2: false
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property nested logical AND', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': 1,
              prop2: true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: 1
        },
        prop2: true
      }, 'requiredProp', 'required');
    });

    it('should enforce required property nested logical OR', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              $or: [
                { 'prop1.subfield': 1 },
                { prop2: true }
              ]
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: 2
        },
        prop2: false
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property nested logical OR', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              $or: [
                { 'prop1.subfield': 1 },
                { prop2: true }
              ]
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: 1
        },
        prop2: false
      }, 'requiredProp', 'required');
    });

    it('should enforce required property nested not equal match', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': { $ne: 'test' }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredProp: null,
        prop1: {
          subfield: 'test'
        }
      }, output);
      assert(!output.requiredProp);
    });

    it('should error required property nested not equal match', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredProp',
            type: 'integer',
            required: true,
            if: {
              'prop1.subfield': { $ne: 'test' }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredProp: null,
        prop1: {
          subfield: 'test2'
        }
      }, 'requiredProp', 'required');
    });

    it('should enforce required property with ifRequired boolean', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'boolean',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            requiredIf: {
              prop1: true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        prop1: false,
        prop2: ''
      }, output);

      assert(output.prop2 === '');
    });

    it('should error required property with ifRequired boolean', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'boolean',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            requiredIf: {
              prop1: true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        prop1: true,
        prop2: ''
      }, 'prop2', 'required');
    });

    it('should enforce required property with ifRequired string', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'string',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: '18'
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: '',
        age: '17'
      }, output);
      assert(output.shoeSize === null);
    });

    it('should error required property with ifRequired string', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'string',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: '18'
            }
          }
        ]
      });
      await testSchemaError(schema, {
        shoeSize: '',
        age: '18'
      }, 'shoeSize', 'required');
    });

    it('should enforce required property with ifRequired number', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: 18
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: '',
        age: 17
      }, output);
      assert(output.shoeSize === null);
    });

    it('should error required property with ifRequired number', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: 18
            }
          }
        ]
      });
      await testSchemaError(schema, {
        shoeSize: '',
        age: 18
      }, 'shoeSize', 'required');
    });

    it('should enforce required property with ifRequired number min', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 18
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: '',
        age: 17
      }, output);
      assert(output.shoeSize === null);
    });

    it('should error required property with ifRequired number min', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 18
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        shoeSize: '',
        age: 19
      }, 'shoeSize', 'required');
    });

    it('should enforce required property with ifRequired number min 0', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 1
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: '',
        age: 0
      }, output);
      assert(output.shoeSize === null);
    });

    it('should error required property with ifRequired number min 0', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 0
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        shoeSize: '',
        age: 0
      }, 'shoeSize', 'required');
    });

    it('should enforce required property with ifRequired number max', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 18,
                max: 36
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: '',
        age: 37
      }, output);
      assert(output.shoeSize === null);
    });

    it('should error required property with ifRequired number max', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: false
          },
          {
            name: 'shoeSize',
            type: 'integer',
            requiredIf: {
              age: {
                min: 18,
                max: 36
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        shoeSize: '',
        age: 36
      }, 'shoeSize', 'required');
    });

    it('should enforce required property with ifRequired number max 0', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            requiredIf: {
              prop1: {
                min: -10,
                max: 0
              }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        prop1: 1,
        prop2: ''
      }, output);
      assert(output.prop2 === '');
    });

    it('should error required property with ifRequired number max 0', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'integer',
            required: false
          },
          {
            name: 'prop2',
            type: 'string',
            requiredIf: {
              prop1: {
                min: -10,
                max: 0
              }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        prop1: 0,
        prop2: ''
      }, 'prop2', 'required');
    });

    it('should enforce required property with ifRequired logical AND', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              prop1: 'test',
              prop2: true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: 'test',
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired logical AND', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              prop1: 'test',
              prop2: true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: 'test',
        prop2: true
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired logical AND with inverted props', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              prop2: true,
              prop1: 'test'
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: 'test',
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired logical AND  with inverted props', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              prop2: true,
              prop1: 'test'
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: 'test',
        prop2: true
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired logical OR', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { prop1: 'test' },
                { prop2: true }
              ]
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: 'test2',
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired logical OR', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { prop1: 'test' },
                { prop2: true }
              ]
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: 'test2',
        prop2: true
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired logical OR with inverted props', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { prop2: true },
                { prop1: 'test' }
              ]
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: 'test2',
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired logical OR with inverted props', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { prop2: true },
                { prop1: 'test' }
              ]
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: 'test2',
        prop2: true
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired not equal match', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: { prop1: { $ne: 'test' } }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: 'test'
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired not equal match', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'string',
            required: false
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: { prop1: { $ne: 'test' } }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: 'test2'
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested boolean', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'boolean'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'boolean'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: false
        }
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested boolean', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'boolean'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'boolean'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: true
        }
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested string', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 'test'
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: ''
        }
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested string', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 'test'
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 'test'
        }
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested number', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 1
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 2
        }
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested number', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 1
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 1
        }
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested logical AND', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 1,
              prop2: true
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 1
        },
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested logical AND', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': 1,
              prop2: true
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 1
        },
        prop2: true
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested logical OR', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { 'prop1.subfield': 1 },
                { prop2: true }
              ]
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 2
        },
        prop2: false
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested logical OR', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'integer'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'integer'
              }
            ]
          },
          {
            name: 'prop2',
            type: 'boolean',
            required: false
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              $or: [
                { 'prop1.subfield': 1 },
                { prop2: true }
              ]
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 1
        },
        prop2: false
      }, 'requiredIfProp', 'required');
    });

    it('should enforce required property with ifRequired nested not equal match', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': { $ne: 'test' }
            }
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 'test'
        }
      }, output);
      assert(output.requiredIfProp === null);
    });

    it('should error required property with ifRequired nested not equal match', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'prop1',
            type: 'object',
            required: false,
            fields: {
              add: {
                subfield: {
                  type: 'string'
                }
              }
            },
            schema: [
              {
                name: 'subfield',
                type: 'string'
              }
            ]
          },
          {
            name: 'requiredIfProp',
            type: 'integer',
            requiredIf: {
              'prop1.subfield': { $ne: 'test' }
            }
          }
        ]
      });
      await testSchemaError(schema, {
        requiredIfProp: null,
        prop1: {
          subfield: 'test2'
        }
      }, 'requiredIfProp', 'required');
    });

    it('should ignore requiredIf property when external condition does not match', async function() {
      const req = apos.task.getReq();
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: true,
            requiredIf: {
              'external-condition:externalCondition()': 'no'
            }
          },
          {
            name: 'shoeSize',
            type: 'integer',
            required: false
          }
        ]
      });
      const output = {};
      await apos.schema.convert(req, schema, {
        shoeSize: 20
      }, output);
      assert(output.shoeSize === 20);
    });

    it('should enforce requiredIf property when external condition matches', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'age',
            type: 'integer',
            required: true,
            requiredIf: {
              'external-condition:externalCondition()': 'yes'
            }
          }
        ]
      });

      await testSchemaError(schema, {}, 'age', 'required');
    });

    it('should not error complex nested object required property if parents are not visible', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'object',
            type: 'object',
            if: {
              showObject: true
            },
            schema: [
              {
                name: 'objectString',
                type: 'string',
                required: true
              },
              {
                name: 'objectArray',
                type: 'array',
                required: true,
                if: {
                  showObjectArray: true
                },
                schema: [
                  {
                    name: 'objectArrayString',
                    type: 'string',
                    required: true
                  }
                ]
              },
              {
                name: 'showObjectArray',
                type: 'boolean'
              }
            ]
          },
          {
            name: 'showObject',
            type: 'boolean'
          }
        ]
      });

      const data = {
        object: {
          objectString: 'toto',
          objectArray: [
            {
              _id: 'tutu',
              metaType: 'arrayItem'
            }
          ],
          showObjectArray: false
        },
        showObject: true
      };

      const output = {};
      const [ success, errors ] = await testConvert(apos, data, schema, output);

      const expected = {
        success: true,
        errors: [],
        output: {
          object: {
            _id: output.object._id,
            objectString: 'toto',
            objectArray: [
              {
                _id: 'tutu',
                metaType: 'arrayItem',
                scopedArrayName: undefined,
                objectArrayString: ''
              }
            ],
            showObjectArray: false,
            metaType: 'objectItem',
            scopedObjectName: undefined
          },
          showObject: true
        }
      };

      const actual = {
        success,
        errors,
        output
      };

      assert.deepEqual(expected, actual);

    });

    it('should not error complex nested arrays required property if parents are not visible', async function() {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'root',
            type: 'array',
            if: {
              showRoot: true
            },
            schema: [
              {
                name: 'rootString',
                type: 'string',
                required: true
              },
              {
                name: 'rootArray',
                type: 'array',
                required: true,
                schema: [
                  {
                    name: 'rootArrayString',
                    type: 'string',
                    required: true,
                    if: {
                      showRootArrayString: true
                    }
                  },
                  {
                    name: 'showRootArrayString',
                    type: 'boolean'
                  }
                ]
              }
            ]
          },
          {
            name: 'showRoot',
            type: 'boolean'
          }
        ]
      });

      const data1 = {
        root: [
          {
            _id: 'root_id',
            metaType: 'arrayItem',
            rootString: 'toto',
            rootArray: [
              {
                _id: 'root_array_id',
                metaType: 'arrayItem',
                showRootArrayString: true
              },
              {
                _id: 'root_array_id2',
                metaType: 'arrayItem',
                rootArrayBool: true,
                showRootArrayString: false
              }
            ]
          }
        ],
        showRoot: true
      };

      const output1 = {};
      const [ success1, errors1 ] = await testConvert(apos, data1, schema, output1);
      const foundError1 = findError(errors1, 'root_array_id.rootArrayString', 'required');

      const data2 = {
        root: [
          {
            _id: 'root_id',
            metaType: 'arrayItem',
            rootString: 'toto',
            rootArray: [
              {
                _id: 'root_array_id',
                metaType: 'arrayItem',
                rootArrayString: 'Item 1',
                showRootArrayString: true
              },
              {
                _id: 'root_array_id2',
                metaType: 'arrayItem',
                rootArrayBool: true,
                showRootArrayString: false
              }
            ]
          }
        ],
        showRoot: true
      };

      const output2 = {};
      const [ success2, errors2 ] = await testConvert(apos, data2, schema, output2);

      const expected = {
        success1: false,
        foundError1: true,
        success2: true,
        errors2: [],
        output2: {
          root: [
            {
              _id: 'root_id',
              metaType: 'arrayItem',
              scopedArrayName: undefined,
              rootString: 'toto',
              rootArray: [
                {
                  _id: 'root_array_id',
                  metaType: 'arrayItem',
                  scopedArrayName: undefined,
                  rootArrayString: 'Item 1',
                  showRootArrayString: true
                },
                {
                  _id: 'root_array_id2',
                  metaType: 'arrayItem',
                  scopedArrayName: undefined,
                  rootArrayString: '',
                  showRootArrayString: false
                }
              ]
            }
          ],
          showRoot: true
        }
      };

      const actual = {
        success1,
        foundError1,
        success2,
        errors2,
        output2
      };

      assert.deepEqual(expected, actual);
    });

    // TODO: update this test when support for conditional fields is added to relationships schemas
    it('should not error complex nested relationships required property if parents are not visible', async function() {
      const req = apos.task.getReq({ mode: 'draft' });
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'title',
            type: 'string',
            required: true
          },
          {
            name: '_rel',
            type: 'relationship',
            withType: 'article',
            schema: [
              {
                name: 'relString',
                type: 'string',
                required: true,
                if: {
                  showRelString: true
                }
              },
              {
                name: 'showRelString',
                type: 'boolean'
              }
            ]
          }
        ]
      });

      const article1 = await apos.article.insert(req, {
        ...apos.article.newInstance(),
        title: 'article 1'
      });
      const article2 = await apos.article.insert(req, {
        ...apos.article.newInstance(),
        title: 'article 2'
      });

      article1._fields = {
        showRelString: false
      };

      article2._fields = {
        relString: 'article 2 rel string',
        showRelString: true
      };

      const data = {
        title: 'toto',
        _rel: [
          article1,
          article2
        ]
      };

      const output = {};
      const [ success, errors ] = await testConvert(apos, data, schema, output);
      const foundError = findError(errors, 'relString', 'required');

      const expected = {
        success: false,
        foundError: true
      };

      const actual = {
        success,
        foundError
      };

      assert.deepEqual(expected, actual);
    });

    it('should add proper aposPath to all fields when validation schema', async function () {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'title',
            type: 'string',
            required: true
          },
          {
            name: '_rel',
            type: 'relationship',
            withType: 'article',
            schema: [
              {
                name: 'relString',
                type: 'string'
              }
            ]
          },
          {
            name: 'array',
            type: 'array',
            schema: [
              {
                name: 'arrayString',
                type: 'string'
              },
              {
                name: 'arrayObject',
                type: 'object',
                schema: [
                  {
                    name: 'arrayObjectString',
                    type: 'string'
                  }
                ]
              }
            ]
          },
          {
            name: 'object',
            type: 'object',
            schema: [
              {
                name: 'objectString',
                type: 'string'
              },
              {
                name: 'objectArray',
                type: 'array',
                schema: [
                  {
                    name: 'objectArrayString',
                    type: 'string'
                  }
                ]
              }
            ]
          }
        ]
      });

      apos.schema.validate(schema, 'article');

      const [ titleField, relField, arrayField, objectField ] = schema;
      const expected = {
        title: 'title',
        rel: '_rel',
        relString: '_rel/relString',
        array: 'array',
        arrayString: 'array/arrayString',
        arrayObject: 'array/arrayObject',
        arrayObjectString: 'array/arrayObject/arrayObjectString',
        object: 'object',
        objectString: 'object/objectString',
        objectArray: 'object/objectArray',
        objectArrayString: 'object/objectArray/objectArrayString'
      };

      const actual = {
        title: titleField.aposPath,
        rel: relField.aposPath,
        relString: relField.schema[0].aposPath,
        array: arrayField.aposPath,
        arrayString: arrayField.schema[0].aposPath,
        arrayObject: arrayField.schema[1].aposPath,
        arrayObjectString: arrayField.schema[1].schema[0].aposPath,
        object: objectField.aposPath,
        objectString: objectField.schema[0].aposPath,
        objectArray: objectField.schema[1].aposPath,
        objectArrayString: objectField.schema[1].schema[0].aposPath
      };

      assert.deepEqual(actual, expected);
    });

    it('should set default value to invisible fields that triggered convert errors', async function () {
      const schema = apos.schema.compose({
        addFields: [
          {
            name: 'array',
            type: 'array',
            if: {
              showArray: true
            },
            schema: [
              {
                name: 'arrayString',
                type: 'string',
                pattern: '^cool-'
              },
              {
                name: 'arrayMin',
                type: 'integer',
                min: 5
              },
              {
                name: 'arrayMax',
                type: 'integer',
                max: 10
              }
            ]
          },
          {
            name: 'showArray',
            type: 'boolean'
          }
        ]
      });
      apos.schema.validate(schema, 'foo');

      const input = {
        showArray: false,
        array: [
          {
            arrayString: 'bad string',
            arrayMin: 2,
            arrayMax: 13
          }
        ]
      };

      const req = apos.task.getReq();
      const result = {};
      await apos.schema.convert(req, schema, input, result);

      const expected = {
        arrayString: '',
        arrayMin: 5,
        arrayMax: 10
      };

      const {
        arrayString, arrayMin, arrayMax
      } = result.array[0];
      const actual = {
        arrayString,
        arrayMin,
        arrayMax
      };

      assert.deepEqual(actual, expected);
    });
  });

  async function testSchemaError(schema, input, path, name) {
    const req = apos.task.getReq();
    const result = {};
    let tooFar = false;
    try {
      await apos.schema.convert(req, schema, input, result);
      tooFar = true;
      assert(false);
    } catch (e) {
      if (tooFar) {
        throw e;
      }
      assert(e.length === 1);
      assert(e[0].path === path);
      assert(e[0].name === name);
    }
  }
});

async function testConvert(
  apos,
  data,
  schema,
  output
) {
  const req = apos.task.getReq({ mode: 'draft' });
  try {
    await apos.schema.convert(req, schema, data, output);
    return [ true, [] ];
  } catch (err) {
    return [ false, err ];
  }
}

function findError(errors, fieldPath, errorName) {
  if (!Array.isArray(errors)) {
    return false;
  }
  return errors.some((err) => {
    if (err.data?.errors) {
      const deepFound = findError(err.data.errors, fieldPath, errorName);
      if (deepFound) {
        return deepFound;
      }
    }

    return err.name === errorName && err.path === fieldPath;
  });
}
