// The browser side of collaborative editing, simulated without a browser:
// several clients, each with its own `CollabSession`, edit the same text and
// the same area at random, talking to a stand-in for the server over
// connections with random delays. However the messages interleave, everyone
// must end up with the same content.
//
// The stand-in follows the rules of `@apostrophecms/collab`: text operations
// are accepted only at the latest version, patches are applied in the order
// they arrive, skipping those aimed at widgets that are gone, and everything
// accepted is broadcast to everyone, in order.

const assert = require('node:assert/strict');

const load = async () => ({
  CollabSession: (await import('../modules/@apostrophecms/collab/ui/apos/lib/session.js')).default,
  TextSync: (await import('../modules/@apostrophecms/collab/ui/apos/lib/text-sync.js')).default,
  StringModel: (await import('../modules/@apostrophecms/collab/ui/apos/lib/string-model.js')).default,
  applyPatch: (await import('../modules/@apostrophecms/area/ui/apos/lib/apply-patch.js')).default,
  invert: (await import('../modules/@apostrophecms/area/ui/apos/lib/apply-patch.js')).invert
});

// A deterministic random number generator, so a failure can be reproduced
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Bus {
  constructor() {
    this.handlers = {};
  }

  $on(name, fn) {
    (this.handlers[name] = this.handlers[name] || []).push(fn);
  }

  $off(name, fn) {
    this.handlers[name] = (this.handlers[name] || []).filter(h => h !== fn);
  }

  $emit(name, ...args) {
    for (const fn of [ ...(this.handlers[name] || []) ]) {
      fn(...args);
    }
  }
}

class Server {
  constructor({ applyPatch, items }) {
    this.applyPatch = applyPatch;
    this.items = items;
    this.log = [];
    this.text = new Map();
    this.checkpoints = new Map();
    this.listeners = new Set();
  }

  broadcast(name, data) {
    const seq = this.log.length + 1;
    this.log.push({
      name,
      data,
      seq
    });
    for (const listener of this.listeners) {
      listener();
    }
    return seq;
  }

  key(key) {
    if (!this.text.has(key)) {
      this.text.set(key, []);
    }
    return this.text.get(key);
  }

  head(key) {
    const batches = this.key(key);
    const last = batches.at(-1);
    return last ? last.start + last.count - 1 : 0;
  }

  since(key, after) {
    return this.key(key).filter(batch => batch.start > after);
  }

  refersToSomething(patch) {
    const present = id => this.items.some(item => item._id === id);
    for (const operator of [ '$move', '$pullAllById' ]) {
      if (patch[operator]) {
        return true;
      }
    }
    for (const key of Object.keys(patch)) {
      if (key.startsWith('@') && !key.startsWith('@area.')) {
        return present(key.substring(1).split('.')[0]);
      }
    }
    return true;
  }

  ops(body) {
    const result = {};
    if (body.patches) {
      const applied = [];
      for (const patch of body.patches) {
        if (!this.refersToSomething(patch)) {
          continue;
        }
        const outcome = this.applyPatch('area', this.items, patch);
        if (outcome) {
          this.items = outcome.items;
        }
        applied.push(patch);
      }
      result.doc = {};
      result.seq = this.broadcast('collab-patches', {
        docId: 'doc',
        tabId: body.tabId,
        batchId: body.batchId,
        patches: applied
      });
    }
    if (body.text) {
      result.text = body.text.map(item => {
        if (item.version !== this.head(item.key)) {
          return {
            key: item.key,
            accepted: false,
            batches: this.since(item.key, item.version)
          };
        }
        const batch = {
          key: item.key,
          start: item.version + 1,
          count: item.steps.length,
          steps: item.steps,
          clientId: item.clientId,
          userId: body.tabId,
          title: body.tabId
        };
        this.key(item.key).push(batch);
        this.broadcast('collab-text', {
          docId: 'doc',
          tabId: body.tabId,
          batch
        });
        return {
          key: item.key,
          accepted: true
        };
      });
    }
    if (body.checkpoints) {
      result.checkpoints = body.checkpoints.map(checkpoint => {
        const current = this.checkpoints.get(checkpoint.key);
        const accepted = (checkpoint.version > (current?.version || 0)) &&
          (checkpoint.version <= this.head(checkpoint.key));
        if (accepted) {
          this.checkpoints.set(checkpoint.key, checkpoint);
        }
        return {
          key: checkpoint.key,
          accepted
        };
      });
    }
    return result;
  }

