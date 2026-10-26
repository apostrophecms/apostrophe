const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// An `@<_id>` patch names the document's own content. A widget pushed with
// its relationships loaded can carry a copy of the very area it is pushed
// into, when it relates to the page it lives on.

describe('Patch by @ reference', function() {

  let apos;
  let jar;

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'link-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              _pages: {
                type: 'relationship',
                withType: 'default-page'
              }
            }
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    link: {}
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
                name: 'default-page',
                label: 'Default'
              }
            ]
          }
        }
      }
    });
    await t.createAdmin(apos);
    jar = await t.loginAs(apos, 'admin');
    // Sets the CSRF cookie
    await apos.http.get('/', { jar });
  });

  function richText(content) {
    return {
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${content}</p>`
    };
  }

  function link(page) {
    return {
      metaType: 'widget',
      type: 'link',
      _pages: [ { _id: page._id } ]
    };
  }

  function draftUrl(page) {
    return `/api/v1/@apostrophecms/page/${page.aposDocId}:en:draft`;
  }

  async function insert(title, items) {
    return apos.http.post('/api/v1/@apostrophecms/page?aposMode=draft', {
      body: {
        _targetId: '_home',
        _position: 'lastChild',
        type: 'default-page',
        title,
        main: {
          metaType: 'area',
          items
        }
      },
      jar
    });
  }

  async function get(page) {
    return apos.http.get(draftUrl(page), { jar });
  }

  async function push(page, ...widgets) {
    return apos.http.patch(draftUrl(page), {
      body: {
        $push: {
          [`@${page.main._id}.items`]: {
            $each: widgets
          }
        }
      },
      jar
    });
  }

  // As the area editor duplicates a widget: a new `_id`, relationships
  // left as loaded
  function duplicate(widget) {
    return {
      ...widget,
      _id: apos.util.generateId()
    };
  }

  function contents(page) {
    return page.main.items.map(item => (item.type === 'link'
      ? `link to ${item._pages.map(related => related.title).join()}`
      : item.content));
  }

  async function duplicateAfterAnEdit(target) {
    const page = await insert('Page', [ richText('One') ]);
    await push(page, link(target === 'self' ? page : target));
    // The editor's copy of the link, loaded before the next edit
    const loaded = await get(page);
    await push(page, richText('Two'));
    await push(page, duplicate(loaded.main.items[1]));
    return page;
  }

  it('should duplicate a widget that relates to its own page, keeping the other widgets', async function() {
    const page = await duplicateAfterAnEdit('self');

    assert.deepEqual(contents(await get(page)), [
      '<p>One</p>',
      'link to Page',
      '<p>Two</p>',
      'link to Page'
    ]);
  });

  it('should duplicate a widget that relates to another page, keeping the other widgets', async function() {
    const other = await insert('Other', [ richText('Elsewhere') ]);
    const page = await duplicateAfterAnEdit(other);

    assert.deepEqual(contents(await get(page)), [
      '<p>One</p>',
      'link to Other',
      '<p>Two</p>',
      'link to Other'
    ]);
  });
});
