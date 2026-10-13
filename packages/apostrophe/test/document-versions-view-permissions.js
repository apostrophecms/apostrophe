// Regression tests for GHSA-vh56-5m88-39rq: the change list of a version
// must not include fields restricted by `viewPermission` when the user lacks
// that permission.

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
});
