const cheerio = require('cheerio');
const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

const locales = {
  en: {
    label: 'English'
  },
  he: {
    label: 'Hebrew',
    prefix: '/he',
    direction: 'rtl'
  }
};

async function create(loginOptions = {}) {
  return t.create({
    root: module,
    modules: {
      '@apostrophecms/i18n': {
        options: {
          locales
        }
      },
      '@apostrophecms/login': {
        options: {
          passwordReset: true,
          ...loginOptions
        }
      },
      // Renders a page that extends the outer layout, see test/modules
      'i18n-test-page': {
        options: {
          ignoreNoExtendWarning: true
        }
      }
    }
  });
}

// Renders a regular page, as any module rendering with `sendPage` does
async function getPageAttrs(apos, req) {
  const $ = cheerio.load(await apos.modules['i18n-test-page'].renderPage(req, 'page'));
  const $html = $('html');
  return {
    lang: $html.attr('lang'),
    dir: $html.attr('dir')
  };
}

async function getHtmlAttrs(apos, url) {
  const $ = cheerio.load(await apos.http.get(url));
  const $html = $('html');
  return {
    lang: $html.attr('lang'),
    dir: $html.attr('dir')
  };
}

describe('Login direction', function () {
  this.timeout(t.timeout);

  describe('default (follow the locale)', function () {
    let apos;

    before(async function () {
      apos = await create();
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render the login page in the locale direction', async function () {
      assert.deepEqual(await getHtmlAttrs(apos, '/login'), {
        lang: 'en',
        dir: 'ltr'
      });
      assert.deepEqual(await getHtmlAttrs(apos, '/he/login'), {
        lang: 'he',
        dir: 'rtl'
      });
    });

    it('should expose the locale direction to the browser', async function () {
      assert.equal(apos.login.getBrowserData(apos.task.getReq()).direction, 'ltr');
      assert.equal(
        apos.login.getBrowserData(apos.task.getReq({ locale: 'he' })).direction,
        'rtl'
      );
    });

    it('should not force a direction on the login fields', function () {
      const schema = apos.login.getSchema();
      assert.equal(schema.length, 2);
      for (const field of schema) {
        assert.equal(field.direction, undefined);
      }
    });
  });

  describe('direction: ltr on an RTL locale', function () {
    let apos;

    before(async function () {
      apos = await create({ direction: 'ltr' });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render the login page LTR and keep the locale lang', async function () {
      assert.deepEqual(await getHtmlAttrs(apos, '/login'), {
        lang: 'en',
        dir: 'ltr'
      });
      assert.deepEqual(await getHtmlAttrs(apos, '/he/login'), {
        lang: 'he',
        dir: 'ltr'
      });
    });

    it('should expose the forced direction to the browser', async function () {
      assert.equal(apos.login.getBrowserData(apos.task.getReq()).direction, 'ltr');
      assert.equal(
        apos.login.getBrowserData(apos.task.getReq({ locale: 'he' })).direction,
        'ltr'
      );
    });

    it('should force the direction of the login fields', function () {
      const schema = apos.login.getSchema();
      assert.equal(schema.length, 2);
      for (const field of schema) {
        assert.equal(field.direction, 'ltr');
      }
    });

    it('should not change the direction of regular pages', async function () {
      assert.deepEqual(await getPageAttrs(apos, apos.task.getReq()), {
        lang: 'en',
        dir: 'ltr'
      });
      assert.deepEqual(await getPageAttrs(apos, apos.task.getReq({ locale: 'he' })), {
        lang: 'he',
        dir: 'rtl'
      });
    });

    it('should apply to any page flagged as a login page', async function () {
      const req = apos.task.getReq({ locale: 'he' });
      req.aposLoginPage = true;
      assert.deepEqual(await getPageAttrs(apos, req), {
        lang: 'he',
        dir: 'ltr'
      });
    });
  });

  describe('direction: rtl on an LTR locale', function () {
    let apos;

    before(async function () {
      apos = await create({ direction: 'rtl' });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render the login page RTL', async function () {
      assert.deepEqual(await getHtmlAttrs(apos, '/login'), {
        lang: 'en',
        dir: 'rtl'
      });
      assert.deepEqual(await getPageAttrs(apos, apos.task.getReq()), {
        lang: 'en',
        dir: 'ltr'
      });
    });
  });

  describe('invalid direction', function () {
    it('should refuse to start', async function () {
      // The i18n module initializes before the login module, so the
      // partially booted instance can be captured and destroyed
      let captured;
      try {
        await assert.rejects(
          t.create({
            root: module,
            exit: 'throw',
            modules: {
              '@apostrophecms/i18n': {
                init(self) {
                  captured = self.apos;
                }
              },
              '@apostrophecms/login': {
                options: {
                  direction: 'up'
                }
              }
            }
          }),
          (e) => {
            assert(e.message.includes(
              'The "direction" option of "@apostrophecms/login" module must be "ltr", "rtl" or "null".'
            ));
            return true;
          }
        );
      } finally {
        await t.destroy(captured);
      }
    });
  });
});
