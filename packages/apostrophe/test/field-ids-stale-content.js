const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

// Array items and objects are annotated with field ids when loaded and saved,
// even when the stored content no longer matches the schema or the user
// cannot edit the field

describe('Field ids and content that does not match the schema', function() {
  let apos;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          fields: {
            add: {
              list: {
                type: 'array',
                label: 'List',
                fields: {
                  add: {
                    title: {
                      type: 'string',
                      label: 'Title'
                    }
                  }
                }
              },
              // Only users who can edit users (admins) may edit this field
              restricted: {
                type: 'array',
                label: 'Restricted',
                editPermission: {
                  action: 'edit',
                  type: '@apostrophecms/user'
                },
                fields: {
                  add: {
                    title: {
                      type: 'string',
                      label: 'Title'
                    },
                    body: {
                      type: 'area',
                      label: 'Body',
                      options: {
                        widgets: {
                          '@apostrophecms/rich-text': {}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function richTextArea() {
    return {
      _id: apos.util.generateId(),
      metaType: 'area',
      items: [
        {
          _id: apos.util.generateId(),
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>hello</p>'
        }
      ]
    };
  }

  // Inserts an article, then writes `$set` straight to the database to
  // simulate content stored under an earlier version of the schema
  async function insertWithStoredData(slug, $set) {
    const req = apos.task.getReq({ mode: 'draft' });
    const article = await apos.article.insert(req, {
      title: slug,
      slug
    });
    await apos.doc.db.updateOne({ _id: article._id }, { $set });
    return {
      req,
      _id: article._id
    };
  }

  it('annotates a doc for an external front despite an orphaned array field containing an area', async function() {
    const { req, _id } = await insertWithStoredData('orphan', {
      oldItems: [
        {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          scopedArrayName: 'article.oldItems',
          title: 'left behind',
          body: richTextArea()
        }
      ]
    });
    const doc = await apos.article.find(req, { _id }).toObject();
    assert.equal(doc.oldItems[0]._edit, true);

    await assert.doesNotReject(
      () => apos.template.annotateDocForExternalFront(doc, { req })
    );
  });

  it('annotates a doc saved by a user who cannot edit an array field', async function() {
    const req = apos.task.getReq({
      role: 'editor',
      mode: 'draft'
    });
    assert.equal(apos.permission.can(req, 'edit', '@apostrophecms/user'), false);

    const article = await apos.article.insert(req, {
      title: 'restricted',
      slug: 'restricted',
      restricted: [
        {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          title: 'item',
          body: richTextArea()
        }
      ]
    });
    assert.doesNotThrow(() => apos.util.getManagerOf(article.restricted[0]));

    article.title = 'restricted (updated)';
    const updated = await apos.article.update(req, article);
    assert.doesNotThrow(() => apos.util.getManagerOf(updated.restricted[0]));
  });

  it('loads a doc whose array field still holds an object', async function() {
    const { req, _id } = await insertWithStoredData('list-object', {
      list: { title: 'was an object' }
    });
    const doc = await apos.article.find(req, { _id }).toObject();
    assert(doc);
  });

  it('loads a doc whose array field still holds a string', async function() {
    const { req, _id } = await insertWithStoredData('list-string', {
      list: 'was a string'
    });
    const doc = await apos.article.find(req, { _id }).toObject();
    assert(doc);
  });
});
