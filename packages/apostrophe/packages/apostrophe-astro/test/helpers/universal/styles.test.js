import assert from 'node:assert/strict';
import {
  stylesElements,
  stylesAttributes
} from '../../../helpers/universal/styles.js';

describe('stylesElements', () => {
  it('returns null when widget has no styles', () => {
    assert.equal(stylesElements({}), null);
  });

  it('returns null when _options has no aposStylesElements', () => {
    assert.equal(stylesElements({ _options: {} }), null);
  });

  it('returns the HTML string when present', () => {
    const widget = { _options: { aposStylesElements: '<style>.foo{color:red}</style>' } };
    assert.equal(stylesElements(widget), '<style>.foo{color:red}</style>');
  });
});

describe('stylesAttributes', () => {
  it('returns empty object when widget has no styles and no additional attrs', () => {
    const attrs = stylesAttributes({});
    assert.deepEqual(attrs, {});
  });

  it('returns widget styles attributes', () => {
    const widget = { _options: { aposStylesAttributes: { class: 'bg-dark', 'data-theme': 'dark' } } };
    const attrs = stylesAttributes(widget);
    assert.equal(attrs.class, 'bg-dark');
    assert.equal(attrs['data-theme'], 'dark');
  });

  it('merges and deduplicates classes', () => {
    const widget = { _options: { aposStylesAttributes: { class: 'foo bar' } } };
    const attrs = stylesAttributes(widget, { class: 'bar baz' });
    const classes = attrs.class.split(' ');
    assert.ok(classes.includes('foo'));
    assert.ok(classes.includes('bar'));
    assert.ok(classes.includes('baz'));
    assert.equal(classes.filter(c => c === 'bar').length, 1, 'bar should not be duplicated');
  });

  it('merges additional class as array', () => {
    const widget = { _options: { aposStylesAttributes: { class: 'foo' } } };
    const attrs = stylesAttributes(widget, { class: [ 'bar', 'baz' ] });
    const classes = attrs.class.split(' ');
    assert.ok(classes.includes('foo'));
    assert.ok(classes.includes('bar'));
    assert.ok(classes.includes('baz'));
  });

  it('concatenates style strings', () => {
    const widget = { _options: { aposStylesAttributes: { style: 'color:red' } } };
    const attrs = stylesAttributes(widget, { style: 'font-size:16px' });
    assert.match(attrs.style, /color:red/);
    assert.match(attrs.style, /font-size:16px/);
  });

  it('passes through other additional attributes', () => {
    const attrs = stylesAttributes({}, { 'data-id': '123', 'aria-label': 'test' });
    assert.equal(attrs['data-id'], '123');
    assert.equal(attrs['aria-label'], 'test');
  });

  it('omits additional attributes with null or undefined values', () => {
    const attrs = stylesAttributes({}, { 'data-id': null, 'aria-label': undefined });
    assert.ok(!('data-id' in attrs));
    assert.ok(!('aria-label' in attrs));
  });
});
