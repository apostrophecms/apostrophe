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

describe('Notification authorization', function() {
  this.timeout(t.timeout);

  let apos;
  let adminReq;
  let editorReq;
  let adminJar;
  let editorJar;

  before(async function() {
    apos = await t.create({
      root: module
    });
    const admin = await t.createAdmin(apos);
    const editor = await t.createUser(apos, 'editor');
    adminReq = apos.task.getReq({ user: admin });
    editorReq = apos.task.getReq({ user: editor });
    adminJar = await withCsrf(await t.loginAs(apos, 'admin'));
    editorJar = await withCsrf(await t.loginAs(apos, 'editor'));
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(function() {
    return apos.notification.db.deleteMany({});
  });

  async function adminNote() {
    const { noteId } = await apos.notify(adminReq, 'secret', {
      event: { name: 'my-event' }
    });
    return noteId;
  }

  // Any page view sets the CSRF cookie, which a browser would always have,
  // so that requests are not simply refused by the CSRF check
  async function withCsrf(jar) {
    await apos.http.get('/', { jar });
    return jar;
  }

  function anonJar() {
    return withCsrf(apos.http.jar());
  }

  function url(noteId, suffix = '') {
    return `/api/v1/@apostrophecms/notification/${noteId}${suffix}`;
  }

  it('the public cannot dismiss a notification', async function() {
    const noteId = await adminNote();

    await assert.rejects(apos.http.patch(url(noteId), {
      body: { dismissed: true },
      jar: await anonJar()
    }));

    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(doc.dismissed, undefined);
  });

  it('the public cannot delete a notification', async function() {
    const noteId = await adminNote();

    await assert.rejects(apos.http.delete(url(noteId), {
      jar: await anonJar()
    }));

    assert.ok(await apos.notification.db.findOne({ _id: noteId }));
  });

  it('the public cannot clear the event of a notification', async function() {
    const noteId = await adminNote();

    await assert.rejects(apos.http.post(url(noteId, '/clear-event'), {
      body: {},
      jar: await anonJar()
    }));

    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(doc.event.name, 'my-event');
  });

  it('the public is refused cleanly when fetching a notification', async function() {
    const noteId = await adminNote();

    await assert.rejects(
      apos.http.get(url(noteId), {
        jar: await anonJar()
      }),
      err => {
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  it('a user cannot dismiss, delete or clear the event of another user\'s notification', async function() {
    const noteId = await adminNote();

    await apos.http.patch(url(noteId), {
      body: { dismissed: true },
      jar: editorJar
    }).catch(() => {});
    await apos.http.delete(url(noteId), {
      jar: editorJar
    }).catch(() => {});
    const cleared = await apos.http.post(url(noteId, '/clear-event'), {
      body: {},
      jar: editorJar
    }).catch(() => false);

    assert.equal(cleared, false);
    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.ok(doc);
    assert.equal(doc.dismissed, undefined);
    assert.equal(doc.event.name, 'my-event');
  });

  it('dismiss: does not dismiss another user\'s notification', async function() {
    const noteId = await adminNote();

    await apos.notification.dismiss(editorReq, noteId).catch(() => {});

    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(doc.dismissed, undefined);
  });

  it('a user can still dismiss, clear the event of and delete their own notification', async function() {
    const noteId = await adminNote();

    const cleared = await apos.http.post(url(noteId, '/clear-event'), {
      body: {},
      jar: adminJar
    });
    assert.equal(cleared, true);

    await apos.http.patch(url(noteId), {
      body: { dismissed: true },
      jar: adminJar
    });
    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(doc.dismissed, true);
    assert.equal(doc.event, null);

    await apos.http.delete(url(noteId), {
      jar: adminJar
    });
    assert.equal(await apos.notification.db.findOne({ _id: noteId }), null);

    // Dismissing one that is already gone is still not an error for the
    // browser, which may dismiss a notification cleaned up in the meantime
    await apos.http.patch(url(noteId), {
      body: { dismissed: true },
      jar: adminJar
    });
  });

  it('dismiss: still dismisses the user\'s own notification', async function() {
    const noteId = await adminNote();

    await apos.notification.dismiss(adminReq, noteId);

    const doc = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(doc.dismissed, true);
  });
});

describe('Notification delivery', function() {
  this.timeout(t.timeout);

  let apos;
  let req;
  let jar;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        // Every poll answers at once instead of waiting for news
        '@apostrophecms/notification': {
          options: {
            longPolling: false
          }
        }
      }
    });
    const admin = await t.createAdmin(apos);
    req = apos.task.getReq({ user: admin });
    jar = await t.loginAs(apos, 'admin');
    await apos.http.get('/', { jar });
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(function() {
    return apos.notification.db.deleteMany({});
  });

  // A browser tab's poll as the notification store makes it: its own
  // cursor, its tab id and the page start, through the real route
  function poller(tabId, { pageStart } = {}) {
    const cursor = {
      at: null,
      ids: []
    };
    const received = [];
    return {
      received,
      async poll() {
        const { notifications, dismissed } = await apos.http.get(
          '/api/v1/@apostrophecms/notification',
          {
            jar,
            qs: {
              ...(tabId && { tabId }),
              ...(pageStart && { pageStart: pageStart.toISOString() }),
              ...(cursor.at && {
                modifiedOnOrSince: cursor.at,
                seenIds: cursor.ids
              })
            }
          }
        );
        for (const { _id, updatedAt } of [ ...notifications, ...dismissed ]) {
          if (!cursor.at || updatedAt > cursor.at) {
            cursor.at = updatedAt;
            cursor.ids = [ _id ];
          } else if (updatedAt === cursor.at && !cursor.ids.includes(_id)) {
            cursor.ids.push(_id);
          }
        }
        received.push(...notifications.map(({ _id }) => _id));
        return {
          notifications: notifications.map(({ _id }) => _id),
          dismissed: dismissed.map(({ _id }) => _id)
        };
      }
    };
  }

  // A stored notification with a chosen modification time
  async function insert(_id, updatedAt, fields = {}) {
    await apos.notification.db.insertOne({
      _id,
      userId: req.user._id,
      message: _id,
      createdAt: updatedAt,
      updatedAt,
      ...fields
    });
  }

  function carrier(name = 'progress') {
    return {
      bus: true,
      event: { name }
    };
  }

  it('delivers records stamped in the same millisecond, each once', async function() {
    const at = new Date(Date.now() - 10000);
    const tab = poller('tab-a');
    await insert('first', at);
    assert.deepEqual((await tab.poll()).notifications, [ 'first' ]);
    // Written after the poll read "first", in the same millisecond
    await insert('second', at);
    await insert('third', at);
    assert.deepEqual((await tab.poll()).notifications.sort(), [ 'second', 'third' ]);
    assert.deepEqual(await tab.poll(), {
      notifications: [],
      dismissed: []
    });
  });

  it('delivers a record seen at the newest time again when it is dismissed or updated', async function() {
    // The regression the move to a strict "after" cursor once fixed:
    // skipping seen ids by id alone hid any later change to them while
    // their time was still the poll's newest
    const at = new Date(Date.now() - 10000);
    const tab = poller('tab-a');
    await insert('progress', at, { job: { _id: 'job1' } });
    await insert('done', at);
    assert.deepEqual((await tab.poll()).notifications.sort(), [ 'done', 'progress' ]);
    await apos.notification.dismiss(req, 'done');
    await apos.notification.db.updateOne(
      { _id: 'progress' },
      {
        $set: {
          job: {
            _id: 'job1',
            processed: 5
          }
        },
        $currentDate: { updatedAt: true }
      }
    );
    assert.deepEqual(await tab.poll(), {
      notifications: [ 'progress' ],
      dismissed: [ 'done' ]
    });
  });

  it('delivers every carrier exactly once while several instances write at once', async function() {
    const others = [
      await t.create({
        root: module,
        shortName: apos.options.shortName
      }),
      await t.create({
        root: module,
        shortName: apos.options.shortName
      })
    ];
    try {
      const tab = poller('tab-a');
      const written = [];
      const state = { writing: true };
      const write = (instance) => instance.notification.trigger(req.user._id, {
        ...carrier(),
        tab: 'every'
      });
      const writers = Promise.all([ apos, ...others ].map(async (instance) => {
        for (let batch = 0; batch < 10; batch++) {
          const notes = await Promise.all([ 0, 1, 2, 3, 4 ].map(() => write(instance)));
          written.push(...notes.map(({ noteId }) => noteId));
        }
      })).finally(() => {
        state.writing = false;
      });
      while (state.writing) {
        await tab.poll();
      }
      await writers;
      await tab.poll();
      assert.equal(written.length, 150);
      assert.equal(new Set(tab.received).size, tab.received.length);
      assert.deepEqual([ ...tab.received ].sort(), [ ...written ].sort());
    } finally {
      for (const instance of others) {
        await instance.destroy();
      }
    }
  });

  it('sends a browser tab what was triggered for it and for every tab, never another tab\'s', async function() {
    const { noteId: forA } = await apos.notify(req, {
      ...carrier(),
      tab: 'tab-a'
    });
    const { noteId: forB } = await apos.notify(req, {
      ...carrier(),
      tab: 'tab-b'
    });
    const { noteId: every } = await apos.notify(req, {
      ...carrier(),
      tab: 'every'
    });
    const { noteId: claimable } = await apos.notify(req, carrier());
    const { noteId: visible } = await apos.notify(req, 'hello');
    // A rendered notification may name its tabs too
    const { noteId: visibleEvery } = await apos.notify(req, 'hello all', { tab: 'every' });
    const { noteId: visibleForA } = await apos.notify(req, 'hello a', { tab: 'tab-a' });
    const everywhere = [ every, claimable, visible, visibleEvery ];
    const received = async (tabId) => (await poller(tabId).poll()).notifications.sort();
    assert.deepEqual(await received('tab-a'), [ ...everywhere, forA, visibleForA ].sort());
    assert.deepEqual(await received('tab-b'), [ ...everywhere, forB ].sort());
    assert.deepEqual(await received(null), [ ...everywhere ].sort());
  });

  it('sends a carrier for every browser tab to each tab once, and nobody claims it', async function() {
    const { noteId } = await apos.notify(req, {
      ...carrier(),
      tab: 'every'
    });
    const a = poller('tab-a');
    const b = poller('tab-b');
    assert.deepEqual((await a.poll()).notifications, [ noteId ]);
    assert.deepEqual((await b.poll()).notifications, [ noteId ]);
    assert.deepEqual((await a.poll()).notifications, []);
    assert.deepEqual((await b.poll()).notifications, []);
    const stored = await apos.notification.db.findOne({ _id: noteId });
    assert.equal(stored.tab, 'every');
    assert.notEqual(stored.event, null);
    assert.equal(stored.dismissed, undefined);
  });

  it('lets one browser tab claim an untargeted carrier while two race for it', async function() {
    const { noteId } = await apos.notify(req, carrier('refresh'));
    const a = poller('tab-a');
    const b = poller('tab-b');
    assert.deepEqual((await a.poll()).notifications, [ noteId ]);
    assert.deepEqual((await b.poll()).notifications, [ noteId ]);
    const clear = () => apos.http.post(
      `/api/v1/@apostrophecms/notification/${noteId}/clear-event`,
      {
        jar,
        body: {}
      }
    );
    const claims = await Promise.all([ clear(), clear() ]);
    assert.deepEqual(claims.sort(), [ false, true ]);
  });

  it('skips the bus carriers created before the page, never other notifications', async function() {
    const pageStart = new Date();
    const before = new Date(pageStart.getTime() - 1000);
    await insert('old-carrier', before, {
      ...carrier(),
      tab: 'every'
    });
    await insert('old-claimable', before, carrier());
    await insert('old-notice', before);
    const { noteId: fresh } = await apos.notify(req, {
      ...carrier(),
      tab: 'every'
    });
    const tab = poller('tab-a', { pageStart });
    assert.deepEqual((await tab.poll()).notifications.sort(), [ fresh, 'old-notice' ].sort());
    // Without a page start, nothing is skipped
    assert.equal((await poller('tab-a').poll()).notifications.length, 4);
  });

  it('refuses a malformed page start', async function() {
    await assert.rejects(
      apos.http.get('/api/v1/@apostrophecms/notification', {
        jar,
        qs: { pageStart: 'soon' }
      }),
      (e) => e.status === 400
    );
  });

  it('expires each kind of carrier on its own, and a poll that slept through it never sees it', async function() {
    const kinds = {
      tab: await apos.notify(req, {
        ...carrier(),
        tab: 'tab-a'
      }),
      every: await apos.notify(req, {
        ...carrier(),
        tab: 'every'
      }),
      claimable: await apos.notify(req, carrier())
    };
    const { carrierExpireAfter, expireAfter } = apos.notification.options;
    for (const [ kind, { noteId } ] of Object.entries(kinds)) {
      const { createdAt, expireAt } = await apos.notification.db.findOne({ _id: noteId });
      const seconds = kind === 'claimable' ? expireAfter : carrierExpireAfter;
      assert.ok(Math.abs(expireAt - createdAt - seconds * 1000) < 1000, kind);
    }
    assert.equal(carrierExpireAfter, 60);
    // Nobody polled until all of them were past their time
    await apos.notification.db.updateMany({}, {
      $set: { expireAt: new Date(Date.now() - 1000) }
    });
    assert.deepEqual(await poller('tab-a').poll(), {
      notifications: [],
      dismissed: []
    });
  });

  it('accepts any tab name and refuses only a value that is none', async function() {
    for (const tab of [ 42, '', [ 'tab-a' ] ]) {
      await assert.rejects(
        apos.notification.trigger(req, {
          ...carrier(),
          tab
        }),
        (e) => {
          assert.equal(e.name, 'invalid');
          assert.match(e.message, /"tab" must be "every" or a browser tab id/);
          return true;
        }
      );
    }
    // A rendered notification keeps the module expiry whatever its tab
    const { noteId } = await apos.notify(req, 'hello a', { tab: 'tab-a' });
    const stored = await apos.notification.db.findOne({ _id: noteId });
    const kept = stored.expireAt - stored.createdAt;
    assert.equal(stored.tab, 'tab-a');
    assert.ok(Math.abs(kept - apos.notification.options.expireAfter * 1000) < 1000);
  });

  it('gives each page its start in the browser data', function() {
    const before = Date.now();
    const { pageStart } = apos.notification.getBrowserData(req);
    assert.ok(pageStart instanceof Date);
    assert.ok(pageStart.getTime() >= before && pageStart.getTime() <= Date.now());
  });
});
