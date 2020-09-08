const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Areas', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.modules['@apostrophecms/area']);
    assert(apos.area);
    // In tests this will be the name of the test file,
    // so override that in order to get apostrophe to
    // listen normally and not try to run a task. -Tom
    apos.argv._ = [];
  });

  it('returns the rich text of an area via the richText method', function() {
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }) === '<h2>So cool</h2>\n<h2>Something else cool</h2>');
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { delimiter: '' }) === '<h2>So cool</h2><h2>Something else cool</h2>');
    assert(apos.area.richText({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { wrapper: 'div' }) === '<div><h2>So cool</h2></div><div><h2>Something else cool</h2></div>');
  });

  it('returns the plaintext of an area via the plaintext method', function() {
    assert.strictEqual(apos.area.plaintext({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }), 'So cool\nSomething else cool');
    assert.strictEqual(apos.area.plaintext({
      metaType: 'area',
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>So cool</h2>'
        },
        {
          metaType: 'widget',
          type: 'something-else',
          content: '<h3>Do not return me</h3>'
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<h2>Something else cool</h2>'
        }
      ]
    }, { limit: 15 }), 'So cool...');
  });

  it('area considered empty when it should be', function() {
    const doc = {
      type: 'test',
      _id: 'test',
      body: {
        metaType: 'area',
        items: []
      },
      emptyText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: ''
          }
        ]
      },
      insignificantText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: '<h4> </h4>'
          }
        ]
      }
    };
    assert(apos.area.isEmpty({ area: doc.body }));
    assert(apos.area.isEmpty(doc, 'body'));
    assert(apos.area.isEmpty(doc, 'nonexistent'));
    assert(apos.area.isEmpty(doc, 'emptyText'));
    assert(apos.area.isEmpty(doc, 'insignificantText'));
  });

  it('area not considered empty when it should not be', function() {
    const doc = {
      type: 'test',
      _id: 'test',
      body: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/video',
            url: 'http://somewhere.com'
          }
        ]
      },
      emptyText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: ''
          }
        ]
      },
      fullText: {
        metaType: 'area',
        items: [
          {
            metaType: 'widget',
            _id: 'test2',
            type: '@apostrophecms/rich-text',
            content: '<h4>Some text</h4>'
          }
        ]
      }
    };
    assert(!apos.area.isEmpty({ area: doc.body }));
    assert(!apos.area.isEmpty(doc, 'body'));
    assert(!apos.area.isEmpty(doc, 'fullText'));
    assert(!apos.area.isEmpty({ area: doc.fullText }));
  });

  it('both isEmpty and legacy empty methods work on schema fields', function() {
    assert(
      !apos.schema.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schema.fieldTypes.boolean.isEmpty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
    assert(
      !apos.schema.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, true)
    );
    assert(
      apos.schema.fieldTypes.boolean.empty({
        type: 'boolean',
        name: 'test'
      }, false)
    );
  });
});
