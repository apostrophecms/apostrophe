let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');

let apos;

let simpleFields = [
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
    name: 'tags',
    label: 'Tags',
    type: 'tags'
  },
  {
    name: 'slug',
    label: 'Slug',
    type: 'slug'
  }
];

let realWorldCase = {
  "addFields": [
    {
      "type": "string",
      "name": "title",
      "label": "Title",
      "required": true,
      "sortify": true
    },
    {
      "type": "slug",
      "name": "slug",
      "label": "Slug",
      "required": true
    },
    {
      "type": "tags",
      "name": "tags",
      "label": "Tags"
    },
    {
      "type": "boolean",
      "name": "published",
      "label": "Published",
      "def": true
    },
    {
      "type": "boolean",
      "name": "trash",
      "label": "Trash",
      "contextual": true,
      "def": false
    },
    {
      "type": "slug",
      "name": "slug",
      "label": "Old URL",
      "required": true,
      "page": true
    },
    {
      "name": "title",
      "label": "Description",
      "type": "string",
      "required": true
    },
    {
      "type": "boolean",
      "name": "published",
      "label": "Published",
      "required": true,
      "def": true,
      "contextual": true
    },
    {
      "name": "urlType",
      "label": "Link To",
      "type": "select",
      "choices": [
        {
          "label": "Internal Page",
          "value": "internal",
          "showFields": [
            "_newPage"
          ]
        },
        {
          "label": "External URL",
          "value": "external",
          "showFields": [
            "externalUrl"
          ]
        }
      ]
    },
    {
      "name": "externalUrl",
      "label": "URL",
      "type": "url"
    },
    {
      "name": "_newPage",
      "type": "joinByOne",
      "withType": "apostrophe-page",
      "label": "Page Title",
      "idField": "pageId"
    }
  ],
  "removeFields": [
    "tags"
  ],
  "arrangeFields": [
    {
      "name": "basics",
      "label": "Basics",
      "fields": [
        "title",
        "slug",
        "published",
        "tags"
      ]
    },
    {
      "name": "permissions",
      "label": "Permissions",
      "fields": [
        "loginRequired",
        "_viewUsers",
        "_viewGroups",
        "_editUsers",
        "_editGroups"
      ],
      "last": true
    },
    {
      "name": "info",
      "label": "Info",
      "fields": [
        "slug",
        "urlType",
        "_newPage",
        "title",
        "externalUrl"
      ]
    }
  ]
};

let pageSlug = [
  {
    type: 'slug',
    name: 'slug',
    page: true
  }
];

let regularSlug = [
  {
    type: 'slug',
    name: 'slug'
  }
];

let hasArea = {
  addFields: [
    {
      type: 'area',
      name: 'body',
      label: 'Body',
      widgets: {
        'apostrophe-rich-text': {}
      }
    }
  ]
};

