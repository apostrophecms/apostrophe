var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');

var apos;

var simpleFields = [
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

var realWorldCase = {
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

var pageSlug = [
  {
    type: 'slug',
    name: 'slug',
    page: true
  }
];

var regularSlug = [
  {
    type: 'slug',
    name: 'slug'
  }
];

var hasArea = {
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

  after(function(done) {
    return t.destroy(apos, done);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        }
      },
      afterInit: function(callback) {
        assert(apos.schemas);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should compose schemas correctly', function() {
    var options = {
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
        var variety = _.find(schema, { name: 'variety' });
        assert(variety);
        variety.choices.push({
          value: 'record',
          label: 'Record'
        });
      }
    };
    var schema = apos.schemas.compose(options);
    assert(schema.length === 2);
    assert(schema[0].name === 'name');
    assert(schema[1].name === 'variety');
    assert(_.keys(schema[1].choices).length === 3);
  });

  it('should compose a schema for a complex real world case correctly', function() {
    var schema = apos.schemas.compose(realWorldCase);
    assert(schema);
    var externalUrl = _.find(schema, { name: 'externalUrl' });
    assert(externalUrl);
    assert(externalUrl.group.name === 'info');
    var _newPage = _.find(schema, { name: '_newPage' });
    assert(_newPage);
    assert(_newPage.group.name === 'info');
  });

  it('should error if a field is required and an empty value is submitted for a string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      name: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err === 'name.required');
      done();
    });
  });

  it('should error if the value submitted is less than min length for a string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      name: 'Cow'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err === 'name.min');
      done();
    });
  });

  it('should convert and keep the correct value for a field which is required for a string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      name: 'Apostrophe^CMS'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(result.name === 'Apostrophe^CMS');
      done();
    });
  });

  it('should error if an email address is improperly formed', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'email',
          name: 'email',
          label: 'Email'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      email: 'testguy1%oopsbad'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err === 'email.invalid');
      done();
    });
  });

  it('should tolerate no email value if field not required', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'email',
          name: 'email',
          label: 'Email'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      email: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      done();
    });
  });

  it('should reject no email value if field required', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'email',
          name: 'email',
          label: 'Email',
          required: true
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      email: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      assert(err === 'email.required');
      done();
    });
  });

  it('should accept a well formed email address with a + sign', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'email',
          name: 'email',
          label: 'Email'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      email: 'testguy1+cool@yaygreat.com'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      done();
    });
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === null);
      done();
    });
  });

  it('should keep an empty submitted field value null when there is a min / max configuration for a float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === null);
      done();
    });
  });

  it('should keep an empty submitted field value null for a time field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'time',
          name: 'time',
          label: 'time'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      time: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.time === null);
      done();
    });
  });

  it('should keep an empty submitted field value null for a date field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'date',
          name: 'date',
          label: 'date'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      date: ''
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.date === null);
      done();
    });
  });

  it('should ensure a max value is being trimmed to the max length for a string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      name: 'Apostrophe'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.name === 'Apost');
      done();
    });
  });

  it('should allow saving a 0 value provided as a number if a field is required for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 0
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should gracefully reject null provided as a number if a field is required for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: null
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      assert.equal(err, 'price.required');
      done();
    });
  });

  it('should gracefully reject undefined provided as a number if a field is required for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: undefined
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      assert.equal(err, 'price.required');
      done();
    });
  });

  it('should allow saving a 0 value provided as a float if a field is required for an float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 0.00
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0.00);
      done();
    });
  });

  it('should allow saving a 0 value provided as a number if a field is required for an float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 0
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should allow saving a 0 value provided as a number if a field is required for an string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 0
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === '0');
      done();
    });
  });

  it('should allow saving a 0 value provided as a string if a field is required for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '0'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should allow saving a 0 value provided as a string if a field is required for an string field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '0'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === '0');
      done();
    });
  });

  it('should allow saving a 0 value provided as a string if a field is required for an float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '0'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for an integer field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: '0'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should allow saving a 0 value provided as a string if there is no min value set for a float field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: '0'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 0);
      done();
    });
  });

  it('should allow saving a negative value provided as a number for an integer field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: -1
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === -1);
      done();
    });
  });

  it('should allow saving a negative value provided as a float for an float field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: -1.3
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === -1.3);
      done();
    });
  });

  it('should allow saving a negative value provided as a float for an string field type', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'string',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: -1.3
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === '-1.3');
      done();
    });
  });

  it('should allow saving a negative value provided as a number if a field is required for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: -1
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === -1);
      done();
    });
  });

  it('should allow saving a negative value provided as a number if a field is required for an float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: -1.3
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === -1.3);
      done();
    });
  });

  it('should allow saving a negative value provided as a string if a field is required for an float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '-1.3'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === -1.3);
      done();
    });
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '3'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5);
      done();
    });
  });

  it('should override the saved value if min and max value has been set and the submitted value is out of range for a float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '3.2'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5.1);
      done();
    });
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '1'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5);
      done();
    });
  });

  it('should ensure a min value is being set to the configured min value if a lower value is submitted for a float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '1.2'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5.3);
      done();
    });
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '8'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5);
      done();
    });
  });

  it('should ensure a max value is being set to the max if a higher value is submitted for a float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '8'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5.9);
      done();
    });
  });

  it('should not modify a value if the submitted value is within min and max for an integer field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '5'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 5);
      done();
    });
  });

  it('should not modify a value if the submitted value is within min and max for a float field type', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: '4.3'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(result.price === 4.3);
      done();
    });
  });

  it('should not allow a text value to be submitted for a required integer field', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a required float field', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required integer field with min and max', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required float field with min and max', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required integer field with a default value set', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required float field with a default value set', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required integer field', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should not allow a text value to be submitted for a non required float field', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: 'A'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(err);
      done();
    });
  });

  it('should allow a parsable string/integer value to be submitted for a non required integer field', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'integer',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: '22a'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(result.price === 22);
      done();
    });
  });

  it('should allow a parsable string/float value to be submitted for a non required float field', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'float',
          name: 'price',
          label: 'Price'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      price: '11.4b'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(result.price === 11.4);
      done();
    });
  });

  it('should convert simple data correctly', function(done) {
    var schema = apos.schemas.compose({
      addFields: simpleFields
    });
    assert(schema.length === 5);
    var input = apos.schemas.newInstance(schema);
    Object.assign(input, {
      name: 'Bob Smith',
      address: '5017 Awesome Street\nPhiladelphia, PA 19147',
      irrelevant: 'Irrelevant',
      slug: 'This Is Cool'
    });
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      // no irrelevant or missing fields
      assert(_.keys(result).length === 5);
      // expected fields came through
      assert(result.name === input.name);
      assert(result.address === input.address);
      // default
      assert(result.variety === simpleFields[2].choices[0].value);
      assert(Array.isArray(result.tags) && (result.tags.length === 0));
      assert(result.slug === 'this-is-cool');
      done();
    });
  });

  it('should convert tags correctly', function(done) {
    var schema = apos.schemas.compose({
      addFields: simpleFields
    });
    assert(schema.length === 5);
    var input = {
      tags: [ 4, 5, 'Seven' ]
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      // without def, the default is undefined, so this is right
      assert(_.keys(result.tags).length === 3);
      assert(Array.isArray(result.tags));
      assert(result.tags[0] === '4');
      assert(result.tags[1] === '5');
      // case conversion
      assert(result.tags[2] === 'seven');
      assert(result.slug === 'none');
      done();
    });
  });

  it('should update a password if provided', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      password: 'silly'
    };
    var req = apos.tasks.getReq();
    var result = { password: 'serious' };
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      // hashing is not the business of schemas, see the
      // apostrophe-users module
      assert(result.password === 'silly');
      done();
    });
  });

  it('should leave a password alone if not provided', function(done) {
    var schema = apos.schemas.compose({
      addFields: [
        {
          type: 'password',
          name: 'password',
          label: 'Password'
        }
      ]
    });
    assert(schema.length === 1);
    var input = {
      password: ''
    };
    var req = apos.tasks.getReq();
    var result = { password: 'serious' };
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      // hashing is not the business of schemas, see the
      // apostrophe-users module
      assert(result.password === 'serious');
      done();
    });
  });

  it('should handle array schemas', function(done) {
    var schema = apos.schemas.compose({
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
    var input = {
      addresses: [
        {
          address: '500 test lane'
        },
        {
          address: '602 test ave'
        }
      ]
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      assert(Array.isArray(result.addresses));
      assert(result.addresses.length === 2);
      assert(result.addresses[0].id);
      assert(result.addresses[1].id);
      assert(result.addresses[0].address === '500 test lane');
      assert(result.addresses[1].address === '602 test ave');
      done();
    });
  });

  it('should convert string areas correctly', function(done) {
    var schema = apos.schemas.compose(hasArea);
    assert(schema.length === 1);
    var input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: 'This is the greatest <h1>thing</h1>'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      // no irrelevant or missing fields
      assert(_.keys(result).length === 1);
      // expected fields came through
      assert(result.body);
      assert(result.body.type === 'area');
      assert(result.body.items);
      assert(result.body.items[0]);
      assert(result.body.items[0].type === 'apostrophe-rich-text');
      assert(result.body.items[0].content === apos.utils.escapeHtml(input.body));
      done();
    });
  });

  it('should convert string areas gracefully when they are undefined', function(done) {
    var schema = apos.schemas.compose(hasArea);
    assert(schema.length === 1);
    var input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: undefined
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      // no irrelevant or missing fields
      assert(_.keys(result).length === 1);
      // expected fields came through
      assert(result.body);
      assert(result.body.type === 'area');
      assert(result.body.items);
      assert(!result.body.items[0]);
      done();
    });
  });

  it('should accept csv as a bc equivalent for string in convert', function(done) {
    var schema = apos.schemas.compose(hasArea);
    assert(schema.length === 1);
    var input = {
      irrelevant: 'Irrelevant',
      // Should get escaped, not be treated as HTML
      body: 'This is the greatest <h1>thing</h1>'
    };
    var req = apos.tasks.getReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      // no irrelevant or missing fields
      assert(_.keys(result).length === 1);
      // expected fields came through
      assert(result.body);
      assert(result.body.type === 'area');
      assert(result.body.items);
      assert(result.body.items[0]);
      assert(result.body.items[0].type === 'apostrophe-rich-text');
      assert(result.body.items[0].content === apos.utils.escapeHtml(input.body));
      done();
    });
  });

  it('should clean up extra slashes in page slugs', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    var input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      assert(result.slug === '/wiggy/wacky/wobbly/whizzle');
      done();
    });
  });

  it('retains trailing / on the home page', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({ addFields: pageSlug });
    assert(schema.length === 1);
    var input = {
      slug: '/'
    };
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      assert(result.slug === '/');
      done();
    });
  });

  it('does not keep slashes when page: true not present for slug', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({ addFields: regularSlug });
    assert(schema.length === 1);
    var input = {
      slug: '/wiggy//wacky///wobbly////whizzle/////'
    };
    var result = {};
    return apos.schemas.convert(req, schema, 'string', input, result, function(err) {
      assert(!err);
      assert(result.slug === 'wiggy-wacky-wobbly-whizzle');
      done();
    });
  });

  it('enforces required property for ordinary field', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
      addFields: [
        {
          name: 'age',
          label: 'Age',
          type: 'integer',
          required: true
        }
      ]
    });
    var output = {};
    apos.schemas.convert(req, schema, 'form', { age: '' }, output, function(err) {
      assert(err);
      assert(err === 'age.required');
      done();
    });
  });

  it('ignores required property for hidden field', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: 'shoeSize', age: '' }, output, function(err) {
      assert(!err);
      assert(output.ageOrShoeSize === 'shoeSize');
      done();
    });
  });

  it('enforces required property for shown field', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: 'age', age: '' }, output, function(err) {
      assert(err);
      assert(err === 'age.required');
      done();
    });
  });

  it('ignores required property for recursively hidden field', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: 'age', doWeCare: '0', age: '' }, output, function(err) {
      assert(!err);
      assert(output.ageOrShoeSize === 'age');
      done();
    });
  });

  it('enforces required property for recursively shown field', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: 'age', doWeCare: '1', age: '' }, output, function(err) {
      assert(err);
      assert(err === 'age.required');
      done();
    });
  });

  it('ignores required property for recursively hidden field with checkboxes', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: ['age'], doWeCare: ['0'], age: '' }, output, function(err) {
      assert(!err);
      assert.deepEqual(output.ageOrShoeSize, ['age']);
      done();
    });
  });

  it('enforces required property for recursively shown field with checkboxes', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: ['age', 'shoeSize'], doWeCare: ['1'], age: '' }, output, function(err) {
      assert(err);
      assert(err === 'age.required');
      done();
    });
  });

  it('ignores required property for recursively hidden field with boolean', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: 'age', doWeCare: false, age: '' }, output, function(err) {
      assert(!err);
      assert(output.ageOrShoeSize === 'age');
      done();
    });
  });

  it('enforces required property for recursively shown field with boolean', function(done) {
    var req = apos.tasks.getReq();
    var schema = apos.schemas.compose({
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
    var output = {};
    apos.schemas.convert(req, schema, 'form', { ageOrShoeSize: ['age', 'shoeSize'], doWeCare: true, age: '' }, output, function(err) {
      assert(err);
      assert(err === 'age.required');
      done();
    });
  });

});
