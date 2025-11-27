const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');

describe('SVG Sprites', function () {
  let apos;
  let svgSprites;

  this.timeout(10000);

  after(async function () {
    testUtil.destroy(apos);
    testUtil.destroy(apos2);
    testUtil.destroy(apos3);
  });

  it('should be a property of the apos object', async function () {
    apos = await testUtil.create({
      shortname: 'test-exporter',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            session: { secret: 'test-the-svgs' }
          }
        },
        '@apostrophecms/svg-sprite': {
          options: {
            maps: [
              {
                label: 'Places Icons',
                name: 'places',
                file: 'svg/places.svg'
              }
            ]
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/svg-sprite']);
    svgSprites = apos.modules['@apostrophecms/svg-sprite'];
  });

  it('can run the import task', async () => {
    try {
      await apos.task.invoke('@apostrophecms/svg-sprite:import');
    } catch (error) {
      assert(!error);
    }
  });

  let howMany;
  let firstSprites;

  it('can find imported pieces', async function() {
    const req = apos.task.getReq();

    firstSprites = await svgSprites.find(req, {})
      .toArray();

    assert(firstSprites);
    assert(firstSprites.length === 2);
    howMany = firstSprites.length;
  });

  it('can find the SVG file path on the piece', async function () {
    const assetPath = apos.asset.getAssetBaseUrl() + '/modules/@apostrophecms/my-svg-sprite/svg/places.svg';
    assert(firstSprites[0].file === assetPath);
  });

  it('marks existing sprites', async function() {
    try {
      await apos.doc.db.updateMany({ type: '@apostrophecms/svg-sprite' }, {
        $set: {
          existing: true
        }
      });
    } catch (error) {
      assert(!error);
    }
  });

  it('can re-import', async function() {
    try {
      await apos.task.invoke('@apostrophecms/svg-sprite:import');
    } catch (error) {
      assert(!error);
    }
  });

  it('finds the same number of pieces and they are the same pieces', async function() {
    const req = apos.task.getReq();
    const pieces = await svgSprites.find(req, {})
      .toArray();

    assert(pieces);
    assert(pieces.length);
    assert(pieces.length === howMany);
    assert(pieces[0].existing);
  });

  let apos2;

  it('should be a property of the apos2 object', async function () {
    const baseUrl = 'http://localhost:7777';

    apos2 = await testUtil.create({
      shortname: 'test-exporter-2',
      testModule: true,
      baseUrl,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7777,
            session: { secret: 'test-the-svgs-again' }
          }
        },
        '@apostrophecms/svg-sprite': {
          options: {
            maps: [
              {
                label: 'Places Icons',
                name: 'places',
                file: `${baseUrl}/three-places.svg`
              }
            ]
          }
        }
      }
    });

    assert(apos2.modules['@apostrophecms/svg-sprite']);
  });

  it('can import from a URL', async () => {
    const assetUrl = apos2.baseUrl + '/three-places.svg';
    const fileExists = await apos2.http.get(assetUrl);
    assert(fileExists);

    try {
      // Importer is running from the URL in the apos2 module configuration.
      await apos2.task.invoke('@apostrophecms/svg-sprite:import');
    } catch (error) {
      assert(!error);
    }
  });

  let secondSprites;

  it('can find URL-imported pieces', async function() {
    const req = apos2.task.getReq();

    secondSprites = await apos2.modules['@apostrophecms/svg-sprite'].find(req, {})
      .toArray();

    assert(secondSprites);

    assert(secondSprites.length === 3);
  });

  it('can find the SVG file path on the piece', async function () {
    const assetPath = `${apos2.baseUrl}/three-places.svg`;
    assert(secondSprites[0].file === assetPath);
  });

  let apos3;

  it('should be a property of the apos3 object', async function () {
    apos3 = await testUtil.create({
      shortname: 'test-exporter-3',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            session: { secret: 'test-the-svgs-a-third-time' }
          }
        },
        '@apostrophecms/svg-sprite': {
          options: {
            maps: [
              {
                label: 'All Icons',
                name: 'icons',
                file: 'svg/icons-*.svg'
              }
            ]
          }
        }
      }
    });

    assert(apos3.modules['@apostrophecms/svg-sprite']);
  });

  it('can import with a wild card', async () => {
    try {
      // Importer is running from the wild card path in the apos3 module
      // configuration.
      await apos3.task.invoke('@apostrophecms/svg-sprite:import');
    } catch (error) {
      assert(!error);
    }
  });

  let thirdSprites;

  it('can find wild card-imported pieces', async function() {
    const req = apos3.task.getReq();

    thirdSprites = await apos3.modules['@apostrophecms/svg-sprite'].find(req, {})
      .toArray();

    assert(thirdSprites);

    assert(thirdSprites.length === 4);
  });

  it('can find the SVG file path on the piece', async function () {
    const assetPath = apos3.asset.getAssetBaseUrl() + '/modules/@apostrophecms/my-svg-sprite/svg/icons-8675309.svg';

    assert(thirdSprites[2].file === assetPath);
  });
});
