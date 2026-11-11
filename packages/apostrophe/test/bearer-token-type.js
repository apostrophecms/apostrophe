const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Bearer token type checking', function() {

  let apos;
  let token;

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module
    });
    await t.createAdmin(apos, {
      username: 'admin',
      password: 'admin'
    });
    const result = await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: false
      }
    });
    token = result.token;
    assert(token);
  });

  async function getStatus(url, options = {}) {
    try {
      await apos.http.get(url, options);
      return 200;
    } catch (e) {
      return e.status;
    }
  }

  async function postStatus(url, options = {}) {
    try {
      await apos.http.post(url, options);
      return 200;
    } catch (e) {
      return e.status;
    }
  }

  it('accepts a valid bearer token', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert(response.results.length);
  });

  it('accepts a valid access_token query parameter', async function() {
    const response = await apos.http.get(`/api/v1/@apostrophecms/user?access_token=${token}`);
    assert(response.results.length);
  });

  it('does not authenticate with a query operator in the access_token query parameter', async function() {
    for (const qs of [
      'access_token[$gt]=',
      'access_token[$ne]',
      'access_token[$regex]=.',
      `access_token[]=${token}`
    ]) {
      const status = await getStatus(`/api/v1/@apostrophecms/user?${qs}`);
      assert.notStrictEqual(status, 200, qs);
    }
  });

  it('does not allow writes with a query operator in the access_token query parameter', async function() {
    const status = await postStatus('/api/v1/@apostrophecms/user?access_token[$gt]=', {
      body: {
        title: 'intruder',
        username: 'intruder',
        password: 'intruder',
        email: 'intruder@test.io',
        role: 'admin'
      }
    });
    assert.notStrictEqual(status, 200);
    const intruder = await apos.user.find(apos.task.getReq(), {
      username: 'intruder'
    }).toObject();
    assert(!intruder);
  });

  it('does not authenticate with a query operator in a JSON access_token body property', async function() {
    const status = await postStatus('/api/v1/@apostrophecms/user', {
      body: {
        access_token: { $gt: '' },
        title: 'intruder2',
        username: 'intruder2',
        password: 'intruder2',
        email: 'intruder2@test.io',
        role: 'admin'
      }
    });
    assert.notStrictEqual(status, 200);
    const intruder = await apos.user.find(apos.task.getReq(), {
      username: 'intruder2'
    }).toObject();
    assert(!intruder);
  });
});
