// Keeps the text of one field in step with everyone else editing it, with
// `prosemirror-collab`: our steps are applied at once and sent to the server,
// which puts everyone's in order, and steps from others are folded in as
// they arrive, rebasing ours over them.
//
// The field is edited by a "host", which may be a rich text editor or the
// ProseMirror model of a plain string field (see `string-model.js`):
//
// * `getState()` and `dispatch(tr)`: its ProseMirror state, and a way to
// change it.
// * `registerPlugin(plugin)` and `unregisterPlugin(name)`, as tiptap's
// editor has them.
// * `setContent({ doc, value })`: replace everything, from ProseMirror JSON if
// `doc` is set, otherwise from the stored `value`, without the change being
// recorded as history or sent to anyone. Called before the collab plugin is
// registered, or after it is unregistered.
// * `getValue()`: the value to store in the document (markup or text).
// * `onRemote(tr, batch)`: optional, called after someone else's steps were
// applied, e.g. to point out what changed.
// * `onReset(batch)`: optional, called after the content was replaced
// wholesale by someone else.
// * `afterInit()`: optional, called once collaboration has started, before
// catching up with what others did, e.g. to apply again whatever the user
// typed before that.
//
// The session (see `session.js`) does all the talking to the server.

import {
  collab, sendableSteps, receiveTransaction, getVersion
} from '@tiptap/pm/collab';
import { Step } from '@tiptap/pm/transform';

// Set on the transactions that fold in other people's steps, so that
// whoever listens can tell them apart from typing
export const COLLAB_REMOTE = 'aposCollabRemote';

// The collab plugin's name, as tiptap's `unregisterPlugin` expects it
const collabKey = 'collab';

let nextClient = 1;

export default class TextSync {
  constructor({
    key, session, host, checkpointDelay = 1000
  }) {
    this.key = key;
    this.session = session;
    this.host = host;
    this.checkpointDelay = checkpointDelay;
    this.clientId = `${session.tabId}:${nextClient++}`;
    this.ready = false;
    // Batches that arrived before we were ready, or ahead of one we are
    // missing
    this.buffered = [];
    // What we sent and have not heard back about: `{ version, steps }`
    this.sending = null;
    this.lastAuthorWasMe = false;
    this.checkpointedVersion = 0;
    this.checkpointTimer = null;
    this.flushRequested = false;
    this.destroyed = false;
    session.registerText(this);
  }

  get version() {
    return this.ready ? getVersion(this.host.getState()) : -1;
  }

  // Start collaborating from `state`, as the server described the field:
  // `{ version, doc, value, batches }`
  init(state) {
    if (this.destroyed) {
      return;
    }
    if (this.ready) {
      this.host.unregisterPlugin(collabKey);
      this.ready = false;
    }
    this.host.setContent({
      doc: state.doc,
      value: state.value
    });
    this.host.registerPlugin(collab({
      version: state.version,
      clientID: this.clientId
    }));
    this.ready = true;
    this.sending = null;
    this.checkpointedVersion = state.version;
    // Anything typed before we were ready is applied again now, as ours
    // and not yet confirmed, so that it is rebased over the batches below
    // like any other typing
    this.host.afterInit?.();
    const pending = this.buffered;
    this.buffered = [];
    this.receiveBatches([ ...(state.batches || []), ...pending ]);
    this.session.wake();
  }

  // The host changed its document; if that was typing, there is something to
  // send
  localChanged() {
    if (!this.ready) {
      return;
    }
    if (sendableSteps(this.host.getState())) {
      this.session.wake();
    }
  }

  // The next batch to send, or null. Only one is out at a time
  takeOutgoing() {
    if (!this.ready || this.sending) {
      return null;
    }
    const sendable = sendableSteps(this.host.getState());
    if (!sendable) {
      return null;
    }
    this.sending = {
      version: sendable.version,
      steps: sendable.steps
    };
    return {
      key: this.key,
      version: sendable.version,
      steps: sendable.steps.map(step => step.toJSON()),
      clientId: this.clientId
    };
  }

  // What the server said about the batch we sent
  onResult(result) {
    const sent = this.sending;
    this.sending = null;
    if (!sent || !this.ready) {
      return;
    }
    if (result.accepted) {
      // Ours are the next steps. The same batch also comes back through the
      // channel, and is ignored then, since we will already be past it
      if (this.version === sent.version) {
        this.apply(sent.steps, sent.steps.map(() => this.clientId), {
          mine: true
        });
      }
      this.drain();
      this.afterConfirmed();
    } else if (result.version !== undefined) {
      // Too far behind to catch up step by step
      this.init(result);
      return;
    } else {
      this.receiveBatches(result.batches || []);
    }
    this.session.wake();
  }

  // The request carrying our batch failed; it will be sent again, and if it
  // did get through the first time, the server will say so by refusing it
  // and sending it back as something we missed
  onFailure() {
    this.sending = null;
  }

  receiveBatches(batches) {
    for (const batch of batches) {
      this.receiveBatch(batch);
    }
  }

