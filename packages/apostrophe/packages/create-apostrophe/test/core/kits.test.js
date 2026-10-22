import assert from 'node:assert/strict';
import {
  KITS, KIT_IDS, isKnownKit, getKit, deriveKitId
} from '../../src/core/kits.js';

describe('core/kits', function () {
  it('registry holds exactly the six contract KitIds', function () {
    assert.deepEqual([ ...KIT_IDS ].sort(), [
      'apostrophe-astro-demo',
      'apostrophe-astro-demo-data',
      'apostrophe-astro-essentials',
      'apostrophe-demo',
      'apostrophe-demo-data',
      'apostrophe-essentials'
    ]);
  });

  it('every entry has a clone URL, label, and consistent flags', function () {
    for (const [ id, kit ] of Object.entries(KITS)) {
      assert.match(kit.repo, /^https:\/\/github\.com\/.+\.git$/, id);
      assert.equal(typeof kit.label, 'string');
      assert.ok(kit.label.length > 0, id);
      assert.equal(
        kit.frontend,
        id.startsWith('apostrophe-astro-') ? 'astro' : null,
        id
      );
      assert.equal(kit.seedData, id.endsWith('-demo-data'), id);
    }
  });

  it('demo and demo-data share one repo per build (data applied post-clone)', function () {
    assert.equal(
      KITS['apostrophe-demo'].repo,
      KITS['apostrophe-demo-data'].repo
    );
    assert.equal(
      KITS['apostrophe-astro-demo'].repo,
      KITS['apostrophe-astro-demo-data'].repo
    );
    // essentials is a distinct repo from demo.
    assert.notEqual(
      KITS['apostrophe-essentials'].repo,
      KITS['apostrophe-demo'].repo
    );
  });

  it('getKit / isKnownKit resolve known ids and reject unknown', function () {
    assert.equal(isKnownKit('apostrophe-demo'), true);
    assert.equal(isKnownKit('nope'), false);
    assert.equal(getKit('apostrophe-essentials'), KITS['apostrophe-essentials']);
    assert.throws(() => getKit('nope'), TypeError);
  });

  it('deriveKitId covers the full D6 matrix', function () {
    const cases = [
      [ {
        build: 'astro',
        startingPoint: 'essentials'
      }, 'apostrophe-astro-essentials' ],
      [ {
        build: 'astro',
        startingPoint: 'demo',
        sampleContent: false
      }, 'apostrophe-astro-demo' ],
      [ {
        build: 'astro',
        startingPoint: 'demo',
        sampleContent: true
      }, 'apostrophe-astro-demo-data' ],
      [ {
        build: 'standalone',
        startingPoint: 'essentials'
      }, 'apostrophe-essentials' ],
      [ {
        build: 'standalone',
        startingPoint: 'demo',
        sampleContent: false
      }, 'apostrophe-demo' ],
      [ {
        build: 'standalone',
        startingPoint: 'demo',
        sampleContent: true
      }, 'apostrophe-demo-data' ]
    ];
    for (const [ input, expected ] of cases) {
      const id = deriveKitId(input);
      assert.equal(id, expected);
      assert.ok(isKnownKit(id), `derived ${id} must be in the registry`);
    }
  });

  it('deriveKitId ignores sampleContent for essentials', function () {
    assert.equal(
      deriveKitId({
        build: 'standalone',
        startingPoint: 'essentials',
        sampleContent: true
      }),
      'apostrophe-essentials'
    );
  });

  it('deriveKitId rejects unknown build / startingPoint', function () {
    assert.throws(() => deriveKitId({
      build: 'x',
      startingPoint: 'demo'
    }), TypeError);
    assert.throws(
      () => deriveKitId({
        build: 'astro',
        startingPoint: 'x'
      }),
      TypeError
    );
  });
});