describe('Schemas', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should be a property of the apos object', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        options: {
          'apostrophe-express': {
            secret: 'xxx',
            port: 7900
          }
        }
      }
    });
    assert(apos.schemas);
    apos.argv._ = [];
  });

  it('should compose schemas correctly', function() {
    let options = {
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
        let variety = _.find(schema, { name: 'variety' });
        assert(variety);
        variety.choices.push({
          value: 'record',
          label: 'Record'
        });
      }
    };
    let schema = apos.schemas.compose(options);
    assert(schema.length === 2);
    assert(schema[0].name === 'name');
    assert(schema[1].name === 'variety');
    assert(_.keys(schema[1].choices).length === 3);
  });

  it('should compose a schema for a complex real world case correctly', function() {
    let schema = apos.schemas.compose(realWorldCase);
    assert(schema);
    let externalUrl = _.find(schema, { name: 'externalUrl' });
    assert(externalUrl);
    assert(externalUrl.group.name === 'info');
    let _newPage = _.find(schema, { name: '_newPage' });
    assert(_newPage);
    assert(_newPage.group.name === 'info');
  });

  it('should error if a field is required and an empty value is submitted for a string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      name: ''
    };
    await testSchemaError(schema, input, 'name', 'required');
  });

  it('should error if the value submitted is less than min length for a string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      name: 'Cow'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await testSchemaError(schema, input, 'name', 'min');
  });

  it('should convert and keep the correct value for a field which is required for a string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      name: 'Apostrophe^CMS'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(result.name === 'Apostrophe^CMS');
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: ''
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === null);
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for a float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: ''
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === null);
  });

  it('should ensure a max value is being trimmed to the max length for a string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      name: 'Apostrophe'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.name === 'Apost');
  });

  it('should allow saving a 0 value provided as a number if a field is required for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 0
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a float if a field is required for an float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 0.00
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0.00);
  });

  it('should allow saving a 0 value provided as a number if a field is required for an float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 0
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a number if a field is required for an string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 0
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '0');
  });

  it('should allow saving a 0 value provided as a string if a field is required for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '0'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if a field is required for an string field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '0'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '0');
  });

  it('should allow saving a 0 value provided as a string if a field is required for an float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '0'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for an integer field type', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: '0'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for a float field type', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: '0'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 0);
  });

  it('should allow saving a negative value provided as a number for an integer field type', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: -1
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1);
  });

  it('should allow saving a negative value provided as a float for an float field type', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: -1.3
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should allow saving a negative value provided as a float for an string field type', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'string',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: -1.3
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === '-1.3');
  });

  it('should allow saving a negative value provided as a number if a field is required for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: -1
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1);
  });

  it('should allow saving a negative value provided as a number if a field is required for an float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: -1.3
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should allow saving a negative value provided as a string if a field is required for an float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '-1.3'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === -1.3);
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '3'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for a float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '3.2'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.1);
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '1'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for a float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '1.2'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.3);
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '8'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for a float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '8'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5.9);
  });

  it('should not modify a value if the submitted value is within min and max for an integer field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '5'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 5);
  });

  it('should not modify a value if the submitted value is within min and max for a float field type', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: '4.3'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.price === 4.3);
  });

  it('should not allow a text value to be submitted for a required integer field', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a required float field', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field with min and max', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field with min and max', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field with a default value set', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field with a default value set', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required integer field', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should not allow a text value to be submitted for a non required float field', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: 'A'
    };
    await testSchemaError(schema, input, 'price', 'invalid');
  });

  it('should allow a parsable string/integer value to be submitted for a non required integer field', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: '22a'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(result.price === 22);
  });

  it('should allow a parsable string/float value to be submitted for a non required float field', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      price: '11.4b'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(result.price === 11.4);
  });

  it('should convert simple data correctly', async () => {
    let schema = apos.schemas.compose({
      addFields: simpleFields
    });
    assert(schema.length === 5);
    let input = {
      name: 'Bob Smith',
      address: '5017 Awesome Street\nPhiladelphia, PA 19147',
      irrelevant: 'Irrelevant',
      slug: 'This Is Cool'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 5);
    // expected fields came through
    assert(result.name === input.name);
    assert(result.address === input.address);
    // default
    assert(result.variety === simpleFields[2].choices[0].value);
    assert(Array.isArray(result.tags) && (result.tags.length === 0));
    assert(result.slug === 'this-is-cool');
  });

  it('should convert tags correctly', async () => {
    let schema = apos.schemas.compose({
      addFields: simpleFields
    });
    assert(schema.length === 5);
    let input = {
      tags: [ 4, 5, 'Seven' ]
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    // without def, the default is undefined, so this is right
    assert(_.keys(result.tags).length === 3);
    assert(Array.isArray(result.tags));
    assert(result.tags[0] === '4');
    assert(result.tags[1] === '5');
    // case conversion
    assert(result.tags[2] === 'seven');
    assert(result.slug === 'none');
  });

  it('should update a password if provided', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      password: 'silly'
    };
    let req = apos.tasks.getReq();
    let result = { password: 'serious' };
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    // hashing is not the business of schemas, see the
    // apostrophe-users module
    assert(result.password === 'silly');
  });

  it('should leave a password alone if not provided', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    let input = {
      password: ''
    };
    let req = apos.tasks.getReq();
    let result = { password: 'serious' };
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    // hashing is not the business of schemas, see the
    // apostrophe-users module
    assert(result.password === 'serious');
  });

  it('should handle array schemas', async () => {
    let schema = apos.schemas.compose({
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
    let input = {
      addresses: [
        {
          address: '500 test lane'
        },
        {
          address: '602 test ave'
        }
      ]
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(_.keys(result).length === 1);
    assert(result.addresses);
    assert(result.addresses.metaType === 'array');
    assert(result.addresses.entries.length === 2);
    assert(result.addresses.entries[0]._id);
    assert(result.addresses.entries[1]._id);
    assert(result.addresses.entries[0].address === '500 test lane');
    assert(result.addresses.entries[1].address === '602 test ave');
  });

  it('should convert string values to areas correctly', async () => {
    let schema = apos.schemas.compose(hasArea);
    assert(schema.length === 1);
    let input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: 'This is the greatest <h1>thing</h1>'
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(result.body.items[0]);
    assert(result.body.items[0].type === 'apostrophe-rich-text');
    assert(result.body.items[0].content === apos.utils.escapeHtml(input.body));
  });

  it('should convert areas gracefully when they are undefined', async () => {
    let schema = apos.schemas.compose(hasArea);
    assert(schema.length === 1);
    let input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: undefined
    };
    let req = apos.tasks.getReq();
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    // no irrelevant or missing fields
    assert(_.keys(result).length === 1);
    // expected fields came through
    assert(result.body);
    assert(result.body.metaType === 'area');
    assert(result.body.items);
    assert(!result.body.items[0]);
  });

  it('should clean up extra slashes in page slugs', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    let input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert.equal(result.slug, '/wiggy/wacky/wobbly/whizzle');
  });

  it('retains trailing / on the home page', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    let input = {
      slug: '/'
    };
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(result.slug === '/');
  });

  it('does not keep slashes when page: true not present for slug', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({ addFields: regularSlug });
    assert(schema.length === 1);
    let input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    let result = {};
    await apos.schemas.convert(req, schema, input, result);
    assert(result.slug === 'wiggy-wacky-wobbly-whizzle');
  });

  it('enforces required property for ordinary field', async () => {
    let schema = apos.schemas.compose({
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

  it('ignores required property for hidden field', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        }
      ]
    });
    let output = {};
    await apos.schemas.convert(req, schema, { ageOrShoeSize: 'shoeSize', age: '' }, output);
    assert(output.ageOrShoeSize === 'shoeSize');
  });

  it('enforces required property for shown field', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, { ageOrShoeSize: 'age', age: '' }, 'age', 'required');
  });

  it('ignores required property for recursively hidden field', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'select',
          choices: [
            {
              label: 'Yes',
              value: '1',
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              label: 'No',
              value: '0',
              showFields: []
            }
          ]
        }
      ]
    });
    let output = {};
    await apos.schemas.convert(req, schema, { ageOrShoeSize: 'age', doWeCare: '0', age: '' }, output);
    assert(output.ageOrShoeSize === 'age');
  });

  it('enforces required property for recursively shown field', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'select',
          choices: [
            {
              label: 'Yes',
              value: '1',
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              label: 'No',
              value: '0',
              showFields: []
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, { ageOrShoeSize: 'age', doWeCare: '1', age: '' }, 'age', 'required');
  });

  it('ignores required property for recursively hidden field with checkboxes', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'checkboxes',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'checkboxes',
          choices: [
            {
              label: 'Yes',
              value: '1',
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              label: 'No',
              value: '0',
              showFields: []
            }
          ]
        }
      ]
    });
    let output = {};
    await apos.schemas.convert(req, schema, { ageOrShoeSize: ['age'], doWeCare: ['0'], age: '' }, output);
    assert.deepEqual(output.ageOrShoeSize, ['age']);
  });

  it('enforces required property for recursively shown field with checkboxes', async () => {
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'checkboxes',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'checkboxes',
          choices: [
            {
              label: 'Yes',
              value: '1',
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              label: 'No',
              value: '0',
              showFields: []
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, { ageOrShoeSize: [ 'age', 'shoeSize' ], doWeCare: [ '1' ], age: '' }, 'age', 'required');
  });

  it('ignores required property for recursively hidden field with boolean', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'select',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'boolean',
          choices: [
            {
              value: true,
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              value: false,
              showFields: []
            }
          ]
        }
      ]
    });
    let output = {};
    await apos.schemas.convert(req, schema, { ageOrShoeSize: 'age', doWeCare: false, age: '' }, output);
    assert(output.ageOrShoeSize === 'age');
  });

  it('enforces required property for recursively shown field with boolean', async () => {
    let req = apos.tasks.getReq();
    let schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          type: 'integer',
          required: true
        },
        {
          name: 'shoeSize',
          type: 'integer',
          required: false
        },
        {
          name: 'ageOrShoeSize',
          type: 'checkboxes',
          choices: [
            {
              label: 'age',
              value: 'age',
              showFields: [ 'age' ]
            },
            {
              label: 'shoeSize',
              value: 'shoeSize',
              showFields: [ 'shoeSize' ]
            }
          ]
        },
        {
          name: 'doWeCare',
          type: 'boolean',
          choices: [
            {
              value: true,
              showFields: [ 'ageOrShoeSize' ]
            },
            {
              value: false,
              showFields: []
            }
          ]
        }
      ]
    });
    await testSchemaError(schema, { ageOrShoeSize: [ 'age', 'shoeSize' ], doWeCare: true, age: '' }, 'age', 'required');
  });
});

async function testSchemaError(schema, input, path, name) {
  const req = apos.tasks.getReq();
  const result = {};
  try {
    await apos.schemas.convert(req, schema, input, result);
    assert(false);
  } catch (e) {
    assert(Array.isArray(e));
    assert(e.length === 1);
    assert(e[0].path === path);
    assert(e[0].error === name);
  }
}
