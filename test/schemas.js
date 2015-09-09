var assert = require('assert');
var _ = require('lodash');
var async = require('async');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      _permissions: {
        admin: true
      }
    }
  });
}

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

describe('Schemas', function() {
  //////
  // EXISTENCE
  //////

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
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
    var req = adminReq();
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
    var req = adminReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      // without def, the default is undefined, so this is right
      assert(_.keys(result).length === 3);
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
    var req = adminReq();
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
    var req = adminReq();
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
    var req = adminReq();
    var result = {};
    return apos.schemas.convert(req, schema, 'form', input, result, function(err) {
      assert(!err);
      console.log(result);
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

});
