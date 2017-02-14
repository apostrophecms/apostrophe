var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var t = require('./testUtils');

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

  this.timeout(5000);

  //////
  // EXISTENCE
  //////

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7951
        }
      },
      afterInit: function(callback) {
        assert(apos.schemas);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
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

  it('should convert simple data correctly', function(done) {
    var schema = apos.schemas.compose({
      addFields: simpleFields
    });
    assert(schema.length === 5);
    var input = {
      name: 'Bob Smith',
      address: '5017 Awesome Street\nPhiladelphia, PA 19147',
      irrelevant: 'Irrelevant',
      slug: 'This Is Cool'
    };
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      assert(_.keys(result).length === 1);
      // hashing is not the business of schemas, see the
      // apostrophe-users module
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
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

});
