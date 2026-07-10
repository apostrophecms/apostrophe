import assert from 'node:assert/strict';
import {
  getFocalPoint,
  getWidth,
  getHeight,
  getAttachmentUrl,
  getAttachmentSrcset
} from '../../../helpers/universal/attachment.js';

// Minimal attachment fixture
function makeImage({ x, y, width, height, _urls, extension = 'jpg' } = {}) {
  return {
    attachment: {
      _urls: _urls || { original: `/uploads/test.${extension}`, 'two-thirds': `/uploads/test.two-thirds.${extension}` },
      extension,
      width: width || 800,
      height: height || 600,
      ...(x != null ? { x } : {}),
      ...(y != null ? { y } : {})
    }
  };
}

describe('getFocalPoint', () => {
  it('returns default when attachment is null', () => {
    assert.equal(getFocalPoint(null), 'center center');
  });

  it('returns a custom default value', () => {
    assert.equal(getFocalPoint(null, '50% 50%'), '50% 50%');
  });

  it('returns _fields focal point when present', () => {
    const image = { _fields: { x: 30, y: 70 }, attachment: {} };
    assert.equal(getFocalPoint(image), '30% 70%');
  });

  it('returns attachment-level focal point when no _fields', () => {
    const image = makeImage({ x: 20, y: 80 });
    assert.equal(getFocalPoint(image), '20% 80%');
  });

  it('returns default when x/y are null', () => {
    const image = { _fields: { x: null, y: null }, attachment: {} };
    assert.equal(getFocalPoint(image), 'center center');
  });
});

describe('getWidth', () => {
  it('returns _fields.width when available', () => {
    const image = { _fields: { width: 400, height: 300 }, attachment: { width: 800 } };
    assert.equal(getWidth(image), 400);
  });

  it('falls back to attachment.width', () => {
    assert.equal(getWidth(makeImage({ width: 800 })), 800);
  });

  it('returns undefined for missing image', () => {
    assert.equal(getWidth(null), undefined);
  });
});

describe('getHeight', () => {
  it('returns _fields.height when available', () => {
    const image = { _fields: { width: 400, height: 300 }, attachment: { height: 600 } };
    assert.equal(getHeight(image), 300);
  });

  it('falls back to attachment.height', () => {
    assert.equal(getHeight(makeImage({ height: 600 })), 600);
  });
});

describe('getAttachmentUrl', () => {
  it('returns missing icon when no attachment', () => {
    assert.equal(getAttachmentUrl(null), '/images/missing-icon.svg');
  });

  it('returns custom missing icon when provided', () => {
    assert.equal(
      getAttachmentUrl(null, { missingIcon: '/custom/missing.svg' }),
      '/custom/missing.svg'
    );
  });

  it('returns the two-thirds URL by default', () => {
    const image = makeImage();
    assert.equal(getAttachmentUrl(image), '/uploads/test.two-thirds.jpg');
  });

  it('returns the requested size URL', () => {
    const image = {
      attachment: {
        _urls: {
          original: '/uploads/test.jpg',
          full: '/uploads/test.full.jpg',
          'two-thirds': '/uploads/test.two-thirds.jpg'
        },
        extension: 'jpg'
      }
    };
    assert.equal(getAttachmentUrl(image, { size: 'full' }), '/uploads/test.full.jpg');
  });

  it('builds URL with crop parameters from _fields', () => {
    const image = {
      _fields: { left: 10, top: 20, width: 200, height: 300 },
      attachment: {
        _urls: { original: '/uploads/test.jpg', 'two-thirds': '/uploads/test.two-thirds.jpg' },
        extension: 'jpg'
      }
    };
    const url = getAttachmentUrl(image, { size: 'two-thirds' });
    assert.equal(url, '/uploads/test.10.20.200.300.two-thirds.jpg');
  });
});

describe('getAttachmentSrcset', () => {
  it('returns empty string when no attachment', () => {
    assert.equal(getAttachmentSrcset(null), '');
  });

  it('returns empty string when attachment has only one size (e.g. SVG)', () => {
    const image = { attachment: { _urls: { original: '/uploads/icon.svg' } } };
    assert.equal(getAttachmentSrcset(image), '');
  });

  it('returns a srcset string with width descriptors', () => {
    const image = makeImage();
    const srcset = getAttachmentSrcset(image);
    assert.match(srcset, /\d+w/);
    assert.ok(srcset.includes(','), 'srcset should have multiple entries');
  });
});
