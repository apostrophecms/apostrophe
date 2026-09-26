const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

// Server side of collaborative editing: sequencing and broadcasting patches,
// sequencing text operations, checkpoints, resets, presence and publishing.
// Broadcasts are observed by reading the document's notification channel.

describe('Collaborative editing', function() {
  this.timeout(t.timeout);

  let apos;
  let collab;
  let req;
  let productId;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/collab': {
          options: {
            flushTimeout: 300
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              subtitle: {
                type: 'string'
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        },
        solo: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'solo',
            collaborative: false
          }
        }
      }
    });
    collab = apos.collab;
    const user = await t.createAdmin(apos);
    req = apos.task.getReq({
      user,
      mode: 'draft'
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(async function() {
    await apos.notification.channelDb.deleteMany({});
    await collab.stepsDb.deleteMany({});
    await collab.textDb.deleteMany({});
    await collab.presenceDb.deleteMany({});
    const product = apos.product.newInstance();
    Object.assign(product, {
      title: 'Product',
      subtitle: 'Sub',
      main: {
        _id: 'area1',
        metaType: 'area',
        items: [ richText('w1', 'one'), richText('w2', 'two') ]
      }
    });
    await apos.product.insert(req, product);
    productId = product._id;
  });

  afterEach(async function() {
    await apos.doc.db.deleteMany({ type: 'product' });
  });

  function richText(_id, content) {
    return {
      _id,
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${content}</p>`
    };
  }

  async function getDoc() {
    return apos.doc.db.findOne({ _id: productId });
  }

  async function join(tabId = 'tab1') {
    await apos.doc.lock(req, await getDoc(), tabId);
  }

  async function messages(name) {
    const all = await apos.notification.channelDb.find({
      channel: collab.getChannel(productId)
    }).sort({ seqKey: 1 }).toArray();
    return all
      .map(message => message.event)
      .filter(event => !name || (event.name === name));
  }

  function ids(doc) {
    return doc.main.items.map(item => item._id);
  }

  it('is on for doc types by default, off for users and when opted out', function() {
    assert.equal(collab.isCollaborativeType('product'), true);
    assert.equal(collab.isCollaborativeType('@apostrophecms/home-page'), true);
    assert.equal(collab.isCollaborativeType('@apostrophecms/user'), false);
    assert.equal(collab.isCollaborativeType('solo'), false);
  });

  it('only drafts are collaborative', async function() {
    const doc = await getDoc();
    assert.equal(collab.isCollaborative(doc), true);
    assert.equal(collab.isCollaborative({
      ...doc,
      aposMode: 'published'
    }), false);
  });

  it('lets several tabs hold the lock and tracks who is here', async function() {
    await join('tab1');
    await join('tab2');

    const presence = await collab.getPresence(productId);
    assert.deepEqual(presence.map(({ tabId }) => tabId).sort(), [ 'tab1', 'tab2' ]);

    const events = await messages('collab-presence');
    assert.deepEqual(events.map(({ data }) => [ data.tabId, !!data.joined ]), [
      [ 'tab1', true ],
      [ 'tab2', true ]
    ]);

    await apos.doc.unlock(req, await getDoc(), 'tab1');
    const after = await collab.getPresence(productId);
    assert.deepEqual(after.map(({ tabId }) => tabId), [ 'tab2' ]);
  });

  it('keeps the exclusive lock for non-collaborative types', async function() {
    const solo = apos.solo.newInstance();
    solo.title = 'Solo';
    await apos.solo.insert(req, solo);
    const other = apos.task.getReq({
      user: {
        ...req.user,
        _id: 'someone-else',
        username: 'someone-else'
      }
    });
    await apos.doc.lock(req, solo, 'tab1');
    await assert.rejects(apos.doc.lock(other, solo, 'tab2'), { name: 'locked' });
  });

  it('lets editors subscribe to the channel of a collaborative draft only', async function() {
    assert.equal(await collab.canSubscribe(req, productId), true);
    const guest = apos.task.getAnonReq({ mode: 'draft' });
    assert.equal(await collab.canSubscribe(guest, productId), false);
    assert.equal(await collab.canSubscribe(req, req.user._id), false);
  });

  it('broadcasts patches as stored, sanitized', async function() {
    await join();
    const { doc } = await collab.applyPatches(req, await getDoc(), 'tab1', {
      batchId: 'batch1',
      patches: [
        {
          $push: {
            '@area1.items': {
              $each: [ {
                ...richText('w3', 'three'),
                content: '<p>three<script>alert(1)</script></p>'
              } ],
              $before: 'w2'
            }
          }
        }
      ],
      targets: [ { widgetId: 'w3' } ]
    });

    assert.deepEqual(ids(doc), [ 'w1', 'w3', 'w2' ]);
    const [ event ] = await messages('collab-patches');
    assert.equal(event.data.batchId, 'batch1');
    assert.equal(event.data.tabId, 'tab1');
    const push = event.data.patches[0].$push['@area1.items'];
    assert.equal(push.$before, 'w2');
    assert.equal(push.$each[0]._id, 'w3');
    assert.doesNotMatch(push.$each[0].content, /script/);
    assert.deepEqual(event.data.targets, [ { widgetId: 'w3' } ]);
  });

  it('broadcasts nothing when nobody is editing', async function() {
    await collab.applyPatches(req, await getDoc(), 'tab1', {
      patches: [ { subtitle: 'Changed' } ]
    });
    assert.deepEqual(await messages(), []);
  });

  it('skips a patch aimed at a widget that is gone, and applies the rest', async function() {
    await join();
    const { doc } = await collab.applyPatches(req, await getDoc(), 'tab1', {
      patches: [
        {
          $move: {
            '@area1.items': {
              $item: 'w1',
              $after: 'w2'
            }
          }
        },
        { '@gone.content': '<p>lost</p>' },
        {
          $move: {
            '@gone.items': {
              $item: 'x'
            }
          }
        },
        { subtitle: 'Changed' }
      ]
    });

    assert.deepEqual(ids(doc), [ 'w2', 'w1' ]);
    assert.equal(doc.subtitle, 'Changed');
    const [ event ] = await messages('collab-patches');
    assert.equal(event.data.patches.length, 2);
  });

  it('does not push a widget that is already there', async function() {
    await join();
    const { doc } = await collab.applyPatches(req, await getDoc(), 'tab1', {
      patches: [
        {
          $push: {
            '@area1.items': {
              $each: [ richText('w1', 'again'), richText('w4', 'four') ]
            }
          }
        }
      ]
    });

    assert.deepEqual(ids(doc), [ 'w1', 'w2', 'w4' ]);
    assert.equal(doc.main.items[0].content, '<p>one</p>');
  });

  it('reports a refused patch rather than failing the request', async function() {
    await join();
    const result = await collab.applyPatches(req, await getDoc(), 'tab1', {
      patches: [
        { subtitle: 'Not saved' },
        {
          // Not an array
          $push: {
            '@w1.content': {
              $each: [ { _id: 'x' } ]
            }
          }
        }
      ]
    });
    assert.equal(result.patchError.name, 'invalid');
    assert.equal((await getDoc()).subtitle, 'Sub');
    assert.deepEqual(await messages('collab-patches'), []);
  });

  describe('text', function() {
    const key = '@w1.content';

    function steps(n) {
      return Array.from({ length: n }, (v, i) => ({
        stepType: 'replace',
        from: 1,
        to: 1,
        n: i
      }));
    }

    it('sequences operations, refusing a stale version with what was missed', async function() {
      await join();
      const [ first ] = await collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: steps(2),
          clientId: 'a'
        }
      ]);
      assert.equal(first.accepted, true);

      const [ stale ] = await collab.applyText(req, productId, 'tab2', [
        {
          key,
          version: 0,
          steps: steps(1),
          clientId: 'b'
        }
      ]);
      assert.equal(stale.accepted, false);
      assert.deepEqual(stale.batches.map(({
        start, count, clientId
      }) => [ start, count, clientId ]), [
        [ 1, 2, 'a' ]
      ]);

      const [ rebased ] = await collab.applyText(req, productId, 'tab2', [
        {
          key,
          version: 2,
          steps: steps(1),
          clientId: 'b'
        }
      ]);
      assert.equal(rebased.accepted, true);

      const events = await messages('collab-text');
      const batches = events.map(({ data }) => [ data.batch.start, data.batch.clientId ]);
      assert.deepEqual(batches, [
        [ 1, 'a' ],
        [ 3, 'b' ]
      ]);
    });

    it('lets only one of two concurrent batches at the same version through', async function() {
      const results = await Promise.all([ 'a', 'b', 'c', 'd' ].map(clientId => {
        return collab.applyText(req, productId, clientId, [
          {
            key,
            version: 0,
            steps: steps(1),
            clientId
          }
        ]);
      }));
      assert.equal(results.flat().filter(({ accepted }) => accepted).length, 1);
    });

    it('refuses malformed text operations', async function() {
      await assert.rejects(collab.applyText(req, productId, 'tab1', [
        {
          key: '__proto__.x',
          version: 0,
          steps: steps(1)
        }
      ]), { name: 'invalid' });
      await assert.rejects(collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: []
        }
      ]), { name: 'invalid' });
    });

    it('saves a checkpoint only if it is newer and was sequenced', async function() {
      await collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: steps(3),
          clientId: 'a'
        }
      ]);
      const doc = await getDoc();
      const pmDoc = {
        type: 'doc',
        content: []
      };

      const [ tooNew ] = await collab.applyCheckpoints(req, doc, 'tab1', [
        {
          key,
          version: 4,
          value: '<p>future</p>'
        }
      ]);
      assert.equal(tooNew.accepted, false);

      const [ saved ] = await collab.applyCheckpoints(req, doc, 'tab1', [
        {
          key,
          version: 3,
          value: '<p>typed</p>',
          doc: pmDoc
        }
      ]);
      assert.equal(saved.accepted, true);
      assert.equal((await getDoc()).main.items[0].content, '<p>typed</p>');

      const [ stale ] = await collab.applyCheckpoints(req, doc, 'tab1', [
        {
          key,
          version: 2,
          value: '<p>older</p>'
        }
      ]);
      assert.equal(stale.accepted, false);
      assert.equal((await getDoc()).main.items[0].content, '<p>typed</p>');

      const state = await collab.getTextState(productId, key);
      assert.equal(state.version, 3);
      assert.deepEqual(state.doc, pmDoc);
      assert.deepEqual(state.batches, []);
    });

    it('a checkpoint is not broadcast as a patch', async function() {
      await join();
      await collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: steps(1),
          clientId: 'a'
        }
      ]);
      await collab.applyCheckpoints(req, await getDoc(), 'tab1', [
        {
          key,
          version: 1,
          value: '<p>typed</p>'
        }
      ]);
      assert.deepEqual(await messages('collab-patches'), []);
      assert.deepEqual(await messages('collab-refresh'), []);
    });

    it('starts a key nobody has typed in from the value in the document', async function() {
      const state = await collab.getTextState(productId, '@w2.content');
      assert.equal(state.version, 0);
      assert.equal(state.value, '<p>two</p>');
      assert.equal(state.doc, null);
    });

    it('sends only what was missed when asked for operations after a version', async function() {
      for (const version of [ 0, 1, 2 ]) {
        await collab.applyText(req, productId, 'tab1', [
          {
            key,
            version,
            steps: steps(1),
            clientId: 'a'
          }
        ]);
      }
      const state = await collab.getTextState(productId, key, 1);
      assert.equal(state.version, undefined);
      assert.deepEqual(state.batches.map(({ start }) => start), [ 2, 3 ]);
    });

    it('resets the text when a patch replaces the widget holding it', async function() {
      await join();
      await collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: steps(2),
          clientId: 'a'
        }
      ]);
      await collab.applyPatches(req, await getDoc(), 'tab2', {
        patches: [ { '@w1': richText('w1', 'replaced') } ]
      });

      const events = await messages('collab-text');
      const reset = events.at(-1).data.batch;
      assert.equal(reset.reset, true);
      assert.equal(reset.start, 3);
      assert.equal(reset.value, '<p>replaced</p>');
      const state = await collab.getTextState(productId, key);
      assert.equal(state.version, 3);
      assert.equal(state.value, '<p>replaced</p>');
    });

    it('does not reset text that a patch did not touch', async function() {
      await join();
      await collab.applyText(req, productId, 'tab1', [
        {
          key,
          version: 0,
          steps: steps(2),
          clientId: 'a'
        }
      ]);
      await collab.applyPatches(req, await getDoc(), 'tab2', {
        patches: [ { '@w2.content': '<p>other</p>' }, { subtitle: 'x' } ]
      });
      const events = await messages('collab-text');
      assert.equal(events.length, 1);
    });
  });

  it('announces other changes to the draft so editors render it again', async function() {
    await join();
    const doc = await apos.product.findOneForEditing(req, { _id: productId });
    doc.subtitle = 'Saved the old way';
    await apos.product.update(req, doc);
    const events = await messages('collab-refresh');
    assert.equal(events.length, 1);
  });

  it('asks editors to save their typing before publishing, and gives up in time', async function() {
    await join();
    await collab.applyText(req, productId, 'tab1', [
      {
        key: '@w1.content',
        version: 0,
        steps: [ { stepType: 'replace' } ],
        clientId: 'a'
      }
    ]);
    const draft = await apos.product.findOneForEditing(req, { _id: productId });
    const start = Date.now();
    await apos.product.publish(req, draft);
    assert.ok(Date.now() - start < 2000);
    assert.equal((await messages('collab-flush')).length, 1);
  });

  it('publishes typing checkpointed during the flush', async function() {
    await join();
    const key = '@w1.content';
    await collab.applyText(req, productId, 'tab1', [
      {
        key,
        version: 0,
        steps: [ { stepType: 'replace' } ],
        clientId: 'a'
      }
    ]);
    // Play the part of the browser that typed it
    const superBroadcast = collab.broadcast;
    collab.broadcast = async (req, docId, name, data, options) => {
      await superBroadcast(req, docId, name, data, options);
      if (name === 'collab-flush') {
        setTimeout(() => {
          collab.applyCheckpoints(req, doc, 'tab1', [
            {
              key,
              version: 1,
              value: '<p>last words</p>'
            }
          ]);
        }, 20);
      }
    };
    const doc = await getDoc();
    try {
      const draft = await apos.product.findOneForEditing(req, { _id: productId });
      await apos.product.publish(req, draft);
    } finally {
      collab.broadcast = superBroadcast;
    }
    const published = await apos.doc.db.findOne({
      _id: productId.replace(':draft', ':published')
    });
    assert.equal(published.main.items[0].content, '<p>last words</p>');
  });

  it('applies what diffToPatch makes of a modal\'s edits, keeping others\' changes', async function() {
    const diffToPatch = (await import(
      '../modules/@apostrophecms/schema/ui/apos/lib/diff-to-patch.js'
    )).default;
    const getWidgetSchema = type => apos.area.getWidgetManager(type).schema;
    // The modal opened with this
    const before = await apos.product.findOneForEditing(req, { _id: productId });
    const after = structuredClone(before);
    after.subtitle = 'From the modal';
    after.main.items = [
      after.main.items[1],
      {
        ...richText('w3', 'added in the modal'),
        metaType: 'widget'
      }
    ];
    const patches = diffToPatch(apos.product.schema, before, after, { getWidgetSchema });
    // Meanwhile, someone else changed the title and the first widget's text
    await join();
    await collab.applyPatches(req, await getDoc(), 'tab2', {
      patches: [ { title: 'Theirs' }, { '@w2.content': '<p>two, theirs</p>' } ]
    });

    const { doc } = await collab.applyPatches(req, await getDoc(), 'tab1', {
      patches
    });
    assert.deepEqual(ids(doc), [ 'w2', 'w3' ]);
    assert.equal(doc.subtitle, 'From the modal');
    assert.equal(doc.title, 'Theirs');
    assert.equal(doc.main.items[0].content, '<p>two, theirs</p>');
    assert.equal(doc.main.items[1].content, '<p>added in the modal</p>');
  });

  it('forgets who stopped refreshing their lock', async function() {
    await join('tab1');
    await collab.presenceDb.updateOne({ _id: `${productId}|tab1` }, {
      $set: { updatedAt: new Date(Date.now() - 60000) }
    });
    await join('tab2');
    const presence = await collab.getPresence(productId);
    assert.deepEqual(presence.map(({ tabId }) => tabId), [ 'tab2' ]);
    const left = (await messages('collab-presence')).filter(({ data }) => data.left);
    assert.deepEqual(left.map(({ data }) => data.tabId), [ 'tab1' ]);
  });
});

// Every deployment that matters runs several processes on one database, and
// the database is the only thing they share. Two processes of one site here,
// `a` and `b`
describe('Collaborative editing across processes', function() {
  this.timeout(t.timeout);

  let a;
  let b;
  let reqA;
  let reqB;
  let productId;

  before(async function() {
    const options = {
      root: module,
      shortName: `test-collab-processes-${Date.now()}`,
      modules: {
        '@apostrophecms/notification': {
          options: {
            channelQueryInterval: 100,
            longPollingTimeout: 1500
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        }
      }
    };
    a = await t.create(options);
    b = await t.create(options);
    const user = await t.createAdmin(a);
    reqA = a.task.getReq({
      user,
      mode: 'draft'
    });
    reqB = b.task.getReq({
      user,
      mode: 'draft'
    });
    const product = a.product.newInstance();
    Object.assign(product, {
      title: 'Product',
      main: {
        _id: 'area1',
        metaType: 'area',
        items: [
          {
            _id: 'w1',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: '<p>one</p>'
          }
        ]
      }
    });
    await a.product.insert(reqA, product);
    productId = product._id;
  });

  after(async function() {
    await b.destroy();
    await t.destroy(a);
  });

  function poll(apos, req, channels) {
    const pollReq = apos.task.getReq({
      user: req.user,
      mode: 'draft'
    });
    pollReq.query = {
      channels: JSON.stringify(channels)
    };
    return apos.notification.restApiRoutes.getAll.route(pollReq);
  }

  it('broadcasts a patch made in one process to an editor who joined in the other', async function() {
    // The editor joined through `a`...
    await a.doc.lock(reqA, await a.doc.db.findOne({ _id: productId }), 'tabA');
    const channel = a.collab.getChannel(productId);
    // Subscribe from now on, as the browser does
    const { channelCursors } = await poll(a, reqA, { [channel]: null });
    const pending = poll(a, reqA, { [channel]: channelCursors[channel] });
    // ...and someone else patches through `b`
    await b.collab.applyPatches(reqB, await b.doc.db.findOne({ _id: productId }), 'tabB', {
      batchId: 'batch1',
      patches: [ { title: 'Changed in b' } ]
    });
    const result = await pending;
    const events = result.channelMessages.map(({ event }) => event);
    const patchEvent = events.find(({ name }) => name === 'collab-patches');
    assert.equal(patchEvent.data.batchId, 'batch1');
    assert.equal(patchEvent.data.patches[0].title, 'Changed in b');
  });

  it('lets exactly one of two processes sequence text at the same version', async function() {
    const key = '@w1.content';
    const results = await Promise.all([ a, b, a, b ].map((apos, i) => {
      return apos.collab.applyText(i % 2 ? reqB : reqA, productId, `tab${i}`, [
        {
          key,
          version: 0,
          steps: [ { stepType: 'replace' } ],
          clientId: `client${i}`
        }
      ]);
    }));
    assert.equal(results.flat().filter(({ accepted }) => accepted).length, 1);
    const { head } = await b.collab.getHead(productId, key);
    assert.equal(head, 1);
  });

  it('accepts a checkpoint in one process for text sequenced in the other', async function() {
    const key = '@w1.content';
    const { head } = await a.collab.getHead(productId, key);
    const [ saved ] = await b.collab.applyCheckpoints(
      reqB,
      await b.doc.db.findOne({ _id: productId }),
      'tabB',
      [
        {
          key,
          version: head,
          value: '<p>typed</p>'
        }
      ]
    );
    assert.equal(saved.accepted, true);
    const state = await a.collab.getTextState(productId, key);
    assert.equal(state.version, head);
  });

  it('knows who is here whichever process they joined through', async function() {
    await b.doc.lock(reqB, await b.doc.db.findOne({ _id: productId }), 'tabB');
    const presence = await a.collab.getPresence(productId);
    assert.deepEqual(presence.map(({ tabId }) => tabId).sort(), [ 'tabA', 'tabB' ]);
    assert.equal(await b.collab.hasPresence(productId), true);
  });

  it('takes a change of permissions into account at once, in every process', async function() {
    const contributor = await t.createUser(a, 'guest', {
      username: 'guest-collab',
      password: 'guest-collab-pass'
    });
    const guestReq = b.task.getReq({
      user: contributor,
      mode: 'draft'
    });
    assert.equal(await b.collab.canSubscribe(reqB, productId), true);
    assert.equal(await b.collab.canSubscribe(guestReq, productId), false);
    // Make the product non-collaborative behind b's back, in the database
    await a.doc.db.updateOne({ _id: productId }, { $set: { type: 'nope' } });
    try {
      assert.equal(await b.collab.canSubscribe(reqB, productId), false);
    } finally {
      await a.doc.db.updateOne({ _id: productId }, { $set: { type: 'product' } });
    }
  });
});
