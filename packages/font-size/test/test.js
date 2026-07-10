const assert = require('assert');
const t = require('apostrophe/test-lib/test.js');

describe('@apostrophecms/font-size', function () {
  let apos;

  this.timeout(t.timeout);

  after(async function () {
    await t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: {
        '@apostrophecms/font-size': {}
      }
    });
  });

  it('improves the rich text widget and registers the size tool', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    assert(manager);
    assert(manager.options.editorTools.size);
    assert.equal(manager.options.editorTools.size.component, 'AposTiptapFontSize');
    assert.equal(manager.options.editorTools.size.command, 'setFontSize');
    assert.equal(manager.options.editorTools.size.label, 'aposFontSize:fontSize');
  });

  it('adds the size tool to the rich text default toolbar', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    assert(manager.options.defaultOptions.toolbar.includes('size'));
  });

  it('exposes the fontSizes presets to the browser', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    const req = apos.task.getReq();
    const data = manager.getBrowserData(req);
    assert(Array.isArray(data.fontSizes));
    assert(data.fontSizes.includes(16));
    // the size tool is in the browser tools registry
    assert(data.tools.size);
    assert.equal(data.tools.size.component, 'AposTiptapFontSize');
  });

  it('registers the aposFontSize i18n namespace as a browser namespace', function () {
    const req = apos.task.getReq();
    assert.equal(req.t('aposFontSize:fontSize'), 'Font Size');
    assert.equal(req.t('aposFontSize:removeFontSize'), 'Remove Size');
    assert(apos.i18n.namespaces.aposFontSize);
    assert.equal(apos.i18n.namespaces.aposFontSize.browser, true);
  });

  it('ships translations for all supported locales', function () {
    const locales = [ 'en', 'de', 'fr', 'es', 'it', 'pt-BR', 'sk' ];
    for (const locale of locales) {
      const bundle = apos.i18n.i18next.getResourceBundle(locale, 'aposFontSize');
      assert(bundle, `expected an aposFontSize bundle for "${locale}"`);
      assert(bundle.fontSize, `expected a fontSize phrase for "${locale}"`);
      assert(bundle.removeFontSize, `expected a removeFontSize phrase for "${locale}"`);
    }
    // Spot-check that a non-English phrase actually loaded.
    assert.equal(
      apos.i18n.i18next.getResourceBundle('fr', 'aposFontSize').fontSize,
      'Taille de police'
    );
  });

  it('permits span font-size styling for valid pixel sizes when the size tool is enabled', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    const options = {
      toolbar: [ 'size' ],
      insert: []
    };

    // Allowlist building blocks: span tag, style attribute, font-size style.
    assert(manager.toolbarToAllowedTags(options).includes('span'));
    const attributes = manager.toolbarToAllowedAttributes(options);
    assert(attributes['*'] && attributes['*'].includes('style'));
    const styles = manager.toolbarToAllowedStyles(options);
    assert(styles['*'] && Array.isArray(styles['*']['font-size']));

    const config = manager.optionsToSanitizeHtml(options);
    const clean = html => manager.sanitizeHtml(html, config);

    for (const value of [ '16px', '24px', '1.5px', '0.5px', '100px' ]) {
      const out = clean(`<p><span style="font-size: ${value}">x</span></p>`);
      assert(out.includes('font-size'), `expected font-size kept for "${value}": ${out}`);
      assert(out.includes(value), `expected "${value}" kept: ${out}`);
    }
  });

  it('strips non-pixel, invalid or malicious font-size values', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    const config = manager.optionsToSanitizeHtml({
      toolbar: [ 'size' ],
      insert: []
    });
    const clean = html => manager.sanitizeHtml(html, config);

    const invalid = [
      'red', '100', '16em', '2rem', '120%', '14pt', 'large',
      '12foo', '-5px', 'expression(alert(1))', 'url(x)', '1e3px'
    ];
    for (const value of invalid) {
      const out = clean(`<p><span style="font-size: ${value}">x</span></p>`);
      assert(!out.includes('font-size'), `expected font-size stripped for "${value}": ${out}`);
    }
  });

  it('does not allow font-size where the size tool is not enabled', function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];

    // With color enabled but size disabled, the span and its color survive but
    // the font-size declaration is removed.
    const config = manager.optionsToSanitizeHtml({
      toolbar: [ 'color' ],
      insert: []
    });
    const out = manager.sanitizeHtml(
      '<p><span style="font-size: 16px; color: #ff0000">x</span></p>',
      config
    );
    assert(!out.includes('font-size'), out);
    assert(!out.includes('16px'), out);
    assert(out.includes('#ff0000'), out);
  });

  it('keeps valid font sizes end-to-end through sanitize()', async function () {
    const manager = apos.modules['@apostrophecms/rich-text-widget'];
    const req = apos.task.getReq();

    const output = await manager.sanitize(req, {
      type: '@apostrophecms/rich-text',
      content: '<p><span style="font-size: 24px">Big</span></p>'
    }, {
      toolbar: [ 'size' ],
      insert: []
    });

    assert(output.content.includes('font-size'), output.content);
    assert(output.content.includes('24px'), output.content);
  });

  it('respects addFontSizeToDefaultToolbar: false set on the rich text widget', async function () {
    let apos2;
    try {
      apos2 = await t.create({
        root: module,
        testModule: true,
        shortName: 'test-font-size-no-toolbar',
        modules: {
          '@apostrophecms/font-size': {},
          // Options are configured on the rich text widget itself, since the
          // improvement has no separate existence.
          '@apostrophecms/rich-text-widget': {
            options: {
              addFontSizeToDefaultToolbar: false
            }
          }
        }
      });
      const manager = apos2.modules['@apostrophecms/rich-text-widget'];
      // The tool is still registered and available...
      assert(manager.options.editorTools.size);
      // ...but it is not forced into the default toolbar.
      assert(!manager.options.defaultOptions.toolbar.includes('size'));
    } finally {
      await t.destroy(apos2);
    }
  });

  it('reads fontSizes configured on the rich text widget', async function () {
    let apos2;
    try {
      apos2 = await t.create({
        root: module,
        testModule: true,
        shortName: 'test-font-size-presets',
        modules: {
          '@apostrophecms/font-size': {},
          '@apostrophecms/rich-text-widget': {
            options: {
              fontSizes: [ 10, 20, 30 ]
            }
          }
        }
      });
      const manager = apos2.modules['@apostrophecms/rich-text-widget'];
      const data = manager.getBrowserData(apos2.task.getReq());
      assert.deepEqual(data.fontSizes, [ 10, 20, 30 ]);
    } finally {
      await t.destroy(apos2);
    }
  });
});
