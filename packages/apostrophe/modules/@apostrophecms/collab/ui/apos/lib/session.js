// One browser tab's part in editing a document together with others.
//
// Everything this tab has to tell the server goes through one queue, with
// one request in flight at a time: whatever piles up while a request is out
// goes in the next one, so the batches grow with the round trip time instead
// of anything being timed. What others do arrives on the document's
// notification channel, which rides the notification long poll.
//
// Patches (areas, widgets, fields) are applied to the page at once, and sent.
// The server puts everyone's in order and broadcasts them, ours included. A
// patch from someone else that arrives while ours are still unconfirmed was
// put before ours, so ours are taken off the page, theirs applied, and ours
// applied again on top, exactly as the server does. The patches name widgets
// by id rather than by position, so this preserves what everyone meant.
//
// Text is synchronized field by field by `TextSync` objects, which the
// session sends and routes batches for.
//
// Dependencies are passed in so that this can be tested without a browser:
//
// * `http`: `apos.http`, or anything with its `get` and `post`.
// * `bus`: `apos.bus`.
// * `channels`: `{ subscribe(channel), unsubscribe(channel) }`, as the
// notification store provides. `subscribe` resolves once messages are
// flowing.
// * `applyToPage(patch)`: show a patch on the page. Returns
// `{ claimed, inverses }`: whether something on the page held what it
// touched, and the patches that would take it back, worked out from the page
// as it was just before. The context bar provides this.
// * `callbacks`: optional `onContext(doc)`, `onRefresh()`,
// `onRefused(error)`, `onFatal(error)`, `onStatus({ busy, pending })`,
// `onRemotePatches(data)`, `onRemoteText(data)`, `onPresence(data)`,
// `onPublished(data)` and `onAwareness(data)`.

import { createId } from 'apostrophe/lib/beneath.js';

export default class CollabSession {
  constructor({
    docId,
    tabId,
    action,
    http,
    bus,
    channels,
    applyToPage,
    callbacks = {},
    retryDelay = 5000
  }) {
    this.docId = docId;
    this.tabId = tabId;
    this.action = action;
    this.http = http;
    this.bus = bus;
    this.channels = channels;
    this.applyToPage = applyToPage;
    this.callbacks = callbacks;
    this.retryDelay = retryDelay;
    this.channel = `collab:${docId}`;
    // Patches not yet sent: `{ patch, inverse, target }`
    this.queued = [];
    // Batches sent, or being sent, that the channel has not yet confirmed:
    // `{ batchId, entries, seq }`
    this.unconfirmed = [];
    // Text keys to `Set`s of `TextSync`s
    this.texts = new Map();
    // `TextSync`s waiting for the state of their key
    this.initRequests = new Set();
    // Keys to the version to catch up from
    this.catchUps = new Map();
    this.checkpoints = [];
    this.awareness = null;
    this.awarenessDirty = false;
    this.pumping = false;
    this.started = false;
    this.stopped = false;
    this.listeners = {
      'collab-patches': (data, meta) => this.onPatches(data, meta),
      'collab-text': (data) => this.onText(data),
      'collab-refresh': (data) => this.onRefreshEvent(data),
      'collab-flush': (data) => this.onFlush(data),
      'collab-presence': (data) => this.forward('onPresence', data),
      'collab-published': (data) => this.forward('onPublished', data),
      'collab-awareness': (data) => this.forward('onAwareness', data),
      'notification-channel-gap': (data) => this.onGap(data),
      'notification-channel-refused': (data) => this.onChannelRefused(data)
    };
  }

  // Resolves once this tab receives what others do
  async start() {
    for (const [ name, fn ] of Object.entries(this.listeners)) {
      this.bus.$on(name, fn);
    }
    await this.channels.subscribe(this.channel);
    this.started = true;
    this.wake();
  }

  stop() {
    this.stopped = true;
    for (const [ name, fn ] of Object.entries(this.listeners)) {
      this.bus.$off(name, fn);
    }
    this.channels.unsubscribe(this.channel);
  }

  // Outgoing

  // Save a patch, already applied to the page. `inverse` is the patch that
  // takes it back, or `inverses` the patches that do, in order, needed to
  // rebase it over what others do; `target` says what it was done to, so
  // others can be shown
  queuePatch(patch, {
    inverse = null, inverses = null, target = null
  } = {}) {
    this.queued.push({
      patch,
      // What takes the patch back off the page as it stands now: see
      // `rebase`
      inverses: inverses || (inverse ? [ inverse ] : null),
      target
    });
    this.wake();
  }

  queueCheckpoint(checkpoint) {
    this.checkpoints = this.checkpoints.filter(({ key }) => key !== checkpoint.key);
    this.checkpoints.push(checkpoint);
    this.wake();
  }

  // Where this tab's cursor is, sent along with whatever goes next. If
  // nothing else is going, it goes by itself
  setAwareness(awareness) {
    this.awareness = awareness;
    this.awarenessDirty = true;
    this.wake();
  }

  registerText(sync) {
    if (!this.texts.has(sync.key)) {
      this.texts.set(sync.key, new Set());
    }
    this.texts.get(sync.key).add(sync);
    this.requestInit(sync);
  }

