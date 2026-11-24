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

describe('@apostrophecms/event series link', function () {
  let apos;
  let events;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: {
        '@apostrophecms/event': {}
      }
    });
    events = apos.modules['@apostrophecms/event'];
  });

  after(async function () {
    await t.destroy(apos);
  });

  afterEach(async function () {
    await apos.doc.db.deleteMany({ type: '@apostrophecms/event' });
  });

  function draftReq() {
    return apos.task.getReq({ mode: 'draft' });
  }

  function occurrences(aposMode) {
    return apos.doc.db
      .find({
        type: '@apostrophecms/event',
        aposMode
      })
      .sort({ startDate: 1 })
      .toArray();
  }

  async function insertSeries() {
    await events.insert(draftReq(), {
      ...events.newInstance(),
      title: 'Weekly event',
      slug: 'weekly-event',
      startDate: '2030-01-07',
      startTime: '09:00:00',
      endTime: '10:00:00',
      dateType: 'repeat',
      repeatInterval: 'weeks',
      repeatCount: 3
    });
    return occurrences('draft');
  }

  async function publishSeries() {
    const [ parent ] = await insertSeries();
    await events.publish(draftReq(), parent);
    return occurrences('published');
  }

  // What a client sends when it saves an event: the editable fields only
  function editableFields(draft) {
    return {
      title: 'Renamed event',
      slug: draft.slug,
      startDate: draft.startDate,
      allDay: draft.allDay,
      startTime: draft.startTime,
      endTime: draft.endTime,
      dateType: draft.dateType,
      repeatInterval: draft.repeatInterval,
      repeatCount: draft.repeatCount
    };
  }

  async function save(draft, input) {
    const req = draftReq();
    await events.convert(req, input, draft);
    await events.update(req, draft);
    return apos.doc.db.findOne({ _id: draft._id });
  }

  it('publishes every occurrence of a repeating event', async function () {
    assert.equal((await publishSeries()).length, 4);
  });

  it('keeps eventGroupId on every published occurrence', async function () {
    const drafts = await insertSeries();
    const groupId = drafts[0].eventGroupId;
    assert.ok(groupId);
    await events.publish(draftReq(), drafts[0]);
    const published = await occurrences('published');
    assert.deepEqual(
      published.map(event => event.eventGroupId),
      drafts.map(() => groupId)
    );
  });

  it('keeps isClone on published copies', async function () {
    const [ , ...copies ] = await publishSeries();
    assert.deepEqual(copies.map(event => event.isClone), [ true, true, true ]);
  });

  it('does not mark the published original as a copy', async function () {
    const [ original ] = await publishSeries();
    assert.notEqual(original.isClone, true);
  });

  it('keeps the series link when an occurrence is saved without it', async function () {
    const [ , copy ] = await insertSeries();
    const saved = await save(copy, editableFields(copy));
    assert.equal(saved.title, 'Renamed event');
    assert.equal(saved.eventGroupId, copy.eventGroupId);
    assert.equal(saved.isClone, true);
  });

  it('ignores series link values sent by a client', async function () {
    const [ original ] = await insertSeries();
    const groupId = original.eventGroupId;
    const saved = await save(original, {
      ...editableFields(original),
      eventGroupId: 'another-series',
      isClone: true
    });
    assert.equal(saved.eventGroupId, groupId);
    assert.notEqual(saved.isClone, true);
  });

  describe('migration', function () {
    // A new site marks every migration as done without running it, so
    // runOne() would skip this one. Call it directly instead.
    async function runMigration() {
      const migration = apos.migration.migrations.find(
        m => m.name === '@apostrophecms/event:copy-series-link-to-published'
      );
      assert.ok(migration);
      await migration.fn();
    }

    // Published documents as they were stored before the fix: no series link
    async function stripPublished() {
      await apos.doc.db.updateMany(
        {
          type: '@apostrophecms/event',
          aposMode: 'published'
        },
        {
          $unset: {
            eventGroupId: 1,
            isClone: 1
          }
        }
      );
    }

    it('copies eventGroupId to published events that lost it', async function () {
      const published = await publishSeries();
      const groupId = published[0].eventGroupId;
      await stripPublished();
      await runMigration();
      assert.deepEqual(
        (await occurrences('published')).map(event => event.eventGroupId),
        published.map(() => groupId)
      );
    });

    it('copies isClone to published copies that lost it', async function () {
      await publishSeries();
      await stripPublished();
      await runMigration();
      const [ original, ...copies ] = await occurrences('published');
      assert.deepEqual(copies.map(event => event.isClone), [ true, true, true ]);
      assert.notEqual(original.isClone, true);
    });

    it('leaves draft-only events without a published document alone', async function () {
      await insertSeries();
      await runMigration();
      assert.equal((await occurrences('published')).length, 0);
    });
  });
});
