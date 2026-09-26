const assert = require('assert').strict;
const consolidation = require(
  '../modules/@apostrophecms/document-versions/lib/consolidation.js'
);

describe('Document Versions consolidation', function () {
  // Version records, newest first, from `[ _id, authorId, ai, extra ]`
  function records(...specs) {
    return specs.map(([ _id, authorId, ai, extra ]) => ({
      _id,
      authorId,
      ai,
      mode: 'draft',
      changeCount: 1,
      ...extra
    }));
  }

  function shape(items) {
    return items.map(item => item.versionIds || item._id);
  }

  it('should consolidate alternating saves with and without AI by one author', function () {
    const items = consolidation.consolidate(records(
      [ 'e', 'ann', false ],
      [ 'd', 'ann', true ],
      [ 'c', 'ann', false ],
      [ 'b', 'ann', true ],
      [ 'a', 'ann', false ]
    ));

    assert.deepEqual(shape(items), [ [ 'e', 'd', 'c', 'b', 'a' ] ]);
  });

  it('should shape a consolidated version as its newest version, with AI and without a change count', function () {
    const [ newest, older ] = records(
      [ 'b', 'ann', false, {
        createdAt: 2,
        updatedAt: 3,
        author: 'Ann'
      } ],
      [ 'a', 'ann', true, {
        createdAt: 1,
        author: 'Ann'
      } ]
    );
    const items = consolidation.consolidate([ newest, older ]);

    assert.deepEqual(items, [ {
      _id: 'b',
      authorId: 'ann',
      author: 'Ann',
      ai: true,
      mode: 'draft',
      createdAt: 2,
      updatedAt: 3,
      versionIds: [ 'b', 'a' ]
    } ]);
  });

  it('should leave versions saved all with or all without AI alone', function () {
    const all = records(
      [ 'd', 'ann', true ],
      [ 'c', 'ann', true ],
      [ 'b', 'bob', false ],
      [ 'a', 'bob', false ]
    );

    assert.deepEqual(consolidation.consolidate(all), all);
  });

  it('should end a consolidated version at another author', function () {
    const items = consolidation.consolidate(records(
      [ 'e', 'ann', false ],
      [ 'd', 'ann', true ],
      [ 'c', 'bob', false ],
      [ 'b', 'ann', true ],
      [ 'a', 'ann', false ]
    ));

    assert.deepEqual(shape(items), [ [ 'e', 'd' ], 'c', [ 'b', 'a' ] ]);
  });

  it('should end a consolidated version at a published version, a promoted draft included', function () {
    const items = consolidation.consolidate(records(
      [ 'e', 'ann', false ],
      [ 'd', 'ann', true ],
      [ 'c', 'ann', true, { mode: 'published' } ],
      [ 'b', 'ann', true ],
      [ 'a', 'ann', false ]
    ));

    assert.deepEqual(shape(items), [ [ 'e', 'd' ], 'c', [ 'b', 'a' ] ]);
  });

  it('should keep a restored version out of any consolidated version', function () {
    const items = consolidation.consolidate(records(
      [ 'd', 'ann', true ],
      [ 'c', 'ann', false, { restoredFrom: { _id: 'a' } } ],
      [ 'b', 'ann', true ],
      [ 'a', 'ann', false ]
    ));

    assert.deepEqual(shape(items), [ 'd', 'c', [ 'b', 'a' ] ]);
  });

  it('should treat saves without a user as one author', function () {
    const items = consolidation.consolidate(records(
      [ 'b', null, true ],
      [ 'a', undefined, false ]
    ));

    assert.deepEqual(shape(items), [ [ 'b', 'a' ] ]);
  });

  it('should tell whether two neighbours share a sequence', function () {
    const [ one, two, other, published ] = records(
      [ 'd', 'ann', true ],
      [ 'c', 'ann', true ],
      [ 'b', 'bob', true ],
      [ 'a', 'ann', true, { mode: 'published' } ]
    );

    assert.equal(consolidation.inSameSequence(one, two), true);
    assert.equal(consolidation.inSameSequence(two, other), false);
    assert.equal(consolidation.inSameSequence(one, published), false);
  });
});
