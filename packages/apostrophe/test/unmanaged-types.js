const t = require('../test-lib/test.js');
const assert = require('assert').strict;

// Leftover content of a page type or widget type whose module was removed
// from the project: Apostrophe warns about it and keeps working
describe('Unmanaged types', function() {
  let apos;
  let jar;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'gone-page': {
          extend: '@apostrophecms/page-type'
        },
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'gone-page',
                label: 'Gone'
              }
            ]
          }
        }
      }
    });
    await t.createAdmin(apos);
    jar = await t.loginAs(apos, 'admin');
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should serve the page tree when it holds a page of an unmanaged type', async function() {
    const req = apos.task.getReq({ mode: 'draft' });
    const page = await apos.page.insert(req, '_home', 'lastChild', {
      type: 'gone-page',
      title: 'Gone'
    });
    await apos.page.publish(req, page);
    await orphan(apos, 'gone-page', 'removed-page');

    const tree = await apos.http.get('/api/v1/@apostrophecms/page', {
      qs: {
        all: '1',
        aposMode: 'draft'
      },
      jar
    });
    assert(tree._children.some(child => child.type === 'removed-page'));

    const home = await apos.http.get(`/api/v1/@apostrophecms/page/${tree._id}`, {
      qs: {
        aposMode: 'draft',
        children: '1'
      },
      jar
    });
    assert.equal(home._id, tree._id);
  });

  it('should drop a widget of an unmanaged type when a doc is saved', async function() {
    const article = await apos.http.post('/api/v1/article', {
      body: {
        title: 'An article',
        main: area()
      },
      jar
    });

    assert.deepEqual(article.main.items.map(item => item.type), [ '@apostrophecms/rich-text' ]);
  });

  it('should drop a widget of an unmanaged type when a doc is copied', function() {
    const req = apos.task.getReq();
    const doc = { main: area() };

    apos.schema.regenerateIds(req, apos.modules.article.schema, doc);

    assert.notEqual(doc.main._id, 'area');
    assert.deepEqual(doc.main.items.map(item => item.type), [ '@apostrophecms/rich-text' ]);
    assert.equal(doc.main.items[0]._originalId, 'kept');
    assert.notEqual(doc.main.items[0]._id, 'kept');
  });

  // An area holding a configured widget and one whose module is gone
  function area() {
    return {
      _id: 'area',
      metaType: 'area',
      items: [
        {
          _id: 'kept',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Kept</p>'
        },
        {
          _id: 'removed',
          metaType: 'widget',
          type: 'removed'
        }
      ]
    };
  }

  // What a project that removed the module of `type` leaves behind: docs of
  // a `newType` nothing manages, and the placeholder manager startup
  // registers for it
  async function orphan(apos, type, newType) {
    await apos.doc.db.updateMany({ type }, { $set: { type: newType } });
    await apos.page.compiledHandlers.apostrophe.modulesRegistered.manageOrphans();
  }
});