  textState(qs) {
    const keys = JSON.parse(qs.keys);
    const result = {};
    for (const key of keys) {
      const after = qs[`after:${key}`];
      if (after !== undefined) {
        result[key] = { batches: this.since(key, after) };
        continue;
      }
      result[key] = {
        version: 0,
        doc: null,
        value: '',
        batches: this.since(key, 0)
      };
    }
    return { keys: result };
  }
}

// One simulated browser tab
function createClient({
  name, server, modules, rand, items
}) {
  const bus = new Bus();
  const client = {
    name,
    items: structuredClone(items),
    bus,
    cursor: 0,
    delivering: false
  };
  const delay = () => sleep(Math.floor(rand() * 8));
  const http = {
    async post(url, { body }) {
      await delay();
      const result = server.ops(structuredClone(body));
      await delay();
      return structuredClone(result);
    },
    async get(url, { qs }) {
      await delay();
      const result = server.textState(qs);
      await delay();
      return structuredClone(result);
    }
  };
  // The channel: delivers everything the server broadcast, in order, late
  async function deliver() {
    if (client.delivering) {
      return;
    }
    client.delivering = true;
    while (client.cursor < server.log.length) {
      await delay();
      const {
        name, data, seq
      } = server.log[client.cursor++];
      bus.$emit(name, structuredClone(data), {
        channel: 'collab:doc',
        seq
      });
    }
    client.delivering = false;
  }
  server.listeners.add(deliver);
  client.deliver = deliver;
  client.applyToPage = patch => {
    const inverses = modules.invert('area', client.items, patch);
    const outcome = modules.applyPatch('area', client.items, patch);
    if (!outcome) {
      return {
        claimed: false,
        inverses: []
      };
    }
    client.items = outcome.items;
    return {
      claimed: true,
      inverses
    };
  };
  client.session = new modules.CollabSession({
    docId: 'doc',
    tabId: name,
    action: '/api/v1/@apostrophecms/collab',
    http,
    bus,
    channels: {
      subscribe: async () => {
        client.cursor = server.log.length;
      },
      unsubscribe: () => {}
    },
    applyToPage: client.applyToPage,
    retryDelay: 10
  });
  return client;
}

async function settle(server, clients) {
  for (let i = 0; i < 1000; i++) {
    await sleep(20);
    const busy = clients.some(client => {
      return client.session.pumping ||
        client.delivering ||
        (client.cursor < server.log.length) ||
        client.session.hasPending();
    });
    if (!busy) {
      return;
    }
  }
  throw new Error('Never settled');
}

