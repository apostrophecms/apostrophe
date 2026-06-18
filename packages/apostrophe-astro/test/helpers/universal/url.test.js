import assert from 'node:assert/strict';
import {
  getFilterBaseUrl,
  buildPageUrl,
  aposSetQueryParameter
} from '../../../helpers/universal/url.js';

describe('getFilterBaseUrl', () => {
  it('returns page._url when no filters are active', () => {
    const aposData = { page: { _url: '/articles' }, filters: [] };
    assert.equal(getFilterBaseUrl(aposData), '/articles');
  });

  it('returns page._url when filters have no active choice', () => {
    const aposData = {
      page: { _url: '/articles' },
      filters: [ { choices: [ { active: false, _url: '/articles/foo' } ] } ]
    };
    assert.equal(getFilterBaseUrl(aposData), '/articles');
  });

  it('returns the active filter choice _url', () => {
    const aposData = {
      page: { _url: '/articles' },
      filters: [
        {
          choices: [
            { active: false, _url: '/articles/news' },
            { active: true, _url: '/articles/insights' }
          ]
        }
      ]
    };
    assert.equal(getFilterBaseUrl(aposData), '/articles/insights');
  });

  it('falls back to / when page has no _url', () => {
    assert.equal(getFilterBaseUrl({ page: {} }), '/');
  });
});

describe('buildPageUrl', () => {
  const aposData = { page: { _url: '/articles' } };

  it('returns base URL for page 1', () => {
    assert.equal(buildPageUrl(aposData, 1), '/articles');
  });

  it('appends query parameter in dynamic mode', () => {
    assert.equal(buildPageUrl(aposData, 2), '/articles?page=2');
  });

  it('appends path segment in static mode', () => {
    const data = { ...aposData, staticUrls: true };
    assert.equal(buildPageUrl(data, 2), '/articles/page/2');
  });

  it('preserves existing query params in dynamic mode', () => {
    const data = { page: { _url: '/articles?categories=insights' } };
    const result = buildPageUrl(data, 3);
    assert.match(result, /page=3/);
    assert.match(result, /categories=insights/);
  });
});

describe('aposSetQueryParameter', () => {
  const base = new URL('http://localhost/articles');

  it('sets a new parameter', () => {
    const result = aposSetQueryParameter(base, 'page', '2');
    assert.equal(result.searchParams.get('page'), '2');
  });

  it('updates an existing parameter', () => {
    const url = new URL('http://localhost/articles?page=1');
    const result = aposSetQueryParameter(url, 'page', '3');
    assert.equal(result.searchParams.get('page'), '3');
  });

  it('removes the parameter when value is null', () => {
    const url = new URL('http://localhost/articles?page=2');
    const result = aposSetQueryParameter(url, 'page', null);
    assert.equal(result.searchParams.get('page'), null);
  });

  it('removes the parameter when value is empty string', () => {
    const url = new URL('http://localhost/articles?page=2');
    const result = aposSetQueryParameter(url, 'page', '');
    assert.equal(result.searchParams.get('page'), null);
  });

  it('always strips internal Apostrophe parameters', () => {
    const url = new URL('http://localhost/articles?aposRefresh=1&aposMode=edit&aposEdit=1');
    const result = aposSetQueryParameter(url, 'page', '2');
    assert.equal(result.searchParams.get('aposRefresh'), null);
    assert.equal(result.searchParams.get('aposMode'), null);
    assert.equal(result.searchParams.get('aposEdit'), null);
  });
});
