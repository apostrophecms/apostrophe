const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const path = require('path');

// A project may write its outer layout in JSX. Nunjucks templates still
// `{% extends data.outerLayout %}`; their blocks must reach the JSX layout
// as props.

describe('Templates: JSX outer layout', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modulesSubdir: path.join(__dirname, 'jsx-outer-layout/modules'),
      modules: {
        'jsx-layout-test': {}
      }
    });
  });

  function renderPage(template, data = {}, query = {}) {
    const req = apos.task.getAnonReq();
    req.query = query;
    return apos.template.renderPageForModule(
      req, template, data, apos.modules['jsx-layout-test']
    );
  }

  it('renders a Nunjucks page through the project JSX outer layout', async function() {
    const html = await renderPage('njk-page', { message: 'hello <there>' });
    assert.match(html, /<meta name="jsx-outer-layout" content="yes"/);
    assert.match(html, /<title>Nunjucks & friends<\/title>/);
    assert.match(html, /<body class="[^"]*njk-body/);
    assert.match(
      html,
      /<div class="jsx-outer-main"><p class="njk-main">hello &lt;there&gt;<\/p><\/div>/
    );
    assert.match(html, /<\/html>/);
    assert.doesNotMatch(html, /apos-jsx-/);
  });

  it('leaves blocks a Nunjucks page does not override to the layout', async function() {
    const html = await renderPage('njk-page', { message: 'x' });
    // `mainAnchor` is not overridden, so outerLayoutBase's default remains.
    assert.match(html, /<a name="main"><\/a>/);
  });

  it('renders a JSX page through the same JSX outer layout', async function() {
    const html = await renderPage('jsx-page', { message: 'from jsx' });
    assert.match(html, /<meta name="jsx-outer-layout" content="yes"/);
    assert.match(html, /<title>JSX page<\/title>/);
    assert.match(html, /<div class="jsx-outer-main"><p class="jsx-main">from jsx<\/p><\/div>/);
  });

  it('supports a Nunjucks layout between the page and the JSX outer layout', async function() {
    const html = await renderPage('njk-layout-child');
    assert.match(html, /<title>From the Nunjucks layout<\/title>/);
    assert.match(
      html,
      /<div class="jsx-outer-main"><section class="njk-layout"><p>nested<\/p><\/section><\/div>/
    );
    assert.doesNotMatch(html, /apos-jsx-/);
  });

  it('supports a JSX page extending a Nunjucks layout that extends the JSX outer layout', async function() {
    const html = await renderPage('jsx-over-njk-layout');
    assert.match(html, /<meta name="jsx-outer-layout" content="yes"/);
    assert.match(
      html,
      /<div class="jsx-outer-main"><section class="njk-layout"><p>from jsx<\/p><\/section><\/div>/
    );
    assert.doesNotMatch(html, /apos-jsx-/);
  });

  it('drops super() output rather than leaking capture markers', async function() {
    const html = await renderPage('njk-super');
    assert.match(html, /<div class="jsx-outer-main">beforeafter<\/div>/);
    assert.doesNotMatch(html, /apos-jsx-/);
  });

  it('passes super() through a JSX layout to the Nunjucks block default', async function() {
    const html = await renderPage('njk-super-title', {
      page: {
        title: 'Page & title'
      }
    });
    // The project outerLayout.jsx forwards `title` to outerLayoutBase.html,
    // whose default is the page title.
    assert.match(html, /<title>\[Page &amp; title\] and more<\/title>/);
    assert.doesNotMatch(html, /apos-jsx-/);
  });

  it('uses the project JSX refreshLayout for refresh requests', async function() {
    const html = await renderPage('njk-page', { message: 'refreshed' }, { aposRefresh: '1' });
    assert.match(html, /<div class="jsx-refresh-layout"><p class="njk-main">refreshed<\/p><\/div>/);
    assert.doesNotMatch(html, /<html/);
  });

  it('renders core Nunjucks pages, such as the login page, through the JSX outer layout', async function() {
    const html = await apos.http.get('/login');
    assert.match(html, /<meta name="jsx-outer-layout" content="yes"/);
    assert.match(html, /<div class="jsx-outer-main">\s*<div id="apos-login"><\/div>/);
    assert.match(html, /<body class="[^"]*apos-login-page/);
  });
});