describe('Collaborative editing in the browser', function() {
  this.timeout(60000);

  let modules;

  before(async function() {
    modules = await load();
  });

  function widget(id) {
    return {
      _id: id,
      type: 'x'
    };
  }

  for (const seed of Array.from({ length: 25 }, (v, i) => i + 1)) {
    it(`converges on the same area whatever order patches arrive in (seed ${seed})`, async function() {
      const rand = random(seed);
      const initial = [ widget('a'), widget('b'), widget('c') ];
      const server = new Server({
        applyPatch: modules.applyPatch,
        items: structuredClone(initial)
      });
      const clients = [ 'one', 'two', 'three' ].map(name => createClient({
        name,
        server,
        modules,
        rand,
        items: initial
      }));
      for (const client of clients) {
        await client.session.start();
      }
      let next = 1;
      for (let round = 0; round < 60; round++) {
        const client = clients[Math.floor(rand() * clients.length)];
        const items = client.items;
        const choice = rand();
        const key = '@area.items';
        if ((choice < 0.4) || (items.length < 2)) {
          const added = widget(`${client.name}-${next++}`);
          const index = Math.floor(rand() * (items.length + 1));
          const push = { $each: [ added ] };
          if (index < items.length) {
            push.$before = items[index]._id;
          }
          const patch = { $push: { [key]: push } };
          const inverse = { $pullAllById: { [key]: [ added._id ] } };
          client.applyToPage(patch);
          client.session.queuePatch(patch, { inverse });
        } else if (choice < 0.7) {
          const index = Math.floor(rand() * items.length);
          const removed = items[index];
          const push = { $each: [ removed ] };
          if (items[index + 1]) {
            push.$before = items[index + 1]._id;
          }
          const patch = { $pullAllById: { [key]: [ removed._id ] } };
          const inverse = { $push: { [key]: push } };
          client.applyToPage(patch);
          client.session.queuePatch(patch, { inverse });
        } else {
          const index = Math.floor(rand() * (items.length - 1));
          const $item = items[index]._id;
          const neighbor = items[index + 1]._id;
          const patch = {
            $move: {
              [key]: {
                $item,
                $after: neighbor
              }
            }
          };
          const inverse = {
            $move: {
              [key]: {
                $item,
                $before: neighbor
              }
            }
          };
          client.applyToPage(patch);
          client.session.queuePatch(patch, { inverse });
        }
        await sleep(Math.floor(rand() * 5));
      }
      await settle(server, clients);
      const expected = server.items.map(item => item._id);
      for (const client of clients) {
        assert.deepEqual(client.items.map(item => item._id), expected, client.name);
        client.session.stop();
      }
    });
  }

  for (const seed of Array.from({ length: 10 }, (v, i) => i + 101)) {
    it(`converges on the same text whatever order steps arrive in (seed ${seed})`, async function() {
      const rand = random(seed);
      const server = new Server({
        applyPatch: modules.applyPatch,
        items: []
      });
      const clients = [ 'one', 'two', 'three' ].map(name => createClient({
        name,
        server,
        modules,
        rand,
        items: []
      }));
      const models = new Map();
      for (const client of clients) {
        await client.session.start();
        const model = new modules.StringModel({ value: '' });
        const sync = new modules.TextSync({
          key: 'title',
          session: client.session,
          host: {
            getState: () => model.getState(),
            dispatch: tr => model.dispatch(tr),
            registerPlugin: plugin => model.registerPlugin(plugin),
            unregisterPlugin: key => model.unregisterPlugin(key),
            setContent: content => model.setContent(content),
            getValue: () => model.getValue()
          },
          checkpointDelay: 5
        });
        models.set(client, {
          model,
          sync
        });
      }
      await settle(server, clients);
      for (let round = 0; round < 150; round++) {
        const client = clients[Math.floor(rand() * clients.length)];
        const { model, sync } = models.get(client);
        const value = model.value;
        let next;
        if ((rand() < 0.7) || !value.length) {
          const at = Math.floor(rand() * (value.length + 1));
          const text = client.name[0].repeat(1 + Math.floor(rand() * 3));
          next = value.slice(0, at) + text + value.slice(at);
        } else {
          const from = Math.floor(rand() * value.length);
          const to = Math.min(value.length, from + 1 + Math.floor(rand() * 3));
          next = value.slice(0, from) + value.slice(to);
        }
        model.setValue(next);
        sync.localChanged();
        await sleep(Math.floor(rand() * 4));
      }
      await settle(server, clients);
      const values = clients.map(client => models.get(client).model.value);
      for (const value of values) {
        assert.equal(value, values[0]);
      }
      assert.ok(values[0].length > 0);
      for (const client of clients) {
        assert.equal(models.get(client).sync.version, server.head('title'));
      }
      // Someone saved the text as it ended up
      await sleep(50);
      await settle(server, clients);
      const saved = server.checkpoints.get('title');
      assert.equal(saved?.value, values[0]);
      for (const client of clients) {
        client.session.stop();
      }
    });
  }

  it('undoes only its own typing, and keeps everyone else\'s', async function() {
    const rand = random(99);
    const server = new Server({
      applyPatch: modules.applyPatch,
      items: []
    });
    const [ alice, bob ] = [ 'alice', 'bob' ].map(name => createClient({
      name,
      server,
      modules,
      rand,
      items: []
    }));
    const pairs = [];
    for (const client of [ alice, bob ]) {
      await client.session.start();
      const model = new modules.StringModel({ value: '' });
      const sync = new modules.TextSync({
        key: 'title',
        session: client.session,
        host: {
          getState: () => model.getState(),
          dispatch: tr => model.dispatch(tr),
          registerPlugin: plugin => model.registerPlugin(plugin),
          unregisterPlugin: key => model.unregisterPlugin(key),
          setContent: content => model.setContent(content),
          getValue: () => model.getValue()
        }
      });
      pairs.push({
        model,
        sync
      });
    }
    await settle(server, [ alice, bob ]);
    const [ a, b ] = pairs;
    a.model.setValue('world');
    a.sync.localChanged();
    await settle(server, [ alice, bob ]);
    b.model.setValue('hello world');
    b.sync.localChanged();
    await settle(server, [ alice, bob ]);
    assert.equal(a.model.value, 'hello world');

    a.model.undo();
    a.sync.localChanged();
    await settle(server, [ alice, bob ]);
    assert.equal(a.model.value, 'hello ');
    assert.equal(b.model.value, 'hello ');

    a.model.redo();
    a.sync.localChanged();
    await settle(server, [ alice, bob ]);
    assert.equal(b.model.value, 'hello world');
    alice.session.stop();
    bob.session.stop();
  });

  it('starts over when someone replaces the whole value', async function() {
    const rand = random(7);
    const server = new Server({
      applyPatch: modules.applyPatch,
      items: []
    });
    const client = createClient({
      name: 'one',
      server,
      modules,
      rand,
      items: []
    });
    await client.session.start();
    const model = new modules.StringModel({ value: '' });
    const sync = new modules.TextSync({
      key: 'title',
      session: client.session,
      host: {
        getState: () => model.getState(),
        dispatch: tr => model.dispatch(tr),
        registerPlugin: plugin => model.registerPlugin(plugin),
        unregisterPlugin: key => model.unregisterPlugin(key),
        setContent: content => model.setContent(content),
        getValue: () => model.getValue()
      }
    });
    await settle(server, [ client ]);
    model.setValue('typed');
    sync.localChanged();
    await settle(server, [ client ]);
    const start = server.head('title') + 1;
    server.key('title').push({
      key: 'title',
      start,
      count: 1,
      reset: true,
      value: 'Replaced'
    });
    server.broadcast('collab-text', {
      docId: 'doc',
      tabId: 'someone',
      batch: server.key('title').at(-1)
    });
    await settle(server, [ client ]);
    assert.equal(model.value, 'Replaced');
    assert.equal(sync.version, start);
    model.setValue('Replaced!');
    sync.localChanged();
    await settle(server, [ client ]);
    assert.equal(server.head('title'), start + 1);
    client.session.stop();
  });
});

