const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Image tags', function() {

  let apos;
  let jar;

  this.timeout(t.timeout);

  // Initialization, not a test: boot apostrophe and log in an admin, so any
  // single test below can run in isolation (e.g. with `.only`).
  before(async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.image);
    assert(apos.modules['@apostrophecms/image-tag']);

    const user = apos.user.newInstance();
    Object.assign(user, {
      title: 'admin',
      username: 'admin',
      password: 'admin',
      email: 'ad@min.com',
      role: 'admin'
    });
    await apos.user.insert(apos.task.getReq(), user);
    jar = await login('admin');
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should reuse an existing tag instead of creating a duplicate', async function() {
    const manager = apos.modules['@apostrophecms/image-tag'];
    // A tag the editor's popover would not necessarily have loaded.
    const existing = await manager.insert(apos.task.getReq(), {
      ...manager.newInstance(),
      title: 'Reused Tag'
    });

    const response = await tagCreate('Reused Tag');
    assert(response.jobId);

    const ids = await distinctTagIds('Reused Tag');
    assert.equal(ids.length, 1, 'exactly one image-tag for the title');
    assert.equal(ids[0], existing.aposDocId, 'the existing tag was reused');
  });

  it('should not create duplicates under concurrent create requests', async function() {
    const title = 'Concurrent Tag';

    await Promise.all([
      tagCreate(title),
      tagCreate(title)
    ]);

    const ids = await distinctTagIds(title);
    assert.equal(ids.length, 1, 'exactly one image-tag despite concurrent creates');
  });

  // The `tag` route runs the find-or-create before the (here empty) batch
  // job, so no images are needed to exercise it.
  async function tagCreate(title) {
    return apos.http.post('/api/v1/@apostrophecms/image/tag', {
      body: {
        _ids: [],
        operation: 'create',
        title
      },
      jar
    });
  }

  async function distinctTagIds(title) {
    const docs = await apos.doc.db
      .find({
        type: '@apostrophecms/image-tag',
        title
      })
      .toArray();
    return [ ...new Set(docs.map(doc => doc.aposDocId)) ];
  }

  async function login(username, password = username) {
    const loginJar = apos.http.jar();
    let page = await apos.http.get('/', { jar: loginJar });
    assert(page.match(/logged out/));
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username,
        password,
        session: true
      },
      jar: loginJar
    });
    page = await apos.http.get('/', { jar: loginJar });
    assert(page.match(/logged in/));
    return loginJar;
  }
});
