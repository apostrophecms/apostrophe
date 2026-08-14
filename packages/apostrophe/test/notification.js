const { strict: assert } = require('node:assert');
const t = require('../test-lib/test.js');

describe('Notification module', function() {
  let apos;
  let notification;
  let req;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({ root: module });
    notification = apos.modules['@apostrophecms/notification'];
    const user = await t.createAdmin(apos);
    req = apos.task.getReq({ user });
  });

  after(function() {
    return t.destroy(apos);
  });

  afterEach(function() {
    return notification.db.deleteMany({});
  });

  it('has a sparse expiry index on expireAt', async function() {
    const indexes = await notification.db.indexes();
    const index = indexes.find(index => index.key.expireAt === 1);

    assert.equal(index && index.sparse, true);
    // Only MongoDB honors, and reports back, per-document expiry;
    // the other adapters accept and ignore it
    if (t.testDbProtocol === 'mongodb') {
      assert.equal(index.expireAfterSeconds, 0);
    }
  });

  it('trigger: expires a notification after the module option', async function() {
    const { noteId } = await notification.trigger(req, 'test');
    const note = await notification.db.findOne({ _id: noteId });

    const expected = note.createdAt.getTime() + notification.options.expireAfter * 1000;

    // Both timestamps are taken within the same call, a second apart at worst
    assert.ok(Math.abs(note.expireAt.getTime() - expected) < 1000);
  });

  it('trigger: honors a per-notification expireAfter', async function() {
    const { noteId } = await notification.trigger(req, 'test', { expireAfter: 60 });
    const note = await notification.db.findOne({ _id: noteId });

    const expected = note.createdAt.getTime() + 60000;

    assert.ok(Math.abs(note.expireAt.getTime() - expected) < 1000);
    assert.equal(note.expireAfter, undefined);
  });

  it('trigger: expireAfter 0 keeps a notification until it is dismissed', async function() {
    const { noteId } = await notification.trigger(req, 'test', { expireAfter: 0 });
    const note = await notification.db.findOne({ _id: noteId });

    assert.equal(note.expireAt, undefined);
  });

  it('find: sends unexpired notifications, including those never set to expire', async function() {
    const { noteId: expiring } = await notification.trigger(req, 'expiring');
    const { noteId: permanent } = await notification.trigger(req, 'permanent', {
      expireAfter: 0
    });

    const { notifications } = await notification.find(req, {});

    const actual = notifications.map(({ _id }) => _id).sort();
    const expected = [ expiring, permanent ].sort();

    assert.deepEqual(actual, expected);
  });

  it('find: never sends a notification that is stored past its expiry', async function() {
    const { noteId } = await notification.trigger(req, 'expired');
    await notification.db.updateOne(
      { _id: noteId },
      { $set: { expireAt: new Date(Date.now() - 1000) } }
    );

    const { notifications, dismissed } = await notification.find(req, {});

    assert.deepEqual(notifications, []);
    assert.deepEqual(dismissed, []);
  });

  it('dismiss: a notification that is gone is a no-op, not an error', async function() {
    const { noteId } = await notification.trigger(req, 'test');
    await notification.db.deleteMany({ _id: noteId });

    await assert.doesNotReject(() => notification.dismiss(req, noteId));

    assert.equal(await notification.db.countDocuments({}), 0);
  });

  it('notification-expire migration: deletes overdue notifications, stamps the rest', async function() {
    const { expireAfter } = notification.options;
    const overdue = {
      _id: 'overdue',
      userId: req.user._id,
      message: 'overdue',
      createdAt: new Date(Date.now() - (expireAfter + 60) * 1000)
    };
    const recent = {
      _id: 'recent',
      userId: req.user._id,
      message: 'recent',
      createdAt: new Date()
    };
    await notification.db.insertMany([ overdue, recent ]);

    const migration = apos.migration.migrations.find(
      ({ name }) => name === 'notification-expire'
    );
    await migration.fn();

    const actual = {
      overdue: await notification.db.findOne({ _id: 'overdue' }),
      recent: !!(await notification.db.findOne({ _id: 'recent' })).expireAt
    };
    const expected = {
      overdue: null,
      recent: true
    };

    assert.deepEqual(actual, expected);
  });
});
