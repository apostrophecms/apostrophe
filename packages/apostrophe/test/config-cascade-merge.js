const t = require('../test-lib/test.js');
const assert = require('assert');

// PRO-9564
// This test pins an established moog-require contract so it is not "fixed" by
// accident — changing it would silently break existing projects.
//
// Scope: the SAME module configured BOTH via the app.js object passed to
// apostrophe() AND its project-level index.js. (NOT cascade merging across the
// module chain via extends/improvements, which merges field-by-field as usual.)
//
// moog-require collapses the two sources with a shallow `_.defaults` before the
// chain is built, so app.js wins for any top-level section declared in both.
// `options` then gets a second pass that gap-fills from index.js, but no other
// section does — so a cascade like `fields` is NOT merged: an app.js `fields`
// replaces the index.js `fields` wholesale, dropping even unrelated
// project-level fields. The options-only gap-fill is by design.
//
// Example — this test and its fixture:
//   app.js   modules: { 'collision-piece': { fields: { add: { configField } } } }
//   index.js test/modules/collision-piece/index.js -> fields: { add: { projectField } }
//   result   schema has `configField`; `projectField` is gone, although the two
//            fields are unrelated.
//   options  app.js { alias: ... } still merges with any index.js options
//            (gap-fill), unlike `fields`.
//
// Files: collapse in packages/apostrophe/lib/moog-require.js (~`_.defaults(
// definition, projectLevelDefinition)`); cascade compiler that the dropped
// section never reaches in packages/apostrophe/lib/moog.js; project-level
// fixture in test/modules/collision-piece/index.js.

describe('config-object vs project-level cascade merge (moog-require contract)', function () {
  this.timeout(t.timeout);
  let apos;
  after(async () => {
    await t.destroy(apos);
  });

  it('app.js `fields` wins over the project-level file when both declare it', async function () {
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
    // The project-level file's fields are dropped wholesale — the contract.
    assert(!names.includes('projectField'));
    // Options are the exception: an index.js-only option is gap-filled in,
    // where a project-level field would have been dropped.
    assert.strictEqual(apos.collisionPiece.options.fromProjectFile, true);
  });
});
