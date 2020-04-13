const t = require('../test-lib/test.js');
const assert = require('assert');
const request = require('request-promise');

let apos;

describe('Login', function() {

  this.timeout(20000);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          options: {
            port: 7901,
            address: 'localhost',
            session: {
              secret: 'Cursus'
            }
          }
        }
      }
    });

    assert(apos.modules['apostrophe-login']);
    assert(apos.users.safe.remove);
    const response = await apos.users.safe.remove({});
    assert(response.result.ok === 1);
  });

  it('should be able to insert test user', async function() {
    assert(apos.users.newInstance);
    const user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Harry';
    user.lastName = 'Putter';
    user.title = 'Harry Putter';
    user.username = 'HarryPutter';
    user.password = 'crookshanks';
    user.email = 'hputter@aol.com';

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    const doc = await apos.users.insert(apos.tasks.getReq(), user);
    assert(doc._id);
  });

  it('should be able to login a user with their username', async function() {

    const jar = request.jar();

    // establish session
    let page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    assert(page.match(/logged out/));

    console.log('login attempt');
    console.log(getCookie(jar, 'test.csrf'));

    await request({
      method: 'POST',
      uri: 'http://localhost:7901/api/v1/apostrophe-login/login',
      json: {
        username: 'HarryPutter',
        password: 'crookshanks'
      },
      headers: {
        'X-XSRF-TOKEN': getCookie(jar, 'test.csrf')
      },
      followAllRedirects: true,
      jar
    });

    page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await request({
      method: 'POST',
      uri: 'http://localhost:7901/api/v1/apostrophe-login/logout',
      json: {
        username: 'hputter@aol.com',
        password: 'crookshanks'
      },
      headers: {
        'X-XSRF-TOKEN': jar.cookie('test.csrf')
      },
      followAllRedirects: true,
      jar
    });

    page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    // are we back to being able to log in?
    assert(page.match(/logged out/));
  });

  it('should be able to login a user with their email', async function() {

    const jar = request.jar();

    // establish session
    let page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    assert(page.match(/logged out/));

    await request({
      method: 'POST',
      uri: 'http://localhost:7901/api/v1/apostrophe-login/login',
      json: {
        username: 'hputter@aol.com',
        password: 'crookshanks'
      },
      headers: {
        'X-XSRF-TOKEN': jar.cookie('test.csrf')
      },
      followAllRedirects: true,
      jar
    });

    page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    // Did we get our page back?
    assert(page.match(/logged in/));

    // otherwise logins are not remembered in a session
    await request({
      method: 'POST',
      uri: 'http://localhost:7901/api/v1/apostrophe-login/logout',
      json: {
        username: 'hputter@aol.com',
        password: 'crookshanks'
      },
      headers: {
        'X-XSRF-TOKEN': jar.cookie('test.csrf')
      },
      followAllRedirects: true,
      jar
    });

    page = await request({
      uri: 'http://localhost:7901/',
      jar,
      followAllRedirects: true
    });

    // are we back to being able to log in?
    assert(page.match(/logged out/));
  });

});

function getCookie(jar, name) {
  console.log(jar.getCookies('http://localhost:7901'));
  return jar.getCookies('http://localhost:7901').find(key => key === name).value;
}
