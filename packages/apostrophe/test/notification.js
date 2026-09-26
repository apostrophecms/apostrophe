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

describe('Notifications', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(function() {
    return apos.notification.db.deleteMany({});
  });

  it('triggers and stores a regular notification', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    const { noteId } = await apos.notify(req, 'hello', { type: 'success' });
    const doc = await apos.notification.db.findOne({ _id: noteId });

    assert.equal(doc.message, 'hello');
    assert.equal(doc.type, 'success');
    assert.equal(doc.userId, 'user1');
  });

  it('requires a message without the bus flag', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    await assert.rejects(apos.notify(req), { name: 'required' });
    await assert.rejects(
      apos.notify(req, null, { type: 'info' }),
      { name: 'required' }
    );
    // The options-in-place form does not relax the requirement by itself
    await assert.rejects(
      apos.notify(req, {
        type: 'info',
        event: { name: 'my-event' }
      }),
      { name: 'required' }
    );
  });

  it('stores a bus notification without a message', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    const { noteId } = await apos.notify(req, {
      bus: true,
      event: {
        name: 'my-event',
        data: { a: 1 }
      }
    });
    const doc = await apos.notification.db.findOne({ _id: noteId });

    assert.equal(doc.bus, true);
    assert.equal(doc.message, null);
    assert.deepEqual(doc.event, {
      name: 'my-event',
      data: { a: 1 }
    });
    assert.equal(doc.userId, 'user1');
  });

  it('accepts a bus notification with an explicit null message', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    const { noteId } = await apos.notify(req, null, {
      bus: true,
      event: { name: 'my-event' }
    });
    const doc = await apos.notification.db.findOne({ _id: noteId });

    assert.equal(doc.bus, true);
    assert.equal(doc.message, null);
  });

  it('a bus notification requires an event with a name', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    await assert.rejects(
      apos.notify(req, { bus: true }),
      { name: 'invalid' }
    );
    await assert.rejects(
      apos.notify(req, {
        bus: true,
        event: {}
      }),
      { name: 'invalid' }
    );
  });

  it('a bus notification travels to its owner like any other', async function() {
    const req = apos.task.getReq({ user: { _id: 'user1' } });

    await apos.notify(req, {
      bus: true,
      event: { name: 'my-event' }
    });
    const { notifications } = await apos.notification.find(req, {});

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].bus, true);

    const other = apos.task.getReq({ user: { _id: 'user2' } });
    const found = await apos.notification.find(other, {});
    assert.equal(found.notifications.length, 0);
  });

  it('still requires a user', async function() {
    await assert.rejects(
      apos.notify({}, {
        bus: true,
        event: { name: 'my-event' }
      }),
      { name: 'forbidden' }
    );
  });
});

