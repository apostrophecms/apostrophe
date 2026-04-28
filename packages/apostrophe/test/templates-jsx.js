const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Templates: JSX', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'express-test': {},
        'template-jsx-test': {
          options: {
            ignoreNoCodeWarning: true
          }
        },
        'template-jsx-subclass-test': {
          options: {
            ignoreNoCodeWarning: true
          }
        },
        'template-jsx-options-test': {},
        'jsx-component-test': {},
        'jsx-bridge-test': {
          options: {
            ignoreNoCodeWarning: true
          }
        },
        'jsx-mixed-test': {}
      }
    });
  });

  // ---- Equivalents of the existing Nunjucks template tests ----

  it('should render a JSX template relative to a module', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'test', { age: 50 });
    assert.equal(result.trim(), '<h1>50</h1>');
  });

  it('should respect templateData at module level for JSX templates', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'test');
    assert.equal(result.trim(), '<h1>30</h1>');
  });

  it('should respect JSX template overrides in subclasses', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-subclass-test'].render(req, 'override-test');
    assert.equal(result.trim(), '<h1>I am overridden</h1>');
  });

  it('should inherit JSX templates in the absence of overrides', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-subclass-test'].render(req, 'inherit-test');
    assert.equal(result.trim(), '<h1>I am inherited</h1>');
  });

  it('should expose module options and helpers to JSX via the helpers second argument', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-options-test'].render(req, 'options-test');
    assert.match(result, /nifty/);
    assert.match(result, /\b4\b/);
  });

  // ---- Auto-escape and dangerouslySetInnerHTML ----

  it('should auto-escape strings in element bodies', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'escape-body', {
      html: '<script>alert("xss")</script>'
    });
    assert.match(result, /&lt;script&gt;alert\("xss"\)&lt;\/script&gt;/);
    assert.doesNotMatch(result, /<script>/);
  });

  it('should auto-escape attribute values, including quotes', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'escape-attr', {
      url: 'javascript:alert("hi")',
      title: 'evil "quotes" & <tags>'
    });
    assert.match(result, /href="javascript:alert\(&quot;hi&quot;\)"/);
    assert.match(result, /title="evil &quot;quotes&quot; &amp; &lt;tags&gt;"/);
  });

  it('should emit raw HTML via dangerouslySetInnerHTML without escaping', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'dangerously-set', {
      html: '<strong>raw</strong> & <em>html</em>'
    });
    assert.match(result, /<strong>raw<\/strong> & <em>html<\/em>/);
  });

  it('should rewrite className to class and htmlFor to for', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'class-and-for');
    assert.match(result, /class="form-label"/);
    assert.match(result, /for="username"/);
    assert.doesNotMatch(result, /className=/);
    assert.doesNotMatch(result, /htmlFor=/);
  });

  it('should rewrite camelCase SVG presentation attrs to kebab-case', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'svg-attrs');
    // Kebab-case conversions
    assert.match(result, /stroke-width="2"/);
    assert.match(result, /stroke-linecap="round"/);
    assert.match(result, /stroke-linejoin="round"/);
    assert.match(result, /stroke-dasharray="4 2"/);
    assert.match(result, /stroke-opacity="0.5"/);
    assert.match(result, /fill-rule="evenodd"/);
    assert.match(result, /clip-rule="evenodd"/);
    assert.match(result, /pointer-events="none"/);
    assert.match(result, /text-anchor="middle"/);
    // Native camelCase preserved
    assert.match(result, /viewBox="0 0 24 24"/);
    assert.match(result, /preserveAspectRatio="xMidYMid meet"/);
    // No camelCase forms leaked through
    assert.doesNotMatch(result, /strokeWidth=/);
    assert.doesNotMatch(result, /fillRule=/);
  });

  it('should self-close void elements', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'void-elements');
    assert.match(result, /<hr \/>/);
    assert.match(result, /<input type="text" name="email" \/>/);
    assert.match(result, /<br \/>/);
  });

  it('should handle boolean attributes and skip null/undefined/false attribute values', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'boolean-attrs');
    assert.match(result, /<input/);
    assert.match(result, / checked/);
    assert.doesNotMatch(result, /checked="true"/);
    assert.doesNotMatch(result, /disabled/);
    assert.doesNotMatch(result, /data-extra/);
    assert.doesNotMatch(result, /data-undefined/);
  });

  it('should render arrays of nodes (e.g. lists from .map())', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-jsx-test'].render(req, 'list', {
      items: [ 'a', 'b', 'c' ]
    });
    assert.match(result, /<ul>/);
    assert.match(result, /<li>a<\/li>/);
    assert.match(result, /<li>b<\/li>/);
    assert.match(result, /<li>c<\/li>/);
  });

  // ---- Async <Component> ----

  it('should await async components inline within JSX', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-component-test'].render(req, 'uses-component', {
      name: 'World'
    });
    assert.match(result, /<section>/);
    assert.match(result, /<h1>Welcome<\/h1>/);
    assert.match(
      result,
      /<span class="greet">Hello World \(after delay\)<\/span>/
    );
  });

  // ---- JSX → Nunjucks bridge via Extend ----

  it('should let JSX extend a Nunjucks layout, mapping props to {% block %} overrides', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-bridge-test'].render(req, 'njk-extends', {
      message: 'hello & <world>',
      pageSlug: '/test'
    });
    assert.match(result, /<title>A JSX page<\/title>/);
    assert.match(result, /<body data-page="\/test">/);
    assert.match(result, /<main>/);
    assert.match(result, /<h1>I am from JSX<\/h1>/);
    // Auto-escape applies to ordinary string children inside JSX, even when
    // the surrounding output ends up in a Nunjucks block override.
    assert.match(result, /<p>hello &amp; &lt;world&gt;<\/p>/);
    assert.doesNotMatch(result, /default body/);
    assert.doesNotMatch(result, /default title/);
  });

  // ---- JSX → JSX layout via Template + children ----

  it('should let JSX extend a JSX layout, passing children through', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-bridge-test'].render(req, 'jsx-extends', {
      message: 'inside the jsx layout'
    });
    assert.match(result, /<title>JSX-in-JSX<\/title>/);
    assert.match(result, /<header>shared header<\/header>/);
    assert.match(result, /<main>/);
    assert.match(result, /<p>inside the jsx layout<\/p>/);
    assert.match(result, /<footer>shared footer<\/footer>/);
  });

  // ---- import / require inside .jsx ----

  it('should support `import` inside .jsx files', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-mixed-test'].render(req, 'uses-import', {
      value: 'imported'
    });
    assert.match(result, /<span>\[imported\]<\/span>/);
  });

  it('should support `require` inside .jsx files', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-mixed-test'].render(req, 'uses-require', {
      value: 'required'
    });
    assert.match(result, /<span>\[required\]<\/span>/);
  });

  // ---- Async JSX with promise-returning helpers in arrays ----

  it('should await promises returned from inside arrays', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-mixed-test'].render(req, 'async-list', {
      items: [ 'one', 'two', 'three' ]
    });
    assert.match(result, /<ul><li>one<\/li><li>two<\/li><li>three<\/li><\/ul>/);
  });

  // ---- Nunjucks SafeString interop ----

  it('should not double-escape Nunjucks SafeString values returned by helpers', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-mixed-test'].render(req, 'safe-helper');
    // Helper escapes its input itself, returns SafeString. JSX must not
    // re-escape the resulting <b> tag, but the inner text was escaped by
    // the helper.
    assert.match(result, /<div><b>hello &amp; &lt;world&gt;<\/b><\/div>/);
  });

  // ---- Localization helper ----

  it('should expose __t as the localization helper', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['jsx-mixed-test'].render(req, 'localized');
    assert.match(result, /<p>404 - Page not found<\/p>/);
  });

  // ---- Resolution: prefer .jsx when it exists alongside .html ----

  it('resolveTemplate should prefer .jsx over .html in the same directory', function() {
    const module = apos.modules['template-jsx-test'];
    const resolved = apos.template.resolveTemplate(module, 'test');
    assert.equal(resolved.kind, 'jsx');
    assert.equal(resolved.ext, 'jsx');
  });

  it('resolveTemplate should still find .html templates when no .jsx exists', function() {
    // template-test only has .html, not .jsx
    const module = apos.modules['@apostrophecms/template'];
    const resolved = apos.template.resolveTemplate(module, 'outerLayout');
    assert.equal(resolved.kind, 'nunjucks');
    assert.equal(resolved.ext, 'html');
  });

  // ---- Error handling ----

  it('should annotate runtime errors thrown by JSX templates with the file path', async function() {
    const req = apos.task.getAnonReq();
    let caught;
    try {
      await apos.modules['jsx-mixed-test'].render(req, 'throws');
    } catch (e) {
      caught = e;
    }
    assert(caught, 'expected the render to throw');
    assert.match(caught.message, /\[JSX template .*throws\.jsx\]/);
    assert.equal(caught.aposJsxFile.endsWith('throws.jsx'), true);
  });

  it('should report JSX compile errors with the file path and a clear code', async function() {
    const req = apos.task.getAnonReq();
    let caught;
    try {
      await apos.modules['jsx-mixed-test'].render(req, 'syntax-error');
    } catch (e) {
      caught = e;
    }
    assert(caught, 'expected the render to throw');
    assert.match(caught.message, /syntax-error\.jsx/);
  });

});