describe('diffToPatch', function() {
  let diffToPatch;
  let diffWidget;
  let applyPatch;

  before(async function() {
    const module = await import('../modules/@apostrophecms/schema/ui/apos/lib/diff-to-patch.js');
    diffToPatch = module.default;
    diffWidget = module.diffWidget;
    applyPatch = (await import('../modules/@apostrophecms/area/ui/apos/lib/apply-patch.js')).default;
  });

  const widgetSchemas = {
    text: [
      {
        name: 'content',
        type: 'string'
      },
      {
        name: 'size',
        type: 'select'
      }
    ]
  };
  const getWidgetSchema = type => widgetSchemas[type];
  const schema = [
    {
      name: 'title',
      type: 'string'
    },
    {
      name: 'main',
      type: 'area'
    },
    {
      name: 'meta',
      type: 'object',
      schema: [
        {
          name: 'keywords',
          type: 'string'
        },
        {
          name: 'robots',
          type: 'string'
        }
      ]
    },
    {
      name: 'links',
      type: 'array',
      schema: [
        {
          name: 'url',
          type: 'string'
        }
      ]
    }
  ];

  function text(_id, content) {
    return {
      _id,
      type: 'text',
      metaType: 'widget',
      content
    };
  }

  function doc(items, extra = {}) {
    return {
      title: 'Title',
      main: {
        _id: 'area',
        metaType: 'area',
        items
      },
      meta: {
        keywords: 'a',
        robots: 'index'
      },
      links: [
        {
          _id: 'l1',
          url: '/one'
        },
        {
          _id: 'l2',
          url: '/two'
        }
      ],
      ...extra
    };
  }

  // Apply patches to the area the way the browser and server do
  function applyToArea(items, patches) {
    for (const patch of patches) {
      const result = applyPatch('area', items, patch);
      if (result) {
        items = result.items;
      }
    }
    return items;
  }

  it('sends nothing when nothing changed', function() {
    const before = doc([ text('a', 'A') ]);
    const patches = diffToPatch(schema, before, structuredClone(before), {
      getWidgetSchema
    });
    assert.deepEqual(patches, []);
  });

  it('sets changed fields one by one, including those of objects', function() {
    const before = doc([]);
    const after = structuredClone(before);
    after.title = 'New title';
    after.meta.robots = 'noindex';
    assert.deepEqual(diffToPatch(schema, before, after, { getWidgetSchema }), [
      { title: 'New title' },
      { 'meta.robots': 'noindex' }
    ]);
  });

  it('changes an area widget by widget, which survives edits made elsewhere in it', function() {
    const before = doc([ text('a', 'A'), text('b', 'B'), text('c', 'C'), text('d', 'D') ]);
    const after = doc([
      text('d', 'D'),
      text('a', 'A changed'),
      text('new', 'New'),
      text('c', 'C')
    ]);
    const patches = diffToPatch(schema, before, after, { getWidgetSchema });
    const ids = items => items.map(item => item._id);

    const result = applyToArea(before.main.items, patches);
    assert.deepEqual(ids(result), ids(after.main.items));
    assert.equal(result.find(item => item._id === 'a').content, 'A changed');

    // Meanwhile someone else added a widget after c and changed d
    const concurrent = [
      text('a', 'A'),
      text('b', 'B'),
      text('c', 'C'),
      text('theirs', 'Theirs'),
      text('d', 'D, theirs')
    ];
    const merged = applyToArea(concurrent, patches);
    assert.deepEqual(ids(merged), [ 'd', 'a', 'new', 'c', 'theirs' ]);
    assert.equal(merged.find(item => item._id === 'd').content, 'D, theirs');
    // Only fields that changed are sent, never whole widgets
    assert.ok(!patches.some(patch => Object.keys(patch).includes('@d')));
  });

  it('changes an array item by item', function() {
    const before = doc([]);
    const after = structuredClone(before);
    after.links = [
      {
        _id: 'l2',
        url: '/two, changed'
      },
      {
        _id: 'l3',
        url: '/three'
      }
    ];
    const patches = diffToPatch(schema, before, after, { getWidgetSchema });
    assert.deepEqual(patches, [
      { $pullAllById: { links: [ 'l1' ] } },
      {
        $push: {
          links: {
            $each: [ after.links[1] ],
            $after: 'l2'
          }
        }
      },
      { '@l2.url': '/two, changed' }
    ]);
  });

  it('can set a changed area whole instead', function() {
    const before = doc([ text('a', 'A') ]);
    const after = doc([ text('a', 'A'), text('b', 'B') ]);
    const patches = diffToPatch(schema, before, after, {
      getWidgetSchema,
      areas: 'replace'
    });
    assert.deepEqual(patches, [ { main: after.main } ]);
  });

  it('never sends the marker a modal\'s live preview leaves on a widget', function() {
    const before = text('a', 'A');
    const after = {
      ...text('a', 'A changed'),
      aposLivePreview: true
    };
    assert.deepEqual(diffWidget(before, after, { getWidgetSchema }), [
      { '@a.content': 'A changed' }
    ]);
  });

  it('diffs one widget, field by field', function() {
    const before = text('a', 'A');
    const after = {
      ...text('a', 'A'),
      size: 'large',
      aposPlaceholder: false
    };
    assert.deepEqual(diffWidget(before, after, { getWidgetSchema }), [
      { '@a.size': 'large' },
      { '@a.aposPlaceholder': false }
    ]);
  });
});