  receiveBatch(batch) {
    if (this.destroyed || (batch.key !== this.key)) {
      return;
    }
    if (!this.ready) {
      this.buffered.push(batch);
      return;
    }
    const version = this.version;
    if (batch.start <= version) {
      // Seen it
      return;
    }
    if (batch.start > version + 1) {
      if (!this.buffered.some(({ start }) => start === batch.start)) {
        this.buffered.push(batch);
      }
      if (!this.sending) {
        // Nothing we are waiting for will fill the gap, so ask
        this.session.requestCatchUp(this.key, version);
      }
      return;
    }
    if (batch.reset) {
      this.reset(batch);
    } else {
      let steps;
      try {
        const schema = this.host.getState().schema;
        steps = batch.steps.map(json => Step.fromJSON(schema, sanitizeStep(json)));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        this.resync();
        return;
      }
      if (!this.apply(steps, steps.map(() => batch.clientId), {
        mine: batch.clientId === this.clientId,
        batch
      })) {
        return;
      }
    }
    this.drain();
    this.afterConfirmed();
  }

  // Apply steps received from the server. Returns false if they did not fit
  // our document, in which case we start over from what the server has
  apply(steps, clientIds, { mine, batch = null }) {
    const state = this.host.getState();
    let tr;
    try {
      tr = receiveTransaction(state, steps, clientIds, {
        mapSelectionBackward: true
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      this.resync();
      return false;
    }
    tr.setMeta(COLLAB_REMOTE, true);
    this.host.dispatch(tr);
    this.lastAuthorWasMe = mine;
    if (!mine && batch && this.host.onRemote) {
      this.host.onRemote(tr, batch);
    }
    return true;
  }

  // Someone replaced the whole value some other way, e.g. by saving the
  // widget's editor: start over from it. Whatever we typed and had not yet
  // had confirmed is lost to their change, as with any other field
  reset(batch) {
    this.host.unregisterPlugin(collabKey);
    this.ready = false;
    this.host.setContent({
      doc: null,
      value: batch.value
    });
    this.host.registerPlugin(collab({
      version: batch.start,
      clientID: this.clientId
    }));
    this.ready = true;
    this.sending = null;
    this.checkpointedVersion = batch.start;
    this.lastAuthorWasMe = false;
    if (this.host.onReset) {
      this.host.onReset(batch);
    }
  }

  // Apply buffered batches that are now next in line
  drain() {
    let progress = true;
    while (progress && this.buffered.length) {
      progress = false;
      const version = this.version;
      this.buffered = this.buffered.filter(({ start }) => start > version);
      const next = this.buffered.find(({ start }) => start === version + 1);
      if (next) {
        this.buffered = this.buffered.filter(batch => batch !== next);
        this.receiveBatch(next);
        progress = true;
      }
    }
  }

  // Ask for everything again
  resync() {
    this.ready = false;
    this.host.unregisterPlugin(collabKey);
    this.buffered = [];
    this.sending = null;
    this.session.requestInit(this);
  }

  // Once everything we typed is confirmed and we were the last to type,
  // save a checkpoint after a pause, so the document holds the text
  afterConfirmed() {
    if (!this.ready || sendableSteps(this.host.getState())) {
      return;
    }
    if (this.flushRequested) {
      this.flushRequested = false;
      this.checkpoint({ force: true });
      return;
    }
    if (!this.lastAuthorWasMe || this.checkpointTimer) {
      return;
    }
    // Not reset by more typing: while someone types steadily, the text is
    // still saved about once per `checkpointDelay`
    this.checkpointTimer = setTimeout(() => {
      this.checkpointTimer = null;
      this.checkpoint();
    }, this.checkpointDelay);
  }

  // Queue a checkpoint now if there is anything to save. With `force`,
  // even if someone else typed last, e.g. because the document is about to
  // be published
  checkpoint({ force = false } = {}) {
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    if (!this.ready || this.destroyed) {
      return;
    }
    if (sendableSteps(this.host.getState()) || this.sending) {
      // Once they are confirmed
      this.flushRequested = true;
      return;
    }
    const version = this.version;
    if ((version <= this.checkpointedVersion) || (!force && !this.lastAuthorWasMe)) {
      return;
    }
    this.checkpointedVersion = version;
    this.session.queueCheckpoint({
      key: this.key,
      version,
      value: this.host.getValue(),
      doc: this.host.getState().doc.toJSON()
    });
  }

  // True if anything we typed has not yet reached the server
  hasUnsent() {
    return !!(this.ready && (this.sending || sendableSteps(this.host.getState())));
  }

  // Save what we have before going away
  destroy() {
    this.checkpoint();
    this.destroyed = true;
    this.session.unregisterText(this);
  }
}

// Other people's steps are applied straight to the editor, so refuse link
// and image addresses that would run script when clicked. The server stores
// steps without interpreting them, and the stored text is sanitized anyway
function sanitizeStep(json) {
  return walk(json);
  function walk(value) {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (!value || ((typeof value) !== 'object')) {
      return value;
    }
    const result = {};
    for (const [ key, val ] of Object.entries(value)) {
      if ([ 'href', 'src' ].includes(key) && ((typeof val) === 'string') && isUnsafeUrl(val)) {
        result[key] = null;
      } else {
        result[key] = walk(val);
      }
    }
    return result;
  }
}

export function isUnsafeUrl(url) {
  // eslint-disable-next-line no-control-regex
  const normalized = url.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  return /^(javascript|vbscript|data):/.test(normalized) &&
    !/^data:image\/(png|gif|jpe?g|webp);/.test(normalized);
}
