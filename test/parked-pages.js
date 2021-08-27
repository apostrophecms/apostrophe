const t = require('../test-lib/test.js');
const assert = require('assert');

let apos, apos2;

describe('Parked Pages', function() {

  this.timeout(t.timeout);

  after(async function() {
    await t.destroy(apos);
    await t.destroy(apos2);
  });

  it('standard parked pages should be as expected', async function() {
    apos = await t.create({
      root: module,
      modules: {}
    });
    const req = apos.task.getReq();
    const home = await apos.page.find(req, { slug: '/' }).toObject();
    assert(home);
    assert(home.parkedId === 'home');
    assert(home.type === '@apostrophecms/home-page');
    const archive = await apos.page.find(req, { slug: '/archive' }).archived(true).toObject();
    assert(archive);
    assert(archive.parkedId === 'archive');
    assert(archive.type === '@apostrophecms/archive-page');
  });

  it('overridden home page should work without disturbing archive', async function() {
    apos2 = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                slug: '/',
                parkedId: 'home',
                _defaults: {
                  title: 'Home',
                  type: 'default-page'
                }
              }
            ]
          }
        },
        'default-page': {}
      }
    });
    const req = apos2.task.getAnonReq();
    const home = await apos2.page.find(req, { slug: '/' }).toObject();
    assert(home);
    assert(home.parkedId === 'home');
    assert(home.type === 'default-page');
    const archive = await apos2.page.find(req, { slug: '/archive' }).archived(true).toObject();
    assert(archive);
    assert(archive.parkedId === 'archive');
    assert(archive.type === '@apostrophecms/archive-page');
  });
});
