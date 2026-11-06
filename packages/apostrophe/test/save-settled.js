const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// On a request marked with `req.aposSaveMarker`, `afterSaveSettled` follows
// every insert and update once all of its save handlers are done, with the
// stored document from when the save started and from now.

describe('Save settled', function() {

  let apos;
  const events = [];

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'settled-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: {
                type: 'string'
              },
              stamp: {
                type: 'string'
              },
              featured: {
                type: 'boolean'
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              links: {
                type: 'array',
                fields: {
                  add: {
                    label: {
                      type: 'string'
                    }
                  }
                }
              },
              _related: {
                type: 'relationship',
                withType: 'settled-article'
              }
            }
          },
          handlers(self) {
            return {
              afterSave: {
                // Changes the document after it is written, as a save
                // handler may
                async stamp(req, doc) {
                  if (doc.body !== 'stamp me') {
                    return;
                  }
                  doc.stamp = 'stamped';
                  await self.apos.doc.db.updateOne(
                    { _id: doc._id },
                    { $set: { stamp: 'stamped' } }
                  );
                }
              }
            };
          }
        },
        'settled-auto': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        // Saving a relay saves the article it names
        'settled-relay': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              articleId: {
                type: 'string'
              }
            }
          },
          handlers(self) {
            return {
              afterSave: {
                async relay(req, doc) {
                  if (!doc.articleId) {
                    return;
                  }
                  const article = await self.apos.modules['settled-article']
                    .findOneForEditing(req, { _id: doc.articleId });
                  article.body = `relayed by ${doc.title}`;
                  await self.apos.modules['settled-article'].update(req, article);
                }
              }
            };
          }
        },
        'settled-listener': {
          handlers() {
            return {
              '@apostrophecms/doc-type:afterSaveSettled': {
                record(req, doc, settled) {
                  events.push({
                    _id: doc._id,
                    type: doc.type,
                    ...settled
                  });
                }
              }
            };
          }
        }
      }
    });
  });

  beforeEach(function() {
    events.length = 0;
  });

  // Editors and the assistant save drafts
  function draftReq(properties = {}) {
    return apos.task.getReq({
      mode: 'draft',
      ...properties
    });
  }

  function marked(marker = { chat: 'c1' }) {
    return draftReq({ aposSaveMarker: marker });
  }

  // An article saved before the test's own saves, which alone are recorded
  async function given(values) {
    const article = await insertArticle(draftReq(), values);
    events.length = 0;
    return article;
  }

  function insertArticle(req, values = {}) {
    return apos.modules['settled-article'].insert(req, {
      title: 'Article',
      ...values
    });
  }

  async function updateArticle(req, _id, values) {
    const article = await apos.modules['settled-article']
      .findOneForEditing(req, { _id });
    return apos.modules['settled-article'].update(req, {
      ...article,
      ...values
    });
  }

  function eventsFor(_id) {
    return events.filter(event => event._id === _id);
  }

  describe('a marked request', function() {

    it('gets no before for an insert, and the settled document after', async function() {
      const marker = { chat: 'c1' };
      const article = await insertArticle(marked(marker), { body: 'stamp me' });
      const [ event ] = eventsFor(article._id);
      assert.equal(eventsFor(article._id).length, 1);
      assert.equal(event.marker, marker);
      assert.equal(event.before, null);
      assert.equal(event.after._id, article._id);
      // A save handler's change after the write is in `after`
      assert.equal(event.after.stamp, 'stamped');
      assert.deepEqual(event.drops, []);
    });

    it('gets the stored document from before and after an update', async function() {
      const article = await given({ body: 'plain' });
      await updateArticle(marked(), article._id, { body: 'stamp me' });
      const [ event ] = eventsFor(article._id);
      assert.equal(event.before.body, 'plain');
      assert.equal(event.before.stamp, undefined);
      assert.equal(event.after.body, 'stamp me');
      assert.equal(event.after.stamp, 'stamped');
    });

    it('gets the slug a save made unique', async function() {
      const req = marked();
      await insertArticle(req, {
        title: 'Twin',
        slug: 'twin'
      });
      const second = await insertArticle(req, {
        title: 'Twin',
        slug: 'twin'
      });
      const [ event ] = eventsFor(second._id);
      assert.notEqual(event.after.slug, 'twin');
      assert.match(event.after.slug, /^twin/);
    });

    it('chains saves of one document, so a listener can fold them', async function() {
      const article = await given({ body: 'original' });
      const req = marked();
      await updateArticle(req, article._id, { body: 'first' });
      // A clone carries the marker, as a tool handler's request does
      await updateArticle(req.clone(), article._id, { body: 'second' });
      const [ first, second ] = eventsFor(article._id);
      assert.equal(first.before.body, 'original');
      assert.deepEqual(second.before, first.after);
      assert.equal(second.after.body, 'second');
    });

    it('gets the tool call that saved', async function() {
      const req = marked().clone({
        aposAiToolCall: {
          id: 'call-1',
          name: 'update_document'
        }
      });
      const article = await insertArticle(req);
      const [ event ] = eventsFor(article._id);
      assert.deepEqual(event.toolCall, {
        id: 'call-1',
        name: 'update_document'
      });
    });

    it('gets what the save flag healed', async function() {
      const article = await given();
      const stale = {
        _id: apos.util.generateId(),
        metaType: 'widget',
        type: 'removed'
      };
      await apos.doc.db.updateOne({ _id: article._id }, {
        $set: {
          main: {
            _id: apos.util.generateId(),
            metaType: 'area',
            items: [ stale ]
          }
        }
      });
      const req = marked();
      await apos.modules['settled-article'].convertPatchAndRefresh(req, {
        $push: {
          'main.items': {
            _id: apos.util.generateId(),
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>pushed</p>'
          }
        },
        _lossless: true
      }, article._id);
      const [ event ] = eventsFor(article._id);
      assert.deepEqual(event.drops, [
        {
          path: 'main.items.0',
          reason: 'unknownType',
          type: 'removed',
          _id: stale._id
        }
      ]);
    });

    describe('rows between before and after', function() {

      // An article stored before most of its fields existed, saved by a
      // conversion of the whole schema, as the editor saves: its empty values,
      // and the default the editor starts from
      async function saveOverAbsentFields(values) {
        const article = await given({ body: 'old' });
        await apos.doc.db.updateOne({ _id: article._id }, {
          $unset: {
            visibility: 1,
            stamp: 1,
            featured: 1,
            main: 1,
            links: 1,
            relatedIds: 1,
            relatedFields: 1
          }
        });
        await apos.modules['settled-article'].convertUpdateAndRefresh(marked(), {
          title: 'Article',
          slug: article.slug,
          visibility: 'public',
          ...values
        }, article._id);
        const [ event ] = eventsFor(article._id);
        assert.equal(Object.hasOwn(event.before, 'featured'), false);
        assert.equal(Object.hasOwn(event.before, 'visibility'), false);
        return event;
      }

      function names(rows) {
        return rows.map(row => row.path.map(segment => segment.name).join('.'));
      }

      it('lists no change for fields added to the schema since the last save', async function() {
        const { before, after } = await saveOverAbsentFields({ body: 'new' });
        assert.equal(after.featured, false);
        assert.equal(after.visibility, 'public');
        const req = draftReq();
        assert.deepEqual(
          names(await apos.docVersions.getChangeRowsBetween(req, before, after)),
          [ 'body' ]
        );
        // Compared as stored, the boolean and the default still list
        assert.deepEqual(
          names(apos.docVersions.getChangeRows(req, before, after)),
          [ 'visibility', 'body', 'featured' ]
        );
      });

      it('lists a field added since when the save sets it', async function() {
        const { before, after } = await saveOverAbsentFields({
          body: 'old',
          featured: true,
          visibility: 'loginRequired'
        });
        assert.deepEqual(
          names(await apos.docVersions.getChangeRowsBetween(draftReq(), before, after)),
          [ 'visibility', 'featured' ]
        );
      });

      it('lists what an insert set against the empty document', async function() {
        await insertArticle(marked(), {
          body: 'new',
          featured: false
        });
        const [ event ] = events;
        assert.deepEqual(
          names(await apos.docVersions.getChangeRowsBetween(
            draftReq(), event.before, event.after
          )),
          [ 'title', 'slug', 'body' ]
        );
      });

    });

    it('settles the saves nested in an autopublished insert on their own', async function() {
      const req = marked();
      const piece = await apos.modules['settled-auto'].insert(req, { title: 'Auto' });
      const draftId = piece._id;
      const publishedId = draftId.replace(':draft', ':published');
      assert.deepEqual(
        events.map(event => event._id).filter(_id => _id.startsWith(piece.aposDocId)),
        [ publishedId, draftId ]
      );
      const published = eventsFor(publishedId).at(-1);
      assert.equal(published.before, null);
      assert.equal(published.after.title, 'Auto');
    });

    it('settles a document an after-save handler saves before the one it saved', async function() {
      const article = await given({ body: 'original' });
      const relay = await apos.modules['settled-relay'].insert(marked(), {
        title: 'Relay',
        articleId: article._id
      });
      assert.deepEqual(
        events.map(event => event._id),
        [ article._id, relay._id ]
      );
      const [ articleEvent ] = eventsFor(article._id);
      assert.equal(articleEvent.before.body, 'original');
      assert.equal(articleEvent.after.body, 'relayed by Relay');
    });

  });

  describe('an unmarked request', function() {

    it('emits nothing and reads nothing', async function() {
      const article = await given({ body: 'plain' });
      const reads = [];
      const { findOne } = apos.doc.db;
      apos.doc.db.findOne = function(criteria, ...rest) {
        reads.push(criteria);
        return findOne.call(this, criteria, ...rest);
      };
      try {
        await updateArticle(draftReq(), article._id, { body: 'stamp me' });
        await insertArticle(draftReq());
      } finally {
        apos.doc.db.findOne = findOne;
      }
      assert.deepEqual(events, []);
      assert.equal(
        reads.filter(criteria => criteria?._id === article._id).length,
        0
      );
    });

  });

});