  unregisterText(sync) {
    this.texts.get(sync.key)?.delete(sync);
    if (!this.texts.get(sync.key)?.size) {
      this.texts.delete(sync.key);
    }
    this.initRequests.delete(sync);
  }

  requestInit(sync) {
    this.initRequests.add(sync);
    this.wake();
  }

  requestCatchUp(key, after) {
    const existing = this.catchUps.get(key);
    if ((existing === undefined) || (after < existing)) {
      this.catchUps.set(key, after);
    }
    this.wake();
  }

  // True if anything of ours has not yet been saved
  hasPending() {
    if (this.queued.length || this.unconfirmed.length || this.checkpoints.length) {
      return true;
    }
    for (const syncs of this.texts.values()) {
      for (const sync of syncs) {
        if (sync.hasUnsent()) {
          return true;
        }
      }
    }
    return false;
  }

  // Ask every text field to save what it has, e.g. before publishing or
  // leaving the page, and resolve once everything is sent
  async flush() {
    for (const syncs of this.texts.values()) {
      for (const sync of syncs) {
        sync.checkpoint({ force: true });
      }
    }
    this.wake();
    await this.idle();
  }

  // Resolves when there is nothing left to send
  idle() {
    if (!this.pumping) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.idleResolvers = [ ...(this.idleResolvers || []), resolve ];
    });
  }

  wake() {
    if (this.started && !this.pumping && !this.stopped) {
      this.pump();
    }
  }

  async pump() {
    this.pumping = true;
    this.status();
    try {
      while (!this.stopped) {
        if (this.initRequests.size || this.catchUps.size) {
          await this.fetchText();
          continue;
        }
        const body = this.buildBody();
        if (!body) {
          break;
        }
        await this.send(body);
      }
    } finally {
      this.pumping = false;
      this.status();
      const resolvers = this.idleResolvers || [];
      this.idleResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }

  status() {
    this.callbacks.onStatus?.({
      busy: this.pumping,
      pending: this.hasPending()
    });
  }

  buildBody() {
    const body = {
      docId: this.docId,
      tabId: this.tabId
    };
    let any = false;
    if (this.queued.length) {
      const batch = {
        batchId: createId(),
        entries: this.queued,
        seq: undefined
      };
      this.queued = [];
      this.unconfirmed.push(batch);
      body.batchId = batch.batchId;
      body.patches = batch.entries.map(({ patch }) => patch);
      body.targets = batch.entries.map(({ target }) => target || null);
      body._batch = batch;
      any = true;
    }
    const text = [];
    const senders = [];
    for (const syncs of this.texts.values()) {
      for (const sync of syncs) {
        const outgoing = sync.takeOutgoing();
        if (outgoing) {
          text.push(outgoing);
          senders.push(sync);
        }
      }
    }
    if (text.length) {
      body.text = text;
      body._senders = senders;
      any = true;
    }
    if (this.checkpoints.length) {
      body.checkpoints = this.checkpoints;
      this.checkpoints = [];
      any = true;
    }
    if (this.awarenessDirty) {
      body.awareness = this.awareness || {};
      this.awarenessDirty = false;
      any = true;
    }
    return any ? body : null;
  }

  async send(body) {
    const {
      _batch: batch, _senders: senders = [], ...payload
    } = body;
    let result;
    try {
      result = await this.http.post(`${this.action}/ops`, {
        body: payload
      });
    } catch (e) {
      for (const sync of senders) {
        sync.onFailure();
      }
      if (e.status && (e.status >= 400) && (e.status < 500)) {
        // Refused outright, e.g. we may no longer edit the document. Saying
        // it again will not help
        if (batch) {
          this.rollBack(batch);
        }
        const handler = [ 403, 404 ].includes(e.status) ? 'onFatal' : 'onRefused';
        this.callbacks[handler]?.(e);
        return;
      }
      // Try again in a while, with the same batch, so the server can tell
      // if it already has it
      if (body.checkpoints) {
        this.checkpoints = [ ...body.checkpoints, ...this.checkpoints ];
      }
      if (payload.awareness && !this.awarenessDirty) {
        this.awarenessDirty = true;
      }
      if (batch) {
        this.unconfirmed = this.unconfirmed.filter(b => b !== batch);
        this.queued = [ ...batch.entries, ...this.queued ];
      }
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return;
    }
    if (batch) {
      if (result.patchError) {
        this.rollBack(batch);
        this.callbacks.onRefused?.(result.patchError);
      } else {
        if (result.doc) {
          this.callbacks.onContext?.(result.doc);
        }
        if (result.seq == null) {
          // Nobody else is listening, so nothing will come back to confirm
          // it: the server has it, and that is that
          this.confirm(batch.batchId);
        } else {
          batch.seq = result.seq;
        }
      }
    }
    for (const [ i, sync ] of senders.entries()) {
      sync.onResult(result.text?.[i] || { accepted: false });
    }
  }

  // Take a batch the server refused back off the page
  rollBack(batch) {
    this.unconfirmed = this.unconfirmed.filter(b => b !== batch);
    const later = [
      ...this.unconfirmed.flatMap(b => b.entries),
      ...this.queued
    ];
    this.rebase(later, () => {
      for (const entry of [ ...batch.entries ].reverse()) {
        this.takeBack(entry);
      }
    });
  }

  // Take `local`, our own entries not yet confirmed, off the page, call
  // `fn`, then put them back on top, the way the server will end up
  // applying them. Each is taken back with the inverse worked out when it
  // was last applied, which is exact whatever happened underneath it
  rebase(local, fn) {
    const reversible = local.every(entry => entry.inverses);
    if (reversible) {
      for (const entry of [ ...local ].reverse()) {
        this.takeBack(entry);
      }
    }
    fn();
    if (reversible) {
      for (const entry of local) {
        const { inverses } = this.applyToPage(entry.patch);
        entry.inverses = inverses;
      }
    }
  }

  takeBack(entry) {
    for (const inverse of [ ...(entry.inverses || []) ].reverse()) {
      this.applyToPage(inverse);
    }
  }

  confirm(batchId) {
    this.unconfirmed = this.unconfirmed.filter(batch => batch.batchId !== batchId);
    this.status();
  }

  async fetchText() {
    const keys = new Set([ ...this.catchUps.keys() ]);
    for (const sync of this.initRequests) {
      keys.add(sync.key);
    }
    const qs = {
      docId: this.docId,
      keys: JSON.stringify([ ...keys ])
    };
    const catchUps = new Map(this.catchUps);
    const inits = new Set(this.initRequests);
    this.catchUps.clear();
    this.initRequests.clear();
    for (const [ key, after ] of catchUps) {
      // A key that needs a full start anyway needs no catch up
      if (![ ...inits ].some(sync => sync.key === key)) {
        qs[`after:${key}`] = after;
      }
    }
    let result;
    try {
      result = await this.http.get(`${this.action}/text`, { qs });
    } catch (e) {
      if (e.status && (e.status >= 400) && (e.status < 500)) {
        this.callbacks[[ 403, 404 ].includes(e.status) ? 'onFatal' : 'onRefused']?.(e);
        return;
      }
      for (const sync of inits) {
        this.initRequests.add(sync);
      }
      for (const [ key, after ] of catchUps) {
        this.requestCatchUp(key, after);
      }
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return;
    }
    for (const sync of inits) {
      const state = result.keys?.[sync.key];
      if (state && (state.version !== undefined)) {
        sync.init(state);
      }
    }
    for (const key of catchUps.keys()) {
      const state = result.keys?.[key];
      for (const sync of this.texts.get(key) || []) {
        if (inits.has(sync) || !state) {
          continue;
        }
        if (state.version !== undefined) {
          sync.init(state);
        } else {
          sync.receiveBatches(state.batches || []);
        }
      }
    }
  }

  // Incoming

  onPatches(data, meta = {}) {
    if (data.docId !== this.docId) {
      return;
    }
    if (data.tabId === this.tabId) {
      this.confirm(data.batchId);
      return;
    }
    // Everything of ours the server has not yet put in order comes after
    // this, so take it off the page and put it back on top
    const local = [
      ...this.unconfirmed.flatMap(batch => batch.entries),
      ...this.queued
    ];
    let claimed = true;
    this.rebase(local, () => {
      for (const patch of data.patches || []) {
        claimed = this.applyToPage(patch).claimed && claimed;
      }
    });
    // A batch of ours the channel confirms by number, because the
    // broadcast of it may have been skipped
    if (meta.seq != null) {
      for (const batch of [ ...this.unconfirmed ]) {
        if ((batch.seq != null) && (batch.seq <= meta.seq)) {
          this.confirm(batch.batchId);
        }
      }
    }
    this.callbacks.onRemotePatches?.({
      ...data,
      claimed
    });
    if (data.refresh) {
      this.onRefreshEvent(data);
    }
  }

  onText(data) {
    if ((data.docId !== this.docId) || !data.batch) {
      return;
    }
    for (const sync of this.texts.get(data.batch.key) || []) {
      sync.receiveBatch(data.batch);
    }
    if (data.tabId !== this.tabId) {
      this.callbacks.onRemoteText?.(data);
    }
  }

  onRefreshEvent(data) {
    if (data.docId !== this.docId) {
      return;
    }
    this.callbacks.onRefresh?.(data);
  }

  onFlush(data) {
    if (data.docId !== this.docId) {
      return;
    }
    for (const syncs of this.texts.values()) {
      for (const sync of syncs) {
        sync.checkpoint({ force: true });
      }
    }
  }

  // Messages were missed, so the page may be out of date
  onGap({ channel }) {
    if (channel !== this.channel) {
      return;
    }
    this.callbacks.onRefresh?.({ docId: this.docId });
  }

  onChannelRefused({ channel }) {
    if (channel !== this.channel) {
      return;
    }
    this.callbacks.onFatal?.(new Error('forbidden'));
  }

  forward(callback, data) {
    if (data.docId !== this.docId) {
      return;
    }
    this.callbacks[callback]?.(data);
  }
}
