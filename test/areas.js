var t = require('../test-lib/test.js');
var assert = require('assert');
var async = require('async');
var apos;

describe('Areas', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: false
        },
        'monkeys': {
          extend: 'apostrophe-pieces',
          name: 'monkey'
        },
        'monkeys-widgets': {
          extend: 'apostrophe-pieces-widgets'
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
      }
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
    }, { delimiter: '' }) === '<h2>So cool</h2><h2>Something else cool</h2>');
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
    }, { wrapper: 'div' }) === '<div><h2>So cool</h2></div><div><h2>Something else cool</h2></div>');
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

  it('area considered empty when it should be', function() {
    var doc = {
      type: 'test',
      _id: 'test',
      body: {
        type: 'area',
        items: []
      },
      emptyText: {
        type: 'area',
        items: [
          {
            _id: 'test2',
            type: 'apostrophe-rich-text',
            content: ''
          }
        ]
      },
      insignificantText: {
        type: 'area',
        items: [
          {
            _id: 'test2',
            type: 'apostrophe-rich-text',
            content: '<h4> </h4>'
          }
        ]
      },
      insignificantPieces: {
        type: 'area',
        items: [
          {
            _id: 'test3',
            type: 'monkeys',
            _pieces: []
          }
        ]
      }
    };
    assert(apos.areas.isEmpty({ area: doc.body }));
    assert(apos.areas.isEmpty(doc, 'body'));
    assert(apos.areas.isEmpty(doc, 'nonexistent'));
    assert(apos.areas.isEmpty(doc, 'emptyText'));
    assert(apos.areas.isEmpty(doc, 'insignificantText'));
    assert(apos.areas.isEmpty(doc, 'insignificantPieces'));
  });

  it('area not considered empty when it should not be', function() {
    var doc = {
      type: 'test',
      _id: 'test',
      body: {
        type: 'area',
        items: [
          {
            _id: 'test2',
            type: 'apostrophe-video',
            url: 'http://somewhere.com'
          }
        ]
      },
      emptyText: {
        type: 'area',
        items: [
          {
            _id: 'test2',
            type: 'apostrophe-rich-text',
            content: ''
          }
        ]
      },
      fullText: {
        type: 'area',
        items: [
          {
            _id: 'test2',
            type: 'apostrophe-rich-text',
            content: '<h4>Some text</h4>'
          }
        ]
      },
      significantPieces: {
        type: 'area',
        items: [
          {
            _id: 'test3',
            type: 'monkeys',
            _pieces: [
              {
                type: 'monkey'
              }
            ]
          }
        ]
      }
    };
    assert(!apos.areas.isEmpty({ area: doc.body }));
    assert(!apos.areas.isEmpty(doc, 'body'));
    assert(!apos.areas.isEmpty(doc, 'fullText'));
    assert(!apos.areas.isEmpty({ area: doc.fullText }));
    assert(!apos.areas.isEmpty(doc, 'significantPieces'));
  });

  it('both isEmpty and legacy empty methods work on schema fields', function() {
    assert(
      !apos.schemas.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schemas.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
    assert(
      !apos.schemas.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schemas.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
  });

  it('when simultaneous updates are attempted to different areas, nothing gets lost', function(done) {
    var home;
    var req = apos.tasks.getReq();
    async.series([
      getHome,
      simultaneousUpdates,
      verifyUpdates
    ], function(err) {
      assert(!err);
      done();
    });
    function getHome(callback) {
      return apos.pages.find(req, { slug: '/' }).toObject(function(err, _home) {
        assert(!err);
        assert(_home);
        home = _home;
        return callback(null);
      });
    }
    function simultaneousUpdates(callback) {
      var areas = [ 'one', 'two', 'three', 'four' ];
      return async.each(areas, function(area, callback) {
        return apos.areas.lockSanitizeAndSaveArea(req, {
          docId: home._id,
          dotPath: area,
          items: [
            {
              type: 'apostrophe-rich-text',
              content: area
            }
          ]
        }, callback);
      }, callback);
    }
    function verifyUpdates(callback) {
      return apos.pages.find(req, { slug: '/' }).toObject(function(err, _home) {
        assert(!err);
        assert(home);
        home = _home;
        var areas = [ 'one', 'two', 'three', 'four' ];
        areas.forEach(function(area) {
          assert(home[area]);
          assert(home[area].items[0].content === area);
        });
        return callback(null);
      });
    }
  });
});
