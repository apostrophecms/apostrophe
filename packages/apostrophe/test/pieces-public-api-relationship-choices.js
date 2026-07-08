const t = require('../test-lib/test.js');
const assert = require('assert');

// A blocked filter contributes no entry (or an empty array) to the
// choices/counts bag the REST API returns.
function assertNoLeak(bag, key, message) {
  assert(!bag || !bag[key] || bag[key].length === 0, message);
}

// Regression tests for GHSA-xmpp-f9v3-r7qh — the incomplete fix for
// CVE-2026-39857. The projection guard that stops `?choices=` / `?counts=`
// from leaking distinct values of fields excluded from `publicApiProjection`
// resolved the schema field by an EXACT-NAME match. Relationship fields
// register additional query builders whose names differ from the schema field
// name — the "slug" alias builders (`author` / `authorAnd` for a relationship
// field named `_author`) and the `_authorAnd` operation builder. Because none
// of those names match `_author` exactly, the guard failed open and an
// unauthenticated caller could still extract the relationship's distinct
// choices (referenced, publicly-visible related docs by title/slug, plus
// per-value counts via `?counts=`).

describe('Pieces Public API — relationship choices/counts projection guard (GHSA-xmpp-f9v3-r7qh)', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  it('should initialize with article + author piece types', async function() {
    apos = await t.create({
      root: module,
      modules: {
        author: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'author',
            label: 'Author'
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article',
            label: 'Article'
          },
          fields: {
            add: {
              foo: {
                label: 'Foo',
                type: 'string'
              },
              // Deliberately named with a leading underscore, as recommended.
              // Its slug-alias builders are `author` / `authorAnd`; its
              // operation builders are `_author` / `_authorAnd`.
              _author: {
                label: 'Author',
                type: 'relationship',
                withType: 'author'
              }
            }
          }
        }
      }
    });
    assert(apos.modules.article);
    assert(apos.modules.author);

    // Sanity: confirm the relationship registered the extra query builders
    // whose names differ from the `_author` schema field name. These are the
    // aliases the guard must also gate.
    const builders = apos.article.find(apos.task.getReq()).builders;
    assert(builders._author, 'expected relationship builder "_author"');
    assert(builders._authorAnd, 'expected relationship builder "_authorAnd"');
    assert(builders.author, 'expected relationship slug-alias builder "author"');
    assert(builders.authorAnd, 'expected relationship slug-alias builder "authorAnd"');
  });

  let jane;

  it('should insert a public author and a public article that references it', async function() {
    const req = apos.task.getReq();
    jane = await apos.author.insert(req, {
      ...apos.author.newInstance(),
      title: 'Jane Author',
      visibility: 'public'
    });
    await apos.article.insert(req, {
      ...apos.article.newInstance(),
      title: 'My Article',
      foo: 'bar',
      visibility: 'public',
      _author: [ jane ]
    });

    // Confirm the relationship persisted so that, absent the guard, the
    // distinct-values leak would actually have data to expose. This is what
    // makes the "must not leak" assertions below meaningful.
    const article = await apos.article.find(req, { title: 'My Article' }).toObject();
    assert(article);
    assert(Array.isArray(article._author) && article._author.length === 1);
    assert.strictEqual(article._author[0].title, 'Jane Author');
    assert(Array.isArray(article.authorIds) && article.authorIds.length === 1);
  });

  it('baseline: an anonymous list with a projection excluding _author does not expose the relationship', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article');
    assert(response);
    assert(response.results);
    assert.strictEqual(response.results.length, 1);
    assert.strictEqual(response.results[0].title, 'My Article');
    // The relationship must not be populated, and its idsStorage must not be
    // exposed, when excluded from the projection. (An excluded relationship
    // comes back as an empty array, so check length rather than truthiness.)
    assert(
      !response.results[0]._author || response.results[0]._author.length === 0,
      '_author must not be populated when excluded from publicApiProjection'
    );
    assert(!response.results[0].authorIds, 'authorIds must not be exposed when excluded from publicApiProjection');
  });

  // Positive control: this proves the relationship choices machinery works and
  // that the referenced author is discoverable — so the "must not leak" tests
  // that follow (with the SAME data, only the projection changed) genuinely
  // demonstrate the guard is doing the blocking, not an absence of data.
  it('when _author IS in the publicApiProjection, ?choices=author returns the related choices', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1,
      _author: 1
    };
    const response = await apos.http.get('/api/v1/article?choices=author');
    assert(response);
    assert(response.choices);
    assert(Array.isArray(response.choices.author));
    assert(
      response.choices.author.some(c => c.label === 'Jane Author'),
      'expected the related author among the choices when the relationship is projected'
    );
    // The slug alias exposes the related doc slug as the choice value.
    assert(response.choices.author.some(c => c.value === jane.slug));
  });

  it('SECURITY: ?choices=author must not leak choices for a relationship excluded from publicApiProjection', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article?choices=author');
    assert(response);
    assertNoLeak(
      response.choices,
      'author',
      'relationship slug-alias choices for excluded field "_author" must not be exposed publicly via ?choices=author'
    );
  });

  it('SECURITY: ?choices=authorAnd must not leak choices for a relationship excluded from publicApiProjection', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article?choices=authorAnd');
    assert(response);
    assertNoLeak(
      response.choices,
      'authorAnd',
      'relationship slug-alias choices for excluded field "_author" must not be exposed publicly via ?choices=authorAnd'
    );
  });

  it('SECURITY: ?choices=_authorAnd must not leak choices for a relationship excluded from publicApiProjection', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article?choices=_authorAnd');
    assert(response);
    assertNoLeak(
      response.choices,
      '_authorAnd',
      'relationship operation-builder choices for excluded field "_author" must not be exposed publicly via ?choices=_authorAnd'
    );
  });

  it('SECURITY: ?counts=author must not leak counts for a relationship excluded from publicApiProjection', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article?counts=author');
    assert(response);
    assertNoLeak(
      response.counts,
      'author',
      'relationship slug-alias counts for excluded field "_author" must not be exposed publicly via ?counts=author'
    );
  });

  // Regression guard: the exact-name case was already blocked by the parent
  // CVE fix and must stay blocked.
  it('?choices=_author (exact relationship field name) remains blocked when excluded from publicApiProjection', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/article?choices=_author');
    assert(response);
    assertNoLeak(
      response.choices,
      '_author',
      'relationship choices for excluded field "_author" must not be exposed publicly'
    );
  });

  // The guard is a public-API protection only; authenticated full-API callers
  // (no publicApiProjection applied) must still receive relationship choices.
  it('authenticated full-API callers still receive relationship choices for a non-projected relationship', async function() {
    apos.article.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    const req = apos.task.getReq();
    const query = apos.article.find(req).choices([ 'author' ]);
    await query.toArray();
    const choices = query.get('choicesResults');
    assert(choices);
    assert(choices.author);
    assert(choices.author.some(c => c.label === 'Jane Author'));
  });
});
