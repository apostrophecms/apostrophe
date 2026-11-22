const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// What AI Localize gives the AI doors to write: `localize_document`, a
// document's copy in other locales, and `record_localization`, the record
// that two copies are in line. Both on the harness's write path, so a door's
// request is recorded and taken back by its revert, records included.

describe('AI Localize: localize_document and record_localization', function () {
  this.timeout(t.timeout);

  let apos;
  const users = {};

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' },
              de: { prefix: '/de' }
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
                name: 'loc-page',
                label: 'Page'
              }
            ]
          }
        },
        'loc-page': {
          extend: '@apostrophecms/page-type'
        },
        'loc-author': {
          extend: '@apostrophecms/piece-type'
        },
        // Only an admin may edit one
        'loc-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            editRole: 'admin'
          }
        },
        'loc-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              summary: { type: 'string' },
              _authors: {
                type: 'relationship',
                withType: 'loc-author'
              },
              _notices: {
                type: 'relationship',
                withType: 'loc-notice'
              }
            }
          }
        },
        'loc-setting': {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          }
        },
        // Published on save, as images and files are
        'loc-photo': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true
          }
        },
        'loc-album': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _photos: {
                type: 'relationship',
                withType: 'loc-photo'
              }
            }
          }
        }
      }
    });
    for (const [ name, role ] of [ [ 'ann', 'admin' ], [ 'bob', 'admin' ], [ 'eve', 'editor' ] ]) {
      users[name] = await apos.user.insert(apos.task.getReq(), {
        username: name,
        title: name[0].toUpperCase() + name.slice(1),
        password: 'test-password',
        role
      });
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  function userReq(username = 'ann', extra = {}) {
    return apos.task.getReq({
      user: users[username],
      mode: 'draft',
      ...extra
    });
  }

  function door(req = userReq(), { revert = false } = {}) {
    return apos.harness.withDoor(req, {
      door: 'assistant',
      lockId: 'chat-1',
      chat: 'chat-1',
      requestId: apos.util.generateId(),
      ...(revert && { revert })
    });
  }

  // Runs a tool as the engine does: arguments validated and defaulted,
  // the result held to its budget
  function run(name, input, req = door()) {
    return apos.ai.executeToolCall(req, apos.ai.getTool(name), {
      id: 'call-1',
      name,
      input
    });
  }

  const articles = () => apos.modules['loc-article'];
  const stored = _id => apos.doc.db.findOne({ _id });
  const inLocale = (doc, locale) => doc._id.replace(/:[^:]+:draft$/, `:${locale}:draft`);
  const records = aposDocId => apos.aiLocalize.recordsDb.find({ aposDocId })
    .sort({ at: 1 })
    .toArray();

  function insert(type, fields, req = userReq()) {
    return apos.modules[type].insert(req, {
      title: 'A document',
      ...fields
    });
  }

  async function edit(_id, change, username = 'ann') {
    const req = userReq(username, { locale: _id.split(':')[1] });
    const draft = await articles().findOneForEditing(req, { _id });
    change(draft);
    return articles().update(req, draft);
  }

  function revert(req, dryRun = false) {
    return apos.harness.revertRequests(
      door(userReq(), { revert: true }),
      [ apos.harness.getDoor(req).requestId ],
      { dryRun }
    );
  }

  it('should be tools of both doors', function () {
    for (const name of [ 'assistant', 'mcp' ]) {
      const names = apos.harness.getDoorTools(name).map(tool => tool.name);
      assert(names.includes('localize_document'), name);
      assert(names.includes('record_localization'), name);
    }
  });

  it('should copy a document into each locale named, untranslated until a record says otherwise', async function () {
    const article = await insert('loc-article', {
      title: 'An article',
      summary: 'In short'
    });

    const result = await run('localize_document', {
      _id: article._id,
      locales: [ 'fr', 'de' ]
    });

    assert.deepEqual(result.written.map(item => [ item._id, item.locale ]), [
      [ inLocale(article, 'fr'), 'fr' ],
      [ inLocale(article, 'de'), 'de' ]
    ]);
    assert.equal(result.written[0].title, 'An article');
    assert.equal(result.written[0].published, false);
    assert.match(result.notice, /saved in the draft/);
    assert.equal(result.refused, undefined);
    const french = await stored(inLocale(article, 'fr'));
    assert.equal(french.aposDocId, article.aposDocId);
    assert.equal(french.summary, 'In short');
    assert.equal(await stored(inLocale(article, 'fr').replace(':draft', ':published')), null);
    const read = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    });
    assert.equal(read.state, 'untranslated');
    assert.deepEqual((await records(article.aposDocId)).map(record => record.via), [
      'copy',
      'copy'
    ]);
  });

  it('should put a page\'s copy where the page is, and refuse one whose parent has no copy', async function () {
    const home = await apos.page.find(userReq(), { level: 0 }).toObject();
    const parent = await apos.page.insert(userReq(), home._id, 'lastChild', {
      type: 'loc-page',
      title: 'Parent'
    });
    const child = await apos.page.insert(userReq(), parent._id, 'lastChild', {
      type: 'loc-page',
      title: 'Child'
    });

    const orphan = await run('localize_document', {
      _id: child._id,
      locales: [ 'de' ]
    });
    await run('localize_document', {
      _id: parent._id,
      locales: [ 'de' ]
    });
    const placed = await run('localize_document', {
      _id: child._id,
      locales: [ 'de' ]
    });

    assert.deepEqual(orphan.written, []);
    assert.equal(orphan.refused[0].reason, 'parentMissing');
    assert.equal(orphan.refused[0].locale, 'de');
    assert.match(orphan.refused[0].message, /localize the parent first/);
    assert.equal(placed.written[0]._id, inLocale(child, 'de'));
    assert.equal(placed.written[0].url, `/de${child.slug}`);
    const copy = await stored(inLocale(child, 'de'));
    assert.equal(copy.path, child.path);
    assert.equal(copy.level, child.level);
  });

  it('should never replace a copy, and go on with the other locales', async function () {
    const article = await insert('loc-article', { title: 'An article' });
    const french = await articles().localize(userReq(), article, 'fr');
    await edit(french._id, draft => {
      draft.title = 'Un article';
    });

    const result = await run('localize_document', {
      _id: article._id,
      locales: [ 'fr', 'de' ]
    });

    assert.deepEqual(result.refused, [ {
      _id: french._id,
      title: 'An article',
      locale: 'fr',
      reason: 'exists',
      message: result.refused[0].message
    } ]);
    assert.match(result.refused[0].message, /never replaced/);
    assert.equal(result.written[0].locale, 'de');
    assert.equal((await stored(french._id)).title, 'Un article');
  });

  it('should copy first the related documents without a copy there, only when asked', async function () {
    const kept = await insert('loc-author', { title: 'Kept' });
    const missing = await insert('loc-author', { title: 'Missing' });
    await apos.modules['loc-author'].localize(userReq(), kept, 'de');
    const article = await insert('loc-article', {
      title: 'An article',
      _authors: [ kept, missing ]
    });

    const plain = await run('localize_document', {
      _id: article._id,
      locales: [ 'fr' ]
    });
    const related = await run('localize_document', {
      _id: article._id,
      locales: [ 'de' ],
      related: true
    });

    assert.deepEqual(plain.written.map(item => item.title), [ 'An article' ]);
    assert.equal(await stored(inLocale(missing, 'fr')), null);
    assert.deepEqual(related.written.map(item => [ item.title, item.related ]), [
      [ 'Missing', true ],
      [ 'An article', undefined ]
    ]);
    const german = await articles().find(userReq('ann', { locale: 'de' }), {
      _id: inLocale(article, 'de')
    }).toObject();
    assert.deepEqual(german._authors.map(author => author.title).sort(), [ 'Kept', 'Missing' ]);
  });

  it('should name a related document the user may not copy, and copy the rest', async function () {
    const notice = await insert('loc-notice', { title: 'A notice' });
    const author = await insert('loc-author', { title: 'An author' });
    const article = await insert('loc-article', {
      title: 'An article',
      _authors: [ author ],
      _notices: [ notice ]
    });

    const result = await run('localize_document', {
      _id: article._id,
      locales: [ 'fr' ],
      related: true
    }, door(userReq('eve')));

    assert.deepEqual(result.written.map(item => item.title), [ 'An author', 'An article' ]);
    assert.deepEqual(result.refused.map(item => [ item.title, item.reason, item.related ]), [
      [ 'A notice', 'forbidden', true ]
    ]);
  });

  it('should refuse a locale the user may not create in, and go on with the others', async function () {
    const article = await insert('loc-article', { title: 'An article' });
    const can = apos.permission.can;
    apos.permission.can = (req, action, ...rest) => {
      return ((action === 'create') && (req.locale === 'de'))
        ? false
        : can(req, action, ...rest);
    };
    let result;
    try {
      result = await run('localize_document', {
        _id: article._id,
        locales: [ 'de', 'fr' ]
      });
    } finally {
      apos.permission.can = can;
    }

    assert.deepEqual(result.refused.map(item => [ item.locale, item.reason ]), [
      [ 'de', 'forbidden' ]
    ]);
    assert.match(result.refused[0].message, /may not create/);
    assert.deepEqual(result.written.map(item => item.locale), [ 'fr' ]);
  });

  it('should refuse a source the user may not edit, its own locale and a type that exists once', async function () {
    const notice = await insert('loc-notice', { title: 'A notice' });
    const article = await insert('loc-article', { title: 'An article' });
    const setting = await insert('loc-setting', { title: 'A setting' });

    await assert.rejects(run('localize_document', {
      _id: notice._id,
      locales: [ 'fr' ]
    }, door(userReq('eve'))), {
      name: 'aiToolError',
      message: /may not edit this document/
    });
    await assert.rejects(run('localize_document', {
      _id: article._id,
      locales: [ 'fr', 'en' ]
    }), {
      name: 'aiToolError',
      message: /name only other locales/
    });
    for (const name of [ 'localize_document', 'record_localization' ]) {
      await assert.rejects(run(name, {
        _id: setting._id,
        locales: [ 'fr' ]
      }), {
        name: 'aiToolError',
        message: /exist once/
      }, name);
    }
  });

  it('should bring a copy up to date in a door\'s request, its writes under the lock and marked as AI\'s, then record it', async function () {
    const article = await insert('loc-article', {
      title: 'An article',
      summary: 'In short'
    });
    const french = await articles().localize(userReq(), article, 'fr');
    await edit(article._id, draft => {
      draft.summary = 'Briefly';
    });
    const req = door();

    const behind = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);
    await apos.doc.lock(userReq('bob'), await stored(french._id), 'bob-tab');
    const locked = await run('update_document', {
      targets: [ {
        _id: french._id,
        values: { summary: 'En bref' }
      } ]
    }, req);
    await apos.doc.unlock(userReq('bob'), await stored(french._id), 'bob-tab');
    const updated = await run('update_document', {
      targets: [ {
        _id: french._id,
        values: { [behind.sourceChanges[0].path]: 'En bref' }
      } ]
    }, req);
    const recorded = await run('record_localization', {
      _id: article._id,
      locales: [ 'fr' ]
    }, req);
    const after = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);

    assert.equal(behind.state, 'behind');
    assert.deepEqual(behind.sourceChanges.map(row => row.path), [ 'summary' ]);
    assert.equal(locked.refused[0].reason, 'locked');
    assert.equal(locked.refused[0].lockedBy, 'Bob');
    assert.equal(updated.written[0]._id, french._id);
    const [ entry ] = await apos.harness.changes
      .find({ requestId: apos.harness.getDoor(req).requestId })
      .toArray();
    assert.equal(entry.docId, french._id);
    assert.equal(entry.ai, true);
    assert.equal(entry.effect, 'update');
    assert.deepEqual(recorded.written.map(item => [ item._id, item.locale ]), [
      [ french._id, 'fr' ]
    ]);
    assert(recorded.written[0].since instanceof Date);
    assert.equal(after.state, 'upToDate');
    assert.equal(after.ai, true);
    assert.equal(after.by, 'Ann');
    const record = (await records(article.aposDocId)).at(-1);
    assert.equal(record.via, 'ai');
    assert.equal(record.requestId, apos.harness.getDoor(req).requestId);
  });

  it('should make a copy, translate and record it in one request, and take all of it back on revert', async function () {
    const author = await insert('loc-author', { title: 'An author' });
    const article = await insert('loc-article', {
      title: 'An article',
      _authors: [ author ]
    });
    const req = door();

    await run('localize_document', {
      _id: article._id,
      locales: [ 'fr' ],
      related: true
    }, req);
    const copied = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);
    await run('update_document', {
      targets: [ {
        _id: inLocale(article, 'fr'),
        values: { title: 'Un article' }
      } ]
    }, req);
    await run('record_localization', {
      _id: article._id,
      locales: [ 'fr' ]
    }, req);
    const translated = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);
    await apos.harness.endRequest(req);
    const entries = await apos.harness.changes
      .find({ requestId: apos.harness.getDoor(req).requestId })
      .toArray();
    const dry = await revert(req, true);
    const done = await revert(req);

    assert.equal(copied.state, 'untranslated');
    assert.equal(translated.state, 'upToDate');
    assert.deepEqual(entries.map(entry => [ entry.docId, entry.effect, entry.ai ]).sort(), [
      [ inLocale(article, 'fr'), 'create', true ],
      [ inLocale(author, 'fr'), 'create', true ]
    ].sort());
    for (const outcomes of [ dry, done ]) {
      assert.deepEqual(outcomes.map(item => [ item.docId, item.outcome ]).sort(), [
        [ inLocale(article, 'fr'), 'deleted' ],
        [ inLocale(author, 'fr'), 'deleted' ]
      ].sort());
    }
    assert.equal(await stored(inLocale(article, 'fr')), null);
    assert.equal(await stored(inLocale(author, 'fr')), null);
    assert.deepEqual(await records(article.aposDocId), []);
    assert.deepEqual(await records(author.aposDocId), []);
  });

  it('should remove a reverted copy that publishes on save, so the next copy finds nothing in its way', async function () {
    const photo = await insert('loc-photo', { title: 'A photo' });
    const album = await insert('loc-album', {
      title: 'An album',
      _photos: [ photo ]
    });
    const copy = () => run('localize_document', {
      _id: album._id,
      locales: [ 'fr' ],
      related: true
    }, req);
    const published = doc => inLocale(doc, 'fr').replace(':draft', ':published');
    let req = door();

    await copy();
    await apos.harness.endRequest(req);
    const live = await stored(published(photo));
    const entry = await apos.harness.changes.findOne({
      requestId: apos.harness.getDoor(req).requestId,
      docId: inLocale(photo, 'fr')
    });
    const dry = await revert(req, true);
    const done = await revert(req);

    assert.equal(live.title, 'A photo');
    assert.equal(entry.effect, 'create');
    assert.equal(entry.localized, true);
    for (const outcomes of [ dry, done ]) {
      assert.deepEqual(outcomes.map(item => [ item.docId, item.outcome ]).sort(), [
        [ inLocale(album, 'fr'), 'deleted' ],
        [ inLocale(photo, 'fr'), 'deleted' ]
      ].sort());
    }
    assert.equal(await stored(inLocale(photo, 'fr')), null);
    assert.equal(await stored(published(photo)), null);
    assert.equal((await stored(photo._id)).archived, false);
    assert.equal((await stored(photo._id.replace(':draft', ':published'))).title, 'A photo');

    req = door();
    const again = await copy();

    assert.deepEqual(again.written.map(item => [ item._id, Boolean(item.related) ]), [
      [ inLocale(photo, 'fr'), true ],
      [ inLocale(album, 'fr'), false ]
    ]);
    const loaded = await apos.modules['loc-album']
      .find(userReq('ann', { locale: 'fr' }), { _id: inLocale(album, 'fr') })
      .toObject();
    assert.deepEqual(loaded._photos.map(doc => doc._id), [ inLocale(photo, 'fr') ]);
  });

  it('should still archive a reverted document the request created itself, when it publishes on save', async function () {
    const req = door();
    const created = await run('create_piece', {
      type: 'loc-photo',
      title: 'A new photo'
    }, req);
    await apos.harness.endRequest(req);
    const entry = await apos.harness.changes.findOne({
      requestId: apos.harness.getDoor(req).requestId
    });

    const done = await revert(req);

    assert.equal(entry.localized, undefined);
    assert.deepEqual(done.map(item => item.outcome), [ 'archived' ]);
    assert.equal((await stored(created.written[0]._id)).archived, true);
  });

  it('should take back the record of a reverted request that wrote nothing else', async function () {
    const article = await insert('loc-article', {
      title: 'An article',
      summary: 'In short'
    });
    await articles().localize(userReq(), article, 'fr');
    await edit(article._id, draft => {
      draft.summary = 'Briefly';
    });
    const req = door();
    await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);
    await run('record_localization', {
      _id: article._id,
      locales: [ 'fr' ]
    }, req);
    const recorded = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    });

    await revert(req, true);
    const checked = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    });
    await revert(req);
    const reverted = await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    });

    assert.equal(recorded.state, 'upToDate');
    assert.equal(checked.state, 'upToDate');
    assert.equal(reverted.state, 'behind');
    assert.deepEqual((await records(article.aposDocId)).map(record => record.via), [ 'localize' ]);
  });

  it('should refuse a record when the source was saved since the door read it, or was never read', async function () {
    const article = await insert('loc-article', { title: 'An article' });
    await articles().localize(userReq(), article, 'fr');
    const req = door();

    const unread = await run('record_localization', {
      _id: article._id,
      locales: [ 'fr' ]
    }, req);
    await run('get_localization', {
      _id: article._id,
      locale: 'fr'
    }, req);
    await edit(article._id, draft => {
      draft.summary = 'Saved meanwhile';
    }, 'bob');
    const saved = await run('record_localization', {
      _id: article._id,
      locales: [ 'fr', 'de' ]
    }, req);

    assert.deepEqual(unread.written, []);
    assert.equal(unread.refused[0].reason, 'changed');
    assert.deepEqual(saved.refused.map(item => [ item.locale, item.reason ]), [
      [ 'fr', 'changed' ],
      [ 'de', 'notfound' ]
    ]);
    assert.match(saved.refused[0].message, /saved since you last read it/);
    assert.match(saved.refused[1].message, /localize_document makes one/);
    assert.deepEqual((await records(article.aposDocId)).map(record => record.via), [ 'localize' ]);
  });

  it('should record from the source named by its locale, checked as read', async function () {
    const article = await insert('loc-article', { title: 'An article' });
    const french = await articles().localize(userReq(), article, 'fr');
    await edit(article._id, draft => {
      draft.summary = 'New in the source';
    });
    const req = door();
    const input = {
      _id: french._id,
      from: 'en',
      locales: [ 'fr' ]
    };

    const unread = await run('record_localization', input, req);
    await run('get_localization', {
      _id: french._id,
      from: 'en',
      locale: 'fr'
    }, req);
    const recorded = await run('record_localization', input, req);

    assert.equal(unread.refused[0].reason, 'changed');
    assert.deepEqual(recorded.written.map(item => [ item._id, item.locale ]), [
      [ french._id, 'fr' ]
    ]);
    const latest = (await records(article.aposDocId)).at(-1);
    assert.deepEqual([ latest.from, latest.to, latest.via ], [ 'en', 'fr', 'ai' ]);
  });

  it('should say a copy in the archive stands in the way, and that an editor restores it', async function () {
    const article = await insert('loc-article', { title: 'An article' });
    const french = await articles().localize(userReq(), article, 'fr');
    await apos.doc.db.updateOne({ _id: french._id }, { $set: { archived: true } });

    const result = await run('localize_document', {
      _id: article._id,
      locales: [ 'fr' ]
    });

    assert.deepEqual(result.written, []);
    assert.equal(result.refused[0].reason, 'exists');
    assert.match(result.refused[0].message, /in the archive, and no tool restores a document/);
  });

  it('should refuse a record of a copy the user may not edit', async function () {
    const notice = await insert('loc-notice', { title: 'A notice' });
    await apos.modules['loc-notice'].localize(userReq(), notice, 'fr');
    const req = door(userReq('eve'));
    await apos.harness.rememberSeen(req, await stored(notice._id));

    const result = await run('record_localization', {
      _id: notice._id,
      locales: [ 'fr' ]
    }, req);

    assert.equal(result.refused[0].reason, 'forbidden');
    assert.match(result.refused[0].message, /may not edit the copy/);
  });

  it('should replace an existing copy only when asked, under its lock', async function () {
    const article = await insert('loc-article', {
      title: 'An article',
      summary: 'In short'
    });
    const french = await articles().localize(userReq(), article, 'fr');
    await edit(french._id, draft => {
      draft.summary = 'En bref';
    });
    const source = await articles().findOneForEditing(userReq(), { _id: article._id });

    await assert.rejects(
      apos.aiLocalize.localizeUntranslated(userReq(), source, 'fr'),
      { name: 'conflict' }
    );
    await apos.doc.lock(userReq('bob'), await stored(french._id), 'bob-tab');
    await assert.rejects(
      apos.aiLocalize.localizeUntranslated(userReq(), source, 'fr', { update: true }),
      { name: 'locked' }
    );
    await apos.doc.unlock(userReq('bob'), await stored(french._id), 'bob-tab');
    const copy = await apos.aiLocalize.localizeUntranslated(userReq(), source, 'fr', {
      update: true
    });

    assert.equal(copy.summary, 'In short');
    assert.equal((await records(article.aposDocId)).at(-1).via, 'copy');
  });
});
