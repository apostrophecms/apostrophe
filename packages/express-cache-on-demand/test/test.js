/* jshint node:true */

const assert = require('assert');
const request = require('request');
const app = require('express')();
const expressCacheOnDemand = require('../index.js')();

describe('expressCacheOnDemand', () => {
  let workCount = 0;
  let server;

  before(() => {
    app.get('/welcome', expressCacheOnDemand, (req, res) => {
      // Simulate time-consuming async work
      setTimeout(() => {
        workCount++;
        return res.send('URL was: ' + req.url + ', work count is: ' + workCount);
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

  after(() => {
    server.close();
  });

  it('replies to simultaneous requests with the same response', (done) => {
    let count = 0;

    for (let i = 0; (i < 5); i++) {
      attempt(i);
    }

    function attempt(i) {
      request('http://localhost:9765/welcome', (err, response, body) => {
        assert(!err);
        assert(response.statusCode === 200);
        assert(body === 'URL was: /welcome, work count is: 1');
        count++;

        if (count === 5) {
          done();
        }
      });
    }
  });
  it('replies to a subsequent request with a separate response', (done) => {
    request('http://localhost:9765/welcome', (err, response, body) => {
      assert(!err);
      assert(response.statusCode === 200);
      assert(body === 'URL was: /welcome, work count is: 2');

      done();
    });
  });
  it('handles redirects successfully', (done) => {
    return request('http://localhost:9765/redirect', (err, response, body) => {
      assert(!err);
      assert(response.statusCode === 200);
      assert(body === 'URL was: /welcome, work count is: 3');

      done();
    });
  });
  describe('handles redirects successfully with different statusCode', () => {
    it('handles 301 statusCode', (done) => {
      return request('http://localhost:9765/redirect-301',
        { followRedirect: false },
        (err, response, body) => {
          assert(!err);
          assert(response.statusCode === 301);

          done();
        }
      );
    });
    it('handles 302 statusCode', (done) => {
      return request('http://localhost:9765/redirect-302',
        { followRedirect: false },
        (err, response, body) => {
          assert(!err);
          assert(response.statusCode === 302);

          done();
        });
    });
    it('redirects to welcome from 301 statusCode', (done) => {
      return request('http://localhost:9765/redirect-301',
        { followRedirect: true },
        (err, response, body) => {
          assert(!err);
          assert(response.statusCode === 200);
          assert(body === 'URL was: /welcome, work count is: 9');

          done();
        });
    });
    it('redirects to welcome from 302 statusCode', (done) => {
      return request('http://localhost:9765/redirect-302',
        { followRedirect: true },
        (err, response, body) => {
          assert(!err);
          assert(response.statusCode === 200);
          assert(body === 'URL was: /welcome, work count is: 10');

          done();
        });
    });

  });
  it('replies to separate URLs with separate responses', (done) => {
    let count = 0;

    for (let i = 0; (i < 5); i++) {
      attempt(i);
    }

    function attempt(i) {
      request('http://localhost:9765/welcome?' + i, (err, response, body) => {
        assert(!err);
        assert(response.statusCode === 200);
        count++;
        if (count === 5) {
          assert(workCount === 8);
          done();
        }
      });
    }
  });
});
