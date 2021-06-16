const t = require('../test-lib/test.js');
const assert = require('assert');

describe('REST API routing', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;
  let jar;

  it('should initialize apos', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'rest-test': {
          restApiRoutes(self) {
            return {
              getAll(req) {
                return {
                  action: 'getAll'
                };
              },
              getOne(req, _id) {
                return {
                  action: 'getOne',
                  _id
                };
              },
              post(req) {
                return {
                  action: 'post',
                  data: req.body
                };
              },
              delete(req, _id) {
                return {
                  action: 'delete',
                  _id
                };
              },
              patch(req, _id) {
                return {
                  action: 'patch',
                  _id
                };
              },
              put(req, _id) {
                return {
                  action: 'put',
                  _id
                };
              }
            };
          }
        }
      }
    });
  });
  it('should respond properly to getAll', async () => {
    jar = apos.http.jar();
    const body = await apos.http.get('/api/v1/rest-test', {
      // Establish CSRF cookie in jar
      jar
    });
    // We're just testing the routing, we don't actually get back a list of things,
    // we'll test that with pieces
    assert(body.action === 'getAll');
  });
  it('should respond properly to post', async () => {
    const body = await apos.http.post('/api/v1/rest-test', {
      // Use the cookie jar because CSRF tokens are required
      jar
    });
    assert(body.action === 'post');
  });
  it('should respond properly to delete', async () => {
    const body = await apos.http.delete('/api/v1/rest-test/1000', {
      jar
    });
    assert(body.action === 'delete');
    assert(body._id === '1000');
  });
  it('should respond properly to patch', async () => {
    const body = await apos.http.patch('/api/v1/rest-test/1000', {
      jar
    });
    assert(body.action === 'patch');
    assert(body._id === '1000');
  });
  it('should respond properly to put', async () => {
    const body = await apos.http.put('/api/v1/rest-test/1000', {
      jar
    });
    assert(body.action === 'put');
    assert(body._id === '1000');
  });
  it('should respond properly to getOne', async () => {
    const body = await apos.http.get('/api/v1/rest-test/1000', {
      jar
    });
    assert(body.action === 'getOne');
    assert(body._id === '1000');
  });

});
