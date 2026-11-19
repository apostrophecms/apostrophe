const assert = require('assert').strict;
const t = require('apostrophe/test-lib/util.js');

describe('@apostrophecms/event', function () {
  this.timeout(t.timeout);

  describe('repeating events', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        testModule: true,
        modules: {
          '@apostrophecms/event': {
            options: {
              maxRepeatCount: 5
            }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    async function insertRepeating(title, repeatCount) {
      const req = apos.task.getReq({ mode: 'draft' });
      const event = apos.modules['@apostrophecms/event'];
      const piece = event.newInstance();
      await event.convert(req, {
        title,
        startDate: '2026-01-01',
        allDay: true,
        dateType: 'repeat',
        repeatInterval: 'weeks',
        repeatCount
      }, piece);
      const inserted = await event.insert(req, piece);
      return apos.doc.db.countDocuments({
        type: '@apostrophecms/event',
        aposMode: 'draft',
        eventGroupId: inserted.eventGroupId,
        isClone: true
      });
    }

    it('creates one repetition per requested repeat', async function () {
      assert.equal(await insertRepeating('Three times', 3), 3);
    });

    it('creates no more repetitions than the maxRepeatCount option allows', async function () {
      assert.equal(await insertRepeating('Many times', 1000), 5);
    });

    it('gives the repeat count field a max for the editor', function () {
      const field = apos.modules['@apostrophecms/event'].schema
        .find(field => field.name === 'repeatCount');
      assert.equal(field.max, 5);
    });
  });

  describe('maxRepeatCount default', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        testModule: true,
        modules: {
          '@apostrophecms/event': {}
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('allows a year of daily repetitions by default', function () {
      const event = apos.modules['@apostrophecms/event'];
      assert.equal(event.options.maxRepeatCount, 366);
      const field = event.schema.find(field => field.name === 'repeatCount');
      assert.equal(field.max, 366);
    });
  });
});
