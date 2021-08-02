const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

const config = {
  root: module,
  modules: {
    '@apostrophecms/i18n': {
      options: {
        locales: {
          en: {
            label: 'English'
          },
          'en-CA': {
            label: 'Canadian English'
          },
          'en-FR': {
            label: 'Canadian French'
          }
        }
      }
    }
  }
};

describe('Locales', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should replicate key docs across locales at startup', async function() {
    apos = await t.create(config);

    const homes = await apos.doc.db.find({ parkedId: 'home' }).toArray();
    // Home page in default locale is published, others start out draft only
    assert(homes.length === 4);
    const archives = await apos.doc.db.find({ parkedId: 'archive' }).toArray();
    // Archive page in default locale is published, others start out draft only
    assert(archives.length === 4);
    const globals = await apos.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    // Global doc in default locale is published, others start out draft only
    assert(globals.length === 4);
  });

  it('should not replicate redundantly on a second startup in same db', async function() {
    const apos2 = await t.create(config);

    const homes = await apos2.doc.db.find({ parkedId: 'home' }).toArray();
    // Home page in default locale is published, others start out draft only
    assert(homes.length === 4);
    const archives = await apos2.doc.db.find({ parkedId: 'archive' }).toArray();
    // Archive page in default locale is published, others start out draft only
    assert(archives.length === 4);
    const globals = await apos2.doc.db.find({ type: '@apostrophecms/global' }).toArray();
    // Global doc in default locale is published, others start out draft only
    assert(globals.length === 4);

    await apos2.destroy();
  });
});
