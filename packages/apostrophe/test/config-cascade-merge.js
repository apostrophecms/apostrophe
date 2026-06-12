const t = require('../test-lib/test.js');
const assert = require('assert');

// PRO-9564
// Documents established moog-require behavior (see lib/moog-require.js): when a
// module is configured BOTH via the app.js config object AND a project-level
// index.js, app.js wins for any section declared in both. Only `options` gets a
// further merge so index.js can fill gaps; cascade sections like `fields` do not
// merge — the app.js declaration replaces the project-level one.
//
// This is intentional and long-standing; changing it is a major BC break. It is
// the reason multisite enhances @apostrophecms/user through the module chain (a
// bundled improvement) rather than inline config, so it composes with a
// project's dashboard/modules/@apostrophecms/user/index.js instead of clobbering
// it. This test guards the contract so it is not "fixed" by accident.
//
// The project-level fixture lives in test/modules/collision-piece/index.js.

describe('config-object vs project-level cascade merge (moog-require contract)', function() {
  this.timeout(t.timeout);
  let apos;
  after(async () => {
    await t.destroy(apos);
  });

  it('app.js `fields` wins over the project-level file when both declare it', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'collision-piece': {
          extend: '@apostrophecms/piece-type',
          options: { alias: 'collisionPiece' },
          fields: {
            add: {
              configField: {
                type: 'string',
                label: 'Config Field'
              }
            },
            group: {
              configGroup: {
                label: 'Config Group',
                fields: [ 'configField' ]
              }
            }
          }
        }
      }
    });

    const names = apos.collisionPiece.schema.map(f => f.name);
    // The app.js (config object) fields win.
    assert(names.includes('configField'));
    // The project-level file's fields are dropped (not merged) — the contract.
    assert(!names.includes('projectField'));
  });
});
