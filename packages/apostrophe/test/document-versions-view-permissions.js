// Regression tests for GHSA-vh56-5m88-39rq: the change list, the change
// counts and the change highlights of a version must not include fields
// restricted by `viewPermission` when the user lacks that permission.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const { getReq } = require('./utils/document-versions.js');

describe('Document versions: viewPermission fields in change lists (GHSA-vh56-5m88-39rq)', function() {
  let apos;
  const jars = {};

  this.timeout(t.timeout);

  // Editors can edit everything except users, so this restricts the field
  // to admins while editors can still edit the document
  const viewPermission = {
    action: 'edit',
    type: '@apostrophecms/user'
  };

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              articleSecret: {
                type: 'string',
                label: 'Article Secret',
                viewPermission
              }
            }
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  // Versions are ordered by `createdAt` alone, so each one must be recorded
  // in a later millisecond than the previous one: databases order ties
  // differently
  async function nextMillisecond() {
    const now = Date.now();
    while (Date.now() <= now) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  async function insertChangedArticle() {
    const req = getReq(apos, { mode: 'draft' });
    const article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article',
      articleSecret: 'OLD-SECRET-VALUE'
    });
    // Another author, so that the change is a version of its own
    const otherReq = getReq(apos, {
      mode: 'draft',
      _id: 'otherUserId',
      username: 'other'
    });
    await nextMillisecond();
    await apos.modules.article.update(otherReq, {
      ...article,
      title: 'Article v2',
      articleSecret: 'NEW-SECRET-VALUE'
    });
    const [ current ] = await apos.docVersions.find(
      req,
      apos.docVersions.getTimelineCriteria(article)
    );
    return current;
  }

  function getChanges(role, versionId, query = {}) {
    return apos.http.get(
      `/api/v1/@apostrophecms/document-versions/${versionId}/changes`,
      {
        jar: jars[role],
        qs: query
      }
    );
  }

  function fieldNames(rows) {
    return rows.map(row => row.path[0].name);
  }

  for (const query of [ {}, { consolidate: 1 } ]) {
    const suffix = query.consolidate ? ' (consolidated)' : '';

    it(`should not list viewPermission fields to an editor lacking the permission${suffix}`, async function() {
      const version = await insertChangedArticle();
      const changes = await getChanges('editor', version._id, query);
      assert(fieldNames(changes.rows).includes('title'));
      assert(!fieldNames(changes.rows).includes('articleSecret'));
      assert.equal(changes.counts.modified, changes.rows.length);
      const json = JSON.stringify(changes);
      assert(!json.includes('SECRET-VALUE'), 'SECRET-VALUE leaked');
    });

    it(`should list viewPermission fields to an admin${suffix}`, async function() {
      const version = await insertChangedArticle();
      const changes = await getChanges('admin', version._id, query);
      assert(fieldNames(changes.rows).includes('title'));
      assert(fieldNames(changes.rows).includes('articleSecret'));
      assert(JSON.stringify(changes).includes('NEW-SECRET-VALUE'));
    });
  }

  // Three versions: the first by one author, the next two by another, the
  // last saved with AI so that those two consolidate. Each of the last two
  // changes the title and the restricted field
  async function recordArticle() {
    const req = getReq(apos, { mode: 'draft' });
    const article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: 'Article',
      articleSecret: 'OLD-SECRET-VALUE'
    });
    const otherReq = getReq(apos, {
      mode: 'draft',
      _id: 'otherUserId',
      username: 'other'
    });
    await nextMillisecond();
    await apos.docVersions.saveFor(otherReq, {
      ...article,
      title: 'Article v2',
      articleSecret: 'NEW-SECRET-VALUE'
    }, true);
    await nextMillisecond();
    await apos.docVersions.saveFor(otherReq.clone({ aposAi: true }), {
      ...article,
      title: 'Article v3',
      articleSecret: 'NEWER-SECRET-VALUE'
    }, true);
    const versions = await apos.docVersions.find(
      req,
      apos.docVersions.getTimelineCriteria(article)
    );
    return {
      article,
      versions
    };
  }

  function getTimeline(role, article, query = {}) {
    return apos.http.get('/api/v1/@apostrophecms/document-versions', {
      jar: jars[role],
      qs: {
        docId: article._id,
        ...query
      }
    });
  }

  function getVersion(role, versionId, query = {}) {
    return apos.http.get(`/api/v1/@apostrophecms/document-versions/${versionId}`, {
      jar: jars[role],
      qs: query
    });
  }

  const expectedCounts = {
    editor: 1,
    admin: 2
  };

  for (const role of [ 'editor', 'admin' ]) {
    const visible = role === 'admin' ? 'counts' : 'does not count';

    it(`${visible} viewPermission fields in the timeline change counts (${role})`, async function() {
      const { article } = await recordArticle();
      const { results } = await getTimeline(role, article);
      assert.deepEqual(
        results.map(item => item.changeCount),
        [ expectedCounts[role], expectedCounts[role], 0 ]
      );
    });

    it(`${visible} viewPermission fields in the consolidated timeline change counts (${role})`, async function() {
      const { article } = await recordArticle();
      const { results } = await getTimeline(role, article, { consolidate: 1 });
      assert.equal(results.length, 2);
      assert.equal(results[0].versionIds.length, 2);
      assert.deepEqual(
        results.map(item => item.changeCount),
        [ expectedCounts[role], 0 ]
      );
    });

    it(`${visible} viewPermission fields in the change count of one version (${role})`, async function() {
      const { versions } = await recordArticle();
      const version = await getVersion(role, versions[0]._id);
      assert.equal(version.changeCount, expectedCounts[role]);
    });

    for (const query of [ { annotate: 1 }, {
      annotate: 1,
      consolidate: 1
    } ]) {
      const suffix = query.consolidate ? ', consolidated' : '';
      const shows = role === 'admin' ? 'highlights' : 'does not highlight';

      it(`${shows} viewPermission fields in an annotated version (${role}${suffix})`, async function() {
        const { versions } = await recordArticle();
        const { doc } = await getVersion(role, versions[0]._id, query);
        const highlighted = Object.keys(doc.aposMeta || {});
        assert(highlighted.includes('title'));
        assert.equal(highlighted.includes('articleSecret'), role === 'admin');
      });
    }
  }
});
