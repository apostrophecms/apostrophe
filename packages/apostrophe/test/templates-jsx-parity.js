// Apostrophe ships `.jsx` twins of its own `.html` templates, used when the
// `jsx` option of @apostrophecms/template is set. Each twin must render
// what its `.html` original renders. This test renders a site of every kind
// of page, logged out and in edit mode, in both modes, and compares the
// results as parsed HTML: whitespace between tags and attribute order may
// differ, nothing else may.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

describe('Templates: JSX twins of core templates', function() {

  let apos;
  let jar;
  const pieceSlugs = [];

  this.timeout(t.timeout * 3);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modulesSubdir: path.join(__dirname, 'jsx-parity/modules'),
      modules: {
        '@apostrophecms/template': {
          options: {
            viewsFolderFallback: path.join(__dirname, 'jsx-parity/views')
          }
        },
        'parity-page': {},
        'parity-jsx-page': {},
        'parity-outer-page': {},
        'parity-piece': {},
        'parity-piece-page': {}
      }
    });
    await t.createAdmin(apos);
    jar = await t.loginAs(apos, 'admin');
    await insertContent();
  });

  async function insertContent() {
    const req = apos.task.getReq();
    const attachment = await apos.attachment.insert(req, {
      name: 'test-image.jpg',
      path: path.join(__dirname, 'public/test-image.jpg')
    });
    const image = await apos.image.insert(req, {
      ...apos.image.newInstance(),
      title: 'Test image',
      alt: 'An "image" & more',
      attachment
    });
    const fileAttachment = await apos.attachment.insert(req, {
      name: 'static-test.txt',
      path: path.join(__dirname, 'public/static-test.txt')
    });
    const file = await apos.file.insert(req, {
      ...apos.file.newInstance(),
      title: 'Test file',
      attachment: fileAttachment
    });
    const widget = (type, props) => ({
      _id: apos.util.generateId(),
      metaType: 'widget',
      type,
      ...props
    });
    const area = (...items) => ({
      _id: apos.util.generateId(),
      metaType: 'area',
      items
    });
    const richText = (content) => widget('@apostrophecms/rich-text', { content });
    const items = () => [
      richText('<p>Hello &amp; <strong>world</strong></p>'),
      widget('@apostrophecms/image', { _image: [ image ] }),
      widget('@apostrophecms/image', {
        _image: [ image ],
        caption: 'A caption & more',
        linkTo: '_url',
        linkHref: 'https://example.com/?a=1&b=2',
        linkHrefTitle: 'Example',
        linkTarget: [ '_blank' ]
      }),
      widget('@apostrophecms/image', { _image: [] }),
      widget('@apostrophecms/video', {
        video: {
          url: 'https://vimeo.com/76979871',
          title: 'A video'
        }
      }),
      widget('@apostrophecms/video', {}),
      widget('@apostrophecms/html', { code: '<b class="raw">Raw</b> markup' }),
      widget('@apostrophecms/file', { _file: [ file ] }),
      widget('@apostrophecms/file', { _file: [] }),
      widget('@apostrophecms/layout', {
        columns: area(
          widget('@apostrophecms/layout-column', {
            colstart: 1,
            colspan: 6,
            rowstart: 1,
            rowspan: 1,
            order: 0,
            content: area(richText('<p>Left</p>'))
          }),
          widget('@apostrophecms/layout-column', {
            colstart: 7,
            colspan: 6,
            rowstart: 1,
            rowspan: 1,
            order: 1,
            showMobile: false,
            content: area(richText('<p>Right</p>'))
          })
        )
      })
    ];
    for (const [ type, slug ] of [
      [ 'parity-page', '/nunjucks' ],
      [ 'parity-jsx-page', '/jsx' ],
      [ 'parity-outer-page', '/outer' ]
    ]) {
      await apos.page.insert(req, '_home', 'lastChild', {
        type,
        slug,
        title: `The ${slug.substring(1)} page & <more>`,
        subtitle: 'A subtitle & more',
        main: area(...items())
      });
    }
    await apos.page.insert(req, '_home', 'lastChild', {
      type: 'parity-piece-page',
      slug: '/pieces',
      title: 'Pieces'
    });
    await apos.page.insert(req, '_home', 'lastChild', {
      type: '@apostrophecms/search',
      slug: '/search',
      title: 'Search'
    });
    for (let i = 0; i < 7; i++) {
      const piece = await apos.modules['parity-piece'].insert(req, {
        ...apos.modules['parity-piece'].newInstance(),
        title: `Piece ${i} <&>`
      });
      pieceSlugs.push(piece.slug);
    }
  }

  // Switch between rendering Apostrophe's templates from `.html` and `.jsx`
  function setJsx(jsx) {
    apos.template.options.jsx = jsx;
    // Nunjucks caches what it loaded, including the stand-in it is given
    // for a JSX outer layout
    for (const loader of Object.values(apos.template.loaders || {})) {
      loader.cache = {};
    }
  }

  function requests() {
    const urls = [
      '/',
      '/nunjucks',
      '/jsx',
      '/outer',
      '/pieces',
      '/pieces?page=2',
      '/pieces?page=4',
      `/pieces/${pieceSlugs[0]}`,
      '/search?q=piece',
      '/search?q=nothing-matches',
      '/login',
      '/missing-page'
    ];
    const list = [];
    for (const url of urls) {
      const join = url.includes('?') ? '&' : '?';
      list.push({ url });
      list.push({ url: `${url}${join}aposMode=draft&aposEdit=1`, jar });
      list.push({ url: `${url}${join}aposRefresh=1`, jar });
    }
    list.push({
      url: '/search?q=piece',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    return list;
  }

  async function crawl() {
    const out = {};
    for (const r of requests()) {
      const response = await apos.http.get(r.url, {
        jar: r.jar,
        headers: r.headers,
        fullResponse: true
      }).catch(e => e);
      const key = `${r.jar ? 'admin' : 'anon'} ${r.url}${r.headers ? ' xhr' : ''}`;
      out[key] = `${response.status}\n${response.body}`;
    }
    const req = apos.task.getReq();
    out.suggest = await apos.search.render(req, 'suggest', {
      docs: [ {
        title: 'One & two',
        _url: '/one?a=1&b=2'
      }, { title: 'No URL' } ]
    });
    out.suggestEmpty = await apos.search.render(req, 'suggest', { docs: [] });
    out.passwordResetEmail = await apos.login.render(req, 'passwordResetEmail', {
      site: 'example.com',
      user: { title: 'Jane & Joe' },
      url: 'https://example.com/reset?a=1&b=2'
    });
    out.templateError = await apos.template.render(req, 'templateError');
    return out;
  }

  let nunjucks;
  let jsx;

  it('renders the same pages from the .html and .jsx templates', async function() {
    setJsx(false);
    nunjucks = await crawl();
    setJsx(true);
    jsx = await crawl();
    setJsx(false);
    const differences = [];
    for (const key of Object.keys(nunjucks)) {
      const a = canonical(nunjucks[key]);
      const b = canonical(jsx[key]);
      if (a.join('\n') !== b.join('\n')) {
        let i = 0;
        while (a[i] === b[i]) {
          i++;
        }
        differences.push(`${key}, line ${i}:\n  html: ${a[i]}\n  jsx:  ${b[i]}`);
      }
    }
    assert.deepEqual(differences, []);
  });

  it('really rendered the .jsx templates, and what each one renders', function() {
    // The byte-for-byte output differs, since JSX writes no whitespace
    // between tags
    assert.notEqual(jsx['anon /nunjucks'], nunjucks['anon /nunjucks']);
    const page = jsx['admin /nunjucks?aposMode=draft&aposEdit=1'];
    for (const expected of [
      /^200/,
      /<title>The nunjucks page &amp; &lt;more&gt; - Parity<\/title>/,
      /<html lang="en" dir="ltr" data-parity="1">/,
      /<meta name="parity" content="yes"/,
      /<meta name="injected" content="yes"/,
      /<div class="injected-node">Injected &amp; escaped<\/div>/,
      /<figure/,
      // As in the Nunjucks version, a className option of false shows
      /<figcaption class="false__caption">/,
      /rel="noopener noreferrer"/,
      /data-apos-video-widget/,
      /<b class="raw">Raw<\/b> markup/,
      /download/,
      /data-apos-area-newly-editable/,
      /data-apos-wysiwyg-field-newly-editable/,
      /--colstart: 7/,
      /data-visible-mobile="false"/
    ]) {
      assert.match(page, expected);
    }
    assert.match(jsx['anon /outer'], /<title>The outer page &amp; &lt;more&gt; \(no layout\)<\/title>/);
    assert.match(jsx['anon /pieces?page=2'], /is-active/);
    assert.match(jsx['anon /login'], /<div id="apos-login">/);
    assert.match(jsx['anon /missing-page'], /^404[\s\S]*apos-not-found/);
  });

  it('keeps the list of outer layout blocks in step with outerLayoutBase', function() {
    const views = path.join(__dirname, '../modules/@apostrophecms/template/views');
    const html = fs.readFileSync(path.join(views, 'outerLayoutBase.html'), 'utf8');
    const jsxSource = fs.readFileSync(path.join(views, 'outerLayoutBase.jsx'), 'utf8');
    const blocks = [ ...html.matchAll(/{%-?\s*block\s+(\w+)/g) ].map(m => m[1]);
    assert.deepEqual(
      [ ...apos.template.getOuterLayoutBlockNames() ].sort(),
      [ ...new Set(blocks) ].sort()
    );
    for (const block of blocks) {
      assert.match(jsxSource, new RegExp(`block\\(${block},`), `outerLayoutBase.jsx handles ${block}`);
    }
  });

  it('refuses to render Nunjucks when the nunjucks option is false', async function() {
    apos.template.options.nunjucks = false;
    try {
      const outer = await apos.http.get('/outer', { fullResponse: true });
      assert.equal(outer.status, 200);
      assert.match(outer.body, /The outer page &amp; &lt;more&gt;/);
      const req = apos.task.getReq();
      await assert.rejects(
        () => apos.modules['parity-page'].render(req, 'page', { page: {} }),
        /tried to render the Nunjucks template "page".*nunjucks: false/
      );
      assert.equal(apos.template.safe('<b>').constructor.name, 'JsxSafeString');
    } finally {
      apos.template.options.nunjucks = undefined;
    }
  });
});

// The page as parsed HTML, one line per node: ID-like tokens numbered in
// order of appearance, whitespace collapsed, whitespace-only text, comments
// and attribute order ignored, class names sorted, style declarations
// normalized.
function canonical(text) {
  const ids = new Map();
  text = String(text).replace(/\b[a-z0-9]{24,25}\b/g, (id) => {
    if (!ids.has(id)) {
      ids.set(id, `ID${ids.size}`);
    }
    return ids.get(id);
  });
  const ws = (s) => s.replace(/\s+/g, ' ').trim();
  const value = (name, v) => {
    if (name === 'class') {
      return v.split(/\s+/).filter(Boolean).sort().join(' ');
    }
    if (name === 'style') {
      return v.split(';').map(ws).filter(Boolean).join('; ');
    }
    return ws(v);
  };
  const $ = cheerio.load(text, null, text.includes('<html'));
  const lines = [];
  (function walk(node, depth) {
    if (node.type === 'text') {
      const s = ws(node.data);
      if (s) {
        lines.push(' '.repeat(depth) + JSON.stringify(s));
      }
      return;
    }
    if ([ 'tag', 'script', 'style' ].includes(node.type)) {
      const attrs = Object.entries(node.attribs || {})
        .map(([ k, v ]) => `${k}=${JSON.stringify(value(k, v))}`)
        .sort();
      lines.push(`${' '.repeat(depth)}<${node.name} ${attrs.join(' ')}>`);
    }
    for (const child of node.children || []) {
      walk(child, depth + 1);
    }
  })($.root()[0], 0);
  return lines;
}
