const assert = require('assert');
const app = require('express')();
const expressCacheOnDemand = require('../index.js')();

describe('expressCacheOnDemand', function () {
  let workCount = 0;
  let server;

  before(function () {
    app.get('/welcome', expressCacheOnDemand, (req, res) => {
      // Simulate time-consuming async work
      setTimeout(() => {
        workCount++;
        return res.send('URL was: ' + req.url + ', work count is: ' + workCount);
      }, 100);
    });
    app.get('/empty', expressCacheOnDemand, (req, res) => {
      // Simulate time-consuming async work
      setTimeout(() => {
        return res.send('');
      }, 100);
    });
    app.get('/redirect', expressCacheOnDemand, (req, res) => {
      return res.redirect('/welcome');
    });
    app.get('/redirect-301', expressCacheOnDemand, (req, res) => {
      return res.redirect(301, '/welcome');
    });
    app.get('/redirect-302', expressCacheOnDemand, (req, res) => {
      return res.redirect(302, '/welcome');
    });

    server = app.listen(9765);
  });

  after(function () {
    server.close();
  });

  it('replies to simultaneous requests with the same response', async function () {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch('http://localhost:9765/welcome').then(async (res) => ({
          status: res.status,
          body: await res.text()
        }))
      )
    );
    for (const { status, body } of results) {
      assert.strictEqual(status, 200);
      assert.strictEqual(body, 'URL was: /welcome, work count is: 1');
    }
  });
  it('replies to a subsequent request with a separate response', async function () {
    const res = await fetch('http://localhost:9765/welcome');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'URL was: /welcome, work count is: 2');
  });
  it('replies correctly when res.send is given an empty string', async function () {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch('http://localhost:9765/empty').then(async (res) => ({
          status: res.status,
          body: await res.text()
        }))
      )
    );
    for (const { status, body } of results) {
      assert.strictEqual(status, 200);
      assert.strictEqual(body, '');
    }
  });
  it('handles redirects successfully', async function () {
    const res = await fetch('http://localhost:9765/redirect');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'URL was: /welcome, work count is: 3');
  });
  describe('handles redirects successfully with different statusCode', function () {
    it('handles 301 statusCode', async function () {
      const res = await fetch('http://localhost:9765/redirect-301', { redirect: 'manual' });
      assert.strictEqual(res.status, 301);
    });
    it('handles 302 statusCode', async function () {
      const res = await fetch('http://localhost:9765/redirect-302', { redirect: 'manual' });
      assert.strictEqual(res.status, 302);
    });
    it('redirects to welcome from 301 statusCode', async function () {
      const res = await fetch('http://localhost:9765/redirect-301', { redirect: 'follow' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(await res.text(), 'URL was: /welcome, work count is: 9');
    });
    it('redirects to welcome from 302 statusCode', async function () {
      const res = await fetch('http://localhost:9765/redirect-302', { redirect: 'follow' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(await res.text(), 'URL was: /welcome, work count is: 10');
    });
  });
  it('replies to separate URLs with separate responses', async function () {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        fetch('http://localhost:9765/welcome?' + i).then(async (res) => ({
          status: res.status,
          body: await res.text()
        }))
      )
    );
    for (const { status } of results) {
      assert.strictEqual(status, 200);
    }
    assert.strictEqual(workCount, 8);
  });
});
