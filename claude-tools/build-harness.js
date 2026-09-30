// Build harness (run via mocha) to produce a realistic production `apos`
// admin-UI bundle. Run with:
//   NODE_ENV=production npx mocha test/build-harness.js
// Produces: apos-build/@apostrophecms/vite/default/dist/apos-build.js(.map)
const t = require('apostrophe/test-lib/util.js');
const fs = require('fs-extra');
const path = require('node:path');

describe('apos bundle analysis', function () {
  this.timeout(300000);
  let apos;

  after(async function () {
    if (apos) {
      await t.destroy(apos);
    }
  });

  it('builds the apos bundle', async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      autoBuild: false,
      shortName: 'apos-bundle-analysis',
      modules: {
        '@apostrophecms/express': {
          options: { session: { secret: 'supersecret' } }
        },
        '@apostrophecms/vite': {
          options: { alias: 'vite' },
          before: '@apostrophecms/asset'
        },
        '@apostrophecms/asset': {
          options: { productionSourceMaps: true }
        }
      }
    });

    console.log('\n=== Running asset build (NODE_ENV=%s) ===', process.env.NODE_ENV);
    const start = Date.now();
    try {
      await apos.task.invoke('@apostrophecms/asset:build');
    } catch (e) {
      // The scene-concatenation post-step can trip over the test harness
      // layout; the Vite dist output we analyze is already produced by then.
      console.log('(build post-step note: %s)', e.message);
    }
    console.log('Build finished in %ds', ((Date.now() - start) / 1000).toFixed(1));

    const dist = path.join(
      __dirname,
      'apos-build/@apostrophecms/vite/default/dist/apos-build.js'
    );
    if (!await fs.pathExists(dist)) {
      throw new Error('apos-build.js not produced at ' + dist);
    }
    const { size } = await fs.stat(dist);
    console.log('\napos-build.js = %d bytes (%s KB)', size, (size / 1024).toFixed(1));
    console.log('DIST=' + dist);
  });
});
