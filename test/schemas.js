const assert = require('assert').strict;
const _ = require('lodash');
const t = require('../test-lib/test.js');

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

describe('Schemas', function() {

  this.timeout(t.timeout);

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
    assert(result.variety === simpleFields[2].choices[0].value);
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
      moduleName: 'external-condition'
    };

    const res = await apos.http.get('/api/v1/@apostrophecms/schema/evaluate-external-condition?fieldId=some-field-id&docId=some-doc-id&conditionKey=externalCondition()', {});
    assert(res.result === 'yes');
  });

  it('should warn when an argument is passed in the external condition key via the evaluate-external-condition API', async function() {
    apos.schema.fieldsById['some-field-id'] = {
      name: 'someField',
      moduleName: 'external-condition'
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
      assert(error.body.message === 'The "unknown-module" module defined in the "someField" field does not exist.');
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
      assert(error.body.message === 'The "unknownMethod" method from "external-condition" module defined in the "someField" field does not exist.');
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
