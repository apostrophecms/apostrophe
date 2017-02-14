var assert = require('assert');
var _ = require('lodash');
var apos;

describe('Areas', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7953,
          csrf: false
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-areas']);
        assert(apos.areas);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      },
    });
  });

  it('returns the rich text of an area via the richText method', function() {
    assert(apos.areas.richText({
      type: 'area',
      items: [
        {
          type: 'apostrophe-rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          type: 'apostrophe-rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }) === '<h2>So cool</h2>\n<h2>Something else cool</h2>');
    assert(apos.areas.richText({
      type: 'area',
      items: [
        {
          type: 'apostrophe-rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          type: 'apostrophe-rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { delimiter: ''}) === '<h2>So cool</h2><h2>Something else cool</h2>');
    assert(apos.areas.richText({
      type: 'area',
      items: [
        {
          type: 'apostrophe-rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          type: 'apostrophe-rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { wrapper: 'div'}) === '<div><h2>So cool</h2></div><div><h2>Something else cool</h2></div>');
  });

  it('returns the plaintext of an area via the plaintext method', function() {
    assert.strictEqual(apos.areas.plaintext({
      type: 'area',
      items: [
        {
          type: 'apostrophe-rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          type: 'apostrophe-rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }), 'So cool\nSomething else cool');
    assert.strictEqual(apos.areas.plaintext({
      type: 'area',
      items: [
        {
          type: 'apostrophe-rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          type: 'apostrophe-rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { limit: 15 }), 'So cool...');
  });

});
