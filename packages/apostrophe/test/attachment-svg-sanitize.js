const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');

describe('Attachment SVG sanitization', function() {
  this.timeout(t.timeout);

  let apos;
  let out;

  before(async function() {
    apos = await t.create({
      root: module
    });
    const file = path.join(os.tmpdir(), `apos-svg-sanitize-${process.pid}-${Date.now()}.svg`);
    fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
  <defs><path id="shape" d="M0 0 L10 10 Z"/></defs>
  <use id="local-use" xlink:href="#shape"/>
  <image id="embedded-xlink" width="10" height="10" xlink:href="${png}"/>
  <image id="embedded-href" width="10" height="10" href="${png}"/>
  <image id="embedded-svg" width="10" height="10" xlink:href="${svgDataUri}"/>
  <image id="external" width="10" height="10" xlink:href="https://example.com/tracker.png"/>
  <a id="script-link" xlink:href="javascript:alert(1)"><rect width="5" height="5"/></a>
  <use id="remote-use" xlink:href="https://example.com/sprite.svg#icon"/>
  <script>alert(1)</script>
</svg>`);
    await apos.attachment.sanitizeSvg(file);
    out = fs.readFileSync(file, 'utf8');
    fs.unlinkSync(file);
  });

  after(function() {
    return t.destroy(apos);
  });

  it('keeps local references', function() {
    assert(out.includes('id="local-use"'));
  });

  it('keeps embedded raster images referenced with xlink:href', function() {
    assert(out.includes('id="embedded-xlink"'));
    assert(out.includes(png));
  });

  it('keeps embedded raster images referenced with href', function() {
    assert(out.includes('id="embedded-href"'));
  });

  it('removes embedded SVG documents, external references and scripts', function() {
    assert(!out.includes('id="embedded-svg"'));
    assert(!out.includes('image/svg+xml'));
    assert(!out.includes('id="external"'));
    assert(!out.includes('example.com'));
    assert(!out.includes('javascript:'));
    assert(!out.includes('<script'));
  });
});
