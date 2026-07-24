const t = require('../test-lib/test.js');
const assert = require('assert/strict');

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