// Two processes share one database, as in any real deployment: messages
// triggered in one must reach polls waiting in the other
describe('Notification channels', function() {
  this.timeout(t.timeout);

  let apos;
  // A second process of the same site
  let other;
  let notification;
  let req;
  const allowed = new Set([ 'open', 'other' ]);

  before(async function() {
    const options = {
      root: module,
      shortName: `test-channels-${Date.now()}`,
      modules: {
        '@apostrophecms/notification': {
          options: {
            queryInterval: 300,
            channelQueryInterval: 100,
            longPollingTimeout: 1500
          }
        }
      }
    };
    apos = await t.create(options);
    other = await t.create(options);
    for (const instance of [ apos, other ]) {
      instance.notification.addChannelType('test', {
        canSubscribe: async (req, id) => allowed.has(id)
      });
    }
    notification = apos.notification;
    req = apos.task.getReq({ user: { _id: 'user1' } });
  });

  after(async function() {
    // The database is shared, and dropped along with the first
    await other.destroy();
    await t.destroy(apos);
  });

  beforeEach(async function() {
    await notification.db.deleteMany({});
    await notification.channelDb.deleteMany({});
  });

  // Triggered in `instance`, which defaults to the process that polls
  function send(channel, data, options = {}, instance = apos) {
    return instance.notify(req, {
      bus: true,
      channel,
      event: {
        name: 'test-event',
        data
      },
      ...options
    });
  }

  function poll(query, user = req.user) {
    const pollReq = apos.task.getReq({ user });
    pollReq.query = {
      ...query,
      ...(query.channels && { channels: JSON.stringify(query.channels) })
    };
    return notification.restApiRoutes.getAll.route(pollReq);
  }

  it('requires a registered channel type and the bus flag', async function() {
    await assert.rejects(send('nope:open', 1), { name: 'invalid' });
    await assert.rejects(send('test', 1), { name: 'invalid' });
    await assert.rejects(send('test:', 1), { name: 'invalid' });
    await assert.rejects(
      apos.notify(req, 'hello', { channel: 'test:open' }),
      { name: 'invalid' }
    );
  });

  it('numbers messages on each channel from 1 with no gaps or duplicates', async function() {
    // Both processes at once
    const results = await Promise.all([
      ...Array.from({ length: 20 }, (v, i) => send('test:open', i, {}, (i % 2) ? other : apos)),
      ...Array.from({ length: 5 }, (v, i) => send('test:other', i, {}, other))
    ]);

    const seqs = channel => results
      .filter(result => result.channel === channel)
      .map(({ seq }) => seq)
      .sort((a, b) => a - b);

    assert.deepEqual(seqs('test:open'), Array.from({ length: 20 }, (v, i) => i + 1));
    assert.deepEqual(seqs('test:other'), [ 1, 2, 3, 4, 5 ]);
  });

  it('delivers messages after the given seq, in order, without touching personal notifications', async function() {
    await send('test:open', 'a');
    await send('test:open', 'b');
    await send('test:open', 'c');

    const result = await poll({ channels: { 'test:open': 1 } });

    assert.deepEqual(
      result.channelMessages.map(({ seq, event }) => [ seq, event.data ]),
      [ [ 2, 'b' ], [ 3, 'c' ] ]
    );
    assert.deepEqual(result.notifications, []);
    assert.equal(await notification.db.countDocuments({}), 0);
  });

  it('starts a new subscriber at the current seq and responds at once', async function() {
    await send('test:open', 'a');
    await send('test:open', 'b');

    const start = Date.now();
    const result = await poll({ channels: { 'test:open': null } });

    assert.deepEqual(result.channelCursors, { 'test:open': 2 });
    assert.deepEqual(result.channelMessages, []);
    assert.ok(Date.now() - start < 1000);
  });

  it('refuses channels the user may not subscribe to', async function() {
    await send('test:open', 'a');
    allowed.delete('other');
    try {
      await send('test:other', 'secret');
      const result = await poll({
        channels: {
          'test:open': 0,
          'test:other': 0,
          'nope:open': 0
        }
      });

      assert.deepEqual(result.refusedChannels.sort(), [ 'nope:open', 'test:other' ]);
      assert.deepEqual(result.channelMessages.map(({ channel }) => channel), [ 'test:open' ]);
    } finally {
      allowed.add('other');
    }
  });

  it('rejects malformed or excessive channel subscriptions', async function() {
    await assert.rejects(poll({ channels: 'not json' }), { name: 'invalid' });
    await assert.rejects(poll({ channels: '[]' }), { name: 'invalid' });

    const many = {};
    for (let i = 0; i <= notification.options.maxChannels; i++) {
      many[`test:open${i}`] = 0;
    }
    await assert.rejects(poll({ channels: many }), { name: 'invalid' });
  });

  it('spares the sending tab the event but still advances its cursor', async function() {
    await send('test:open', 'mine', { originTabId: 'tab1' });
    await send('test:open', 'theirs', { originTabId: 'tab2' });

    const result = await poll({
      tabId: 'tab1',
      channels: { 'test:open': 0 }
    });

    assert.deepEqual(
      result.channelMessages.map(({ seq, event }) => [ seq, event?.data ]),
      [ [ 1, undefined ], [ 2, 'theirs' ] ]
    );
  });

  it('never delivers an expired channel message', async function() {
    const { seq } = await send('test:open', 'old');
    await notification.channelDb.updateOne(
      {
        channel: 'test:open',
        seq
      },
      { $set: { expireAt: new Date(Date.now() - 1000) } }
    );
    await send('test:open', 'new');

    const result = await poll({ channels: { 'test:open': 0 } });

    assert.deepEqual(result.channelMessages.map(({ seq }) => seq), [ 2 ]);
  });

  it('delivers a message triggered in another process within the query interval', async function() {
    const start = Date.now();
    const pending = poll({ channels: { 'test:open': 0 } });
    await new Promise(resolve => setTimeout(resolve, 200));
    await send('test:open', 'hello', {}, other);
    const result = await pending;

    assert.deepEqual(result.channelMessages.map(({ event }) => event.data), [ 'hello' ]);
    // Well within the long polling timeout
    assert.ok(Date.now() - start < 1000);
  });

  it('does not deliver messages on channels the poll did not ask for', async function() {
    const pending = poll({ channels: { 'test:open': 0 } });
    await send('test:other', 'elsewhere', {}, other);
    const result = await pending;

    assert.deepEqual(result.channelMessages, []);
  });

  it('delivers a personal notification triggered in another process', async function() {
    const pending = poll({});
    await new Promise(resolve => setTimeout(resolve, 100));
    await other.notify(req, 'hello');
    const result = await pending;

    assert.equal(result.notifications.length, 1);
  });
});
