// Lets several people edit the same draft document at once.
//
// Every edit is an operation the server puts in order. Browsers apply their
// own operations at once, and fold in everyone else's as they arrive,
// rebasing whatever of their own is still on its way. There are two kinds:
//
// * Patches, in the same language as the PATCH REST API (`$push`,
// `$pullAllById`, `$move`, `@id` and plain field names). They are applied to
// the document by the usual PATCH code, which calls `startPatch` so that
// this module can sequence and broadcast them.
//
// * Text operations: ProseMirror steps typed into a rich text or string
// field, sequenced per field ("key") in the `aposCollabSteps` collection,
// which the server stores and relays without interpreting them. Whoever
// typed last saves the text as a checkpoint once they pause.
//
// Operations, presence and cursors reach the other browsers through
// notification channels (`collab:<draft _id>`), which ride the notification
// long poll: no new kind of connection is needed.
//
// A doc type takes part if its `collaborative` option is true, as it is by
// default for all doc types except users. Otherwise the usual
// exclusive advisory lock applies.
//
// ## Options
//
// ### `stepsExpireAfter`: seconds that text operations are kept. A browser
// further behind than this has to start that field over. Defaults to 600.
//
// ### `presenceTimeout`: seconds after which a browser tab that has stopped
// refreshing its lock is considered gone. Defaults to 30.
//
// ### `flushTimeout`: milliseconds to wait, before publishing, for everyone's
// unsaved typing to be checkpointed. Defaults to 2000.
//
// ### `excludeTypes`: doc types that never take part, whatever their own
// option says. Defaults to users, which are security sensitive.

const { klona } = require('klona');

module.exports = {
  options: {
    alias: 'collab',
    stepsExpireAfter: 600,
    presenceTimeout: 30,
    flushTimeout: 2000,
    excludeTypes: [ '@apostrophecms/user' ],
    maxStepsPerBatch: 1000,
    maxKeyLength: 1000
  },
  async init(self) {
    await self.ensureCollections();
    self.apos.notification.addChannelType('collab', {
      canSubscribe: self.canSubscribe
    });
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:afterSave': {
        // Anything that changes a collaborative draft other than a patch
        // this module sequenced, such as saving the document editor modal the
        // old way or reverting the draft, is announced so that everyone
        // editing it renders it again
        async announceOtherChanges(req, doc) {
          if (req.aposCollabPatching?.has(doc._id) || !self.isCollaborative(doc)) {
            return;
          }
          await self.resetText(req, doc, () => true);
          await self.broadcast(req, doc._id, 'collab-refresh', {});
        }
      },
      '@apostrophecms/doc-type:beforePublish': {
        async flushBeforePublish(req, { draft, published }) {
          if (!draft || !self.isCollaborative(draft)) {
            return;
          }
          await self.flush(req, draft, [ draft, published ]);
        }
      },
      '@apostrophecms/doc-type:afterPublish': {
        // So everyone editing knows there is nothing left to publish
        async announcePublished(req, { draft }) {
          if (!draft || !self.isCollaborative(draft)) {
            return;
          }
          await self.broadcast(req, draft._id, 'collab-published', {
            lastPublishedAt: draft.lastPublishedAt
          });
        }
      },
      '@apostrophecms/doc-type:afterDelete': {
        async forgetDeleted(req, doc) {
          if (!doc?._id) {
            return;
          }
          await self.textDb.deleteMany({ docId: doc._id });
          await self.stepsDb.deleteMany({ docId: doc._id });
          await self.presenceDb.deleteMany({ docId: doc._id });
        }
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        // Everything one browser tab has to say about one document since its
        // last request: `{ docId, tabId, batchId, patches, targets, text,
        // checkpoints, awareness }`, all but the first two optional. See
        // `applyPatches`, `applyText`, `applyCheckpoints` and
        // `applyAwareness`. The browser sends one of these at a time.
        async ops(req) {
          const {
            docId, tabId, doc
          } = await self.getRequestContext(req, req.body);
          const result = {};
          const body = req.body || {};
          if (Array.isArray(body.patches) && body.patches.length) {
            Object.assign(result, await self.applyPatches(req, doc, tabId, body));
          }
          if (Array.isArray(body.text) && body.text.length) {
            result.text = await self.applyText(req, docId, tabId, body.text);
          }
          if (Array.isArray(body.checkpoints) && body.checkpoints.length) {
            result.checkpoints = await self.applyCheckpoints(
              req,
              doc,
              tabId,
              body.checkpoints
            );
          }
          if (body.awareness && ((typeof body.awareness) === 'object')) {
            await self.applyAwareness(req, docId, tabId, body.awareness);
          }
          return result;
        }
      },
      get: {
        // What a browser needs to start collaborating on some text fields:
        // `?docId=...&keys=["@abc.content",...]`. Responds with `{ keys }`,
        // mapping each key to its state (see `getTextState`).
        async text(req) {
          const { docId } = await self.getRequestContext(req, req.query);
          let keys;
          try {
            keys = JSON.parse(req.query.keys || '[]');
          } catch (e) {
            throw self.apos.error('invalid');
          }
          if (!Array.isArray(keys) || keys.length > 1000) {
            throw self.apos.error('invalid');
          }
          const states = {};
          for (const key of keys.map(self.launderKey).filter(Boolean)) {
            const after = self.apos.launder.integer(req.query[`after:${key}`], -1);
            states[key] = await self.getTextState(docId, key, after);
          }
          return { keys: states };
        },
        // Who else is editing: `?docId=...`. Responds with `{ presence }`, see
        // `getPresence`
        async presence(req) {
          const { docId } = await self.getRequestContext(req, req.query);
          return {
            presence: await self.getPresence(docId)
          };
        }
      }
    };
  },
  methods(self) {
    return {
      async ensureCollections() {
        self.stepsDb = self.apos.db.collection('aposCollabSteps');
        // `startKey` is `start` zero padded, as not every database adapter
        // orders numbers stored in documents numerically. The unique index
        // is what puts concurrent operations on the same text in order
        await self.stepsDb.createIndex({
          docId: 1,
          key: 1,
          startKey: 1
        }, {
          unique: true
        });
        await self.stepsDb.createIndex({ expireAt: 1 }, {
          expireAfterSeconds: 0
        });
        // One per text key ever edited collaboratively: the version the
        // document's saved value corresponds to
        self.textDb = self.apos.db.collection('aposCollabText');
        await self.textDb.createIndex({ docId: 1 });
        self.presenceDb = self.apos.db.collection('aposCollabPresence');
        await self.presenceDb.createIndex({ docId: 1 });
        await self.presenceDb.createIndex({ expireAt: 1 }, {
          expireAfterSeconds: 0
        });
      },

      getBrowserData(req) {
        return {
          action: self.action
        };
      },

      // True if documents of this type may be edited by several people at
      // once
      isCollaborativeType(type) {
        if (self.options.excludeTypes.includes(type)) {
          return false;
        }
        const manager = self.apos.doc.getManager(type);
        return !!manager?.options.collaborative;
      },

      // True if `doc` may be edited by several people at once. Only drafts,
      // or documents not subject to the draft workflow, are ever edited
      isCollaborative(doc) {
        if (!doc?.type || !self.isCollaborativeType(doc.type)) {
          return false;
        }
        return !doc.aposMode || (doc.aposMode === 'draft');
      },

      // The notification channel of a document
      getChannel(docId) {
        return `collab:${docId}`;
      },

      // Channel access check: the user must be able to edit the document,
      // and it must be collaborative. Asked of the database every time, so
      // that a change of permissions takes effect at once in every process
      async canSubscribe(req, docId) {
        const doc = await self.apos.doc.db.findOne({ _id: docId });
        return !!doc &&
          self.isCollaborative(doc) &&
          self.apos.permission.can(req, 'edit', doc);
      },

      // Validates the `docId` and `tabId` of a request and resolves to
      // `{ docId, tabId, doc }`, `doc` being the draft as stored
      async getRequestContext(req, input) {
        if (!req.user) {
          throw self.apos.error('forbidden');
        }
        const docId = self.apos.launder.string(input?.docId);
        const tabId = self.apos.launder.string(input?.tabId) || null;
        if (!docId) {
          throw self.apos.error('invalid');
        }
        const doc = await self.apos.doc.db.findOne({ _id: docId });
        if (!doc) {
          throw self.apos.error('notfound');
        }
        if (!self.isCollaborative(doc) || !self.apos.permission.can(req, 'edit', doc)) {
          throw self.apos.error('forbidden');
        }
        return {
          docId,
          tabId,
          doc
        };
      },

      launderKey(key) {
        if ((typeof key) !== 'string') {
          return null;
        }
        if (!key.length || (key.length > self.options.maxKeyLength)) {
          return null;
        }
        // `@id.path` or `path`, dot separated, no prototype tricks
        if (!/^@?[\w-]+(\.[\w-]+)*$/.test(key)) {
          return null;
        }
        if (key.split('.').some(p => [ '__proto__', 'constructor', 'prototype' ].includes(p))) {
          return null;
        }
        return key;
      },

      padVersion(n) {
        return String(n).padStart(15, '0');
      },

      // Send `event` with `data` to everyone subscribed to the document.
      // `data` is sent with `docId` and the sender's `userId`, `title` and
      // `tabId` added
      //
      // Resolves to `{ channel, seq }`, or to null if nobody is editing the
      // document, in which case nothing is sent
      async broadcast(req, docId, name, data, { tabId = null } = {}) {
        if (!req.user || !await self.hasPresence(docId)) {
          return null;
        }
        return self.apos.notify(req, {
          bus: true,
          channel: self.getChannel(docId),
          event: {
            name,
            data: {
              ...data,
              docId,
              tabId,
              userId: req.user._id,
              title: req.user.title || req.user.username || ''
            }
          }
        });
      },

      // Patches

      // Apply `body.patches` through the PATCH code of the document's type,
      // which sequences and broadcasts them (see `startPatch`). Resolves to
      // `{ doc, seq }`, the draft as the context bar expects it and where the
      // batch went out on the document's channel (null if nobody else is
      // listening), or to `{ patchError }` if the patches were refused
      async applyPatches(req, doc, tabId, body) {
        const batchId = self.apos.launder.string(body.batchId) ||
          self.apos.util.generateId();
        const targets = Array.isArray(body.targets) ? body.targets : [];
        // Also tells us where on the channel the batch was broadcast
        const info = {
          tabId,
          batchId,
          targets
        };
        try {
          const result = await self.patchDoc(req, doc, {
            _patches: body.patches,
            _collab: info
          });
          return {
            doc: result,
            seq: info.seq ?? null
          };
        } catch (e) {
          if (!e.name || !self.isHttpError(e)) {
            throw e;
          }
          // The browser takes back what it did, so tell everyone else the
          // batch will never come
          return {
            patchError: {
              name: e.name,
              message: e.message
            }
          };
        }
      },

      isHttpError(e) {
        return [ 'invalid', 'forbidden', 'notfound', 'conflict', 'locked', 'unprocessable' ]
          .includes(e.name);
      },

      // Run `input` through the PATCH implementation of `doc`'s type, as if
      // it had been sent to its REST API
      async patchDoc(req, doc, input) {
        const manager = self.apos.doc.getManager(doc.type);
        if (!manager) {
          throw self.apos.error('invalid');
        }
        const patchReq = req.clone({
          body: input,
          mode: 'draft',
          locale: doc.aposLocale ? doc.aposLocale.split(':')[0] : req.locale
        });
        if (self.apos.page.isPage(doc)) {
          return self.apos.page.patch(patchReq, doc._id);
        }
        return manager.convertPatchAndRefresh(patchReq, input, doc._id);
      },

      // Called by the PATCH code of pieces and pages, within the document's
      // lock, before applying the patches in `input`. Returns null if the
      // document is not collaborative, otherwise an object whose methods the
      // PATCH code calls:
      //
      // * `applicable(doc, patch)`: false if the patch refers to something no
      // longer there, such as a widget someone else removed. It is skipped
      // rather than failing the whole batch, just as the browsers skip it.
      // May also trim a `$push` of widgets already present.
      // * `applied(patch)`: record that a patch was applied.
      // * `finish(doc)`: after the document is saved, broadcast what was
      // done and bring the text of any collaborative field it replaced back
      // in line.
      async startPatch(req, doc, input) {
        if (!self.isCollaborative(doc)) {
          return null;
        }
        const info = (input._collab && ((typeof input._collab) === 'object'))
          ? input._collab
          : {};
        const tabId = self.apos.launder.string(info.tabId) || null;
        const batchId = self.apos.launder.string(info.batchId) ||
          self.apos.util.generateId();
        const checkpoint = info.checkpoint || null;
        if (checkpoint) {
          await self.checkCheckpoint(doc._id, checkpoint);
        }
        req.aposCollabPatching = req.aposCollabPatching || new Set();
        req.aposCollabPatching.add(doc._id);
        const applied = [];
        // Applying a patch rewrites it in place, resolving `@` references
        // and copying in whole top level properties, so remember each one
        // as it was asked for
        let original = null;
        return {
          applicable(doc, patch) {
            const result = self.isPatchApplicable(doc, patch);
            original = result ? klona(patch) : null;
            return result;
          },
          applied(patch) {
            applied.push(original || klona(patch));
            original = null;
          },
          async finish(doc, { moved = false } = {}) {
            if (checkpoint) {
              await self.recordCheckpoint(doc._id, checkpoint);
              return;
            }
            await self.resetText(req, doc, key => applied.some(patch => {
              return self.patchTouchesKey(doc, patch, key);
            }));
            const sent = await self.broadcast(req, doc._id, 'collab-patches', {
              batchId,
              patches: applied.map(patch => self.getBroadcastPatch(doc, patch)),
              targets: self.launderTargets(info.targets),
              refresh: moved
            }, { tabId });
            // For `applyPatches`, which passed us `info`
            info.seq = sent?.seq ?? null;
          }
        };
      },

      launderTargets(targets) {
        if (!Array.isArray(targets)) {
          return [];
        }
        return targets.slice(0, 100).map(target => {
          if (!target || ((typeof target) !== 'object')) {
            return null;
          }
          const result = {};
          for (const name of [ 'widgetId', 'anchorId', 'patchKey', 'kind' ]) {
            if ((typeof target[name]) === 'string') {
              result[name] = target[name].substring(0, 1000);
            }
          }
          return result;
        });
      },

      // Find the object with this `_id` in `object`, skipping relationships
      // and other dynamic properties at every level, as the browser does
      findObject(object, id) {
        if (!object || ((typeof object) !== 'object')) {
          return null;
        }
        for (const [ key, val ] of Object.entries(object)) {
          if (key.startsWith('_') || !val || ((typeof val) !== 'object')) {
            continue;
          }
          if (val._id === id) {
            return val;
          }
          const found = self.findObject(val, id);
          if (found) {
            return found;
          }
        }
        return null;
      },

      // The `_id` of every object within `value`, including itself
      collectIds(value, ids = new Set()) {
        if (!value || ((typeof value) !== 'object')) {
          return ids;
        }
        if ((typeof value._id) === 'string') {
          ids.add(value._id);
        }
        for (const [ key, val ] of Object.entries(value)) {
          if (!key.startsWith('_')) {
            self.collectIds(val, ids);
          }
        }
        return ids;
      },

      atId(key) {
        return key.startsWith('@') ? key.substring(1).split('.')[0] : null;
      },

      // See `startPatch`. Also trims widgets already present from a `$push`,
      // which happens when two people put back the same widget
      isPatchApplicable(doc, patch) {
        const refersTo = key => {
          const id = self.atId(key);
          return !id || !!self.findObject(doc, id);
        };
        for (const operator of [ '$pullAllById', '$move', '$pullAll' ]) {
          for (const key of Object.keys(patch[operator] || {})) {
            if (!refersTo(key)) {
              return false;
            }
          }
        }
        for (const [ key, value ] of Object.entries(patch.$push || {})) {
          if (!refersTo(key)) {
            return false;
          }
          if (Array.isArray(value?.$each)) {
            value.$each = value.$each.filter(item => {
              return !(item?._id && self.findObject(doc, item._id));
            });
          }
        }
        for (const key of Object.keys(patch)) {
          if (!key.startsWith('$') && !refersTo(key)) {
            return false;
          }
        }
        return true;
      },

      // The patch as it should reach the other browsers: values are read back
      // from the saved document, so they are exactly what was stored, after
      // sanitization, rather than what the sender asked for
      getBroadcastPatch(doc, patch) {
        const result = {};
        const launder = self.apos.launder;
        for (const [ key, value ] of Object.entries(patch.$push || {})) {
          const push = {
            $each: (Array.isArray(value?.$each) ? value.$each : [])
              .map(item => item?._id && self.findObject(doc, item._id))
              .filter(Boolean)
              .map(item => klona(item))
          };
          for (const name of [ '$before', '$after' ]) {
            if (value?.[name]) {
              push[name] = launder.string(value[name]);
            }
          }
          if (value?.$position !== undefined) {
            push.$position = launder.integer(value.$position);
          }
          result.$push = {
            ...result.$push,
            [key]: push
          };
        }
        for (const [ key, value ] of Object.entries(patch.$pullAllById || {})) {
          result.$pullAllById = {
            ...result.$pullAllById,
            [key]: launder.strings(Array.isArray(value) ? value : [ value ])
          };
        }
        for (const [ key, value ] of Object.entries(patch.$move || {})) {
          const move = {
            $item: launder.string(value?.$item)
          };
          for (const name of [ '$before', '$after' ]) {
            if (value?.[name]) {
              move[name] = launder.string(value[name]);
            }
          }
          result.$move = {
            ...result.$move,
            [key]: move
          };
        }
        for (const key of Object.keys(patch.$pullAll || {})) {
          result[key] = klona(self.apos.util.get(doc, key));
        }
        for (const key of Object.keys(patch)) {
          if (key.startsWith('$') || self.apos.schema.isPatchControlProperty(key)) {
            continue;
          }
          result[key] = klona(self.apos.util.get(doc, key));
        }
        return result;
      },

      // True if applying `patch` may have replaced the value of the text
      // field `key` wholesale, rather than through text operations
      patchTouchesKey(doc, patch, key) {
        const keyId = self.atId(key);
        const covers = (patchKey) => (key === patchKey) || key.startsWith(`${patchKey}.`);
        const holdsKey = (value) => keyId && self.collectIds(value).has(keyId);
        for (const [ patchKey, value ] of Object.entries(patch.$push || {})) {
          if (covers(patchKey) || holdsKey(value?.$each)) {
            return true;
          }
        }
        for (const patchKey of Object.keys(patch.$pullAll || {})) {
          if (covers(patchKey) || holdsKey(self.apos.util.get(doc, patchKey))) {
            return true;
          }
        }
        for (const patchKey of Object.keys(patch)) {
          if (patchKey.startsWith('$') || self.apos.schema.isPatchControlProperty(patchKey)) {
            continue;
          }
          if (covers(patchKey) || holdsKey(self.apos.util.get(doc, patchKey))) {
            return true;
          }
        }
        return false;
      },

      // Text

      // Resolves to the highest version sequenced so far for the key, and
      // the key's record in `aposCollabText`, if any
      async getHead(docId, key) {
        const record = await self.textDb.findOne({ _id: self.getTextId(docId, key) });
        const [ last ] = await self.stepsDb.find({
          docId,
          key
        })
          .sort({ startKey: -1 })
          .limit(1)
          .toArray();
        const lastEnd = last ? (last.start + last.count - 1) : 0;
        return {
          head: Math.max(lastEnd, record?.version || 0),
          record
        };
      },

      getTextId(docId, key) {
        return `${docId}|${key}`;
      },

      // Batches of operations on the key after version `after`, oldest
      // first. `complete` is false if some were already forgotten
      async getBatchesSince(docId, key, after) {
        const batches = await self.stepsDb.find({
          docId,
          key,
          startKey: { $gt: self.padVersion(after) }
        })
          .sort({ startKey: 1 })
          .toArray();
        const complete = !batches.length || (batches[0].start === after + 1);
        return {
          batches: batches.map(self.getBroadcastBatch),
          complete
        };
      },

      getBroadcastBatch(batch) {
        return {
          key: batch.key,
          start: batch.start,
          count: batch.count,
          steps: batch.steps || null,
          reset: batch.reset || false,
          value: batch.reset ? batch.value : undefined,
          clientId: batch.clientId || null,
          userId: batch.userId || null,
          title: batch.title || ''
        };
      },

      // The state of a text key for a browser that is about to collaborate
      // on it, or catch up: `{ version, doc, value, batches }`. `version` is
      // that of the last checkpoint or reset, `doc` its ProseMirror JSON if
      // the browser that saved it sent one, `value` the text as stored in the
      // document otherwise, and `batches` the operations since.
      //
      // If `after` is not -1 and every operation after it is still known,
      // only those are sent, as `{ batches }`.
      async getTextState(docId, key, after = -1) {
        if (after >= 0) {
          const { batches, complete } = await self.getBatchesSince(docId, key, after);
          if (complete) {
            return { batches };
          }
        }
        const record = await self.textDb.findOne({ _id: self.getTextId(docId, key) });
        const version = record?.version || 0;
        let value;
        if (!record?.doc) {
          const draft = await self.apos.doc.db.findOne({ _id: docId });
          value = draft ? self.apos.util.get(draft, key) : undefined;
        }
        const { batches, complete } = await self.getBatchesSince(docId, key, version);
        if (!complete) {
          // Cannot happen unless the database lost operations out of order
          self.apos.util.warn(`Operations on ${key} in ${docId} are incomplete`);
        }
        return {
          version,
          doc: record?.doc || null,
          value: (value === undefined) ? null : value,
          batches
        };
      },

      // Sequence each `{ key, version, steps, clientId }` in `text`: steps
      // typed by a browser that had seen everything up to `version`. Accepted
      // if `version` is still the latest, then broadcast. Resolves to an
      // array of `{ key, accepted }`, with the batches the browser missed
      // when not accepted
      async applyText(req, docId, tabId, text) {
        const results = [];
        for (const item of text.slice(0, 100)) {
          const key = self.launderKey(item?.key);
          const version = self.apos.launder.integer(item?.version, -1);
          const steps = Array.isArray(item?.steps) ? item.steps : null;
          if (!key || (version < 0) || !steps || !steps.length ||
            (steps.length > self.options.maxStepsPerBatch)) {
            throw self.apos.error('invalid');
          }
          const clientId = self.apos.launder.string(item.clientId) || tabId;
          const batch = {
            docId,
            key,
            start: version + 1,
            startKey: self.padVersion(version + 1),
            count: steps.length,
            steps,
            clientId,
            userId: req.user._id,
            title: req.user.title || req.user.username || ''
          };
          if (await self.insertBatch(docId, key, version, batch)) {
            await self.broadcast(req, docId, 'collab-text', {
              batch: self.getBroadcastBatch(batch)
            }, { tabId });
            results.push({
              key,
              accepted: true
            });
          } else {
            results.push({
              key,
              accepted: false,
              ...(await self.getTextState(docId, key, version))
            });
          }
        }
        return results;
      },

      // Store `batch` if `version` is still the latest for the key. Resolves
      // to false if someone else got there first
      async insertBatch(docId, key, version, batch) {
        const { head } = await self.getHead(docId, key);
        if (version !== head) {
          return false;
        }
        try {
          await self.stepsDb.insertOne({
            _id: self.apos.util.generateId(),
            ...batch,
            createdAt: new Date(),
            expireAt: new Date(Date.now() + self.options.stepsExpireAfter * 1000)
          });
        } catch (e) {
          if (e.code === 11000) {
            return false;
          }
          throw e;
        }
        if (!await self.textDb.findOne({ _id: self.getTextId(docId, key) })) {
          try {
            await self.textDb.insertOne({
              _id: self.getTextId(docId, key),
              docId,
              key,
              version: 0,
              doc: null
            });
          } catch (e) {
            if (e.code !== 11000) {
              throw e;
            }
          }
        }
        return true;
      },

      // Save each `{ key, version, value, doc }` in `checkpoints`: the text of
      // a field as of `version`, and its ProseMirror JSON (`doc`) if it is
      // rich text or edited with ProseMirror. Only a version newer than the
      // last one saved is taken. Resolves to an array of `{ key, accepted }`
      async applyCheckpoints(req, doc, tabId, checkpoints) {
        const results = [];
        for (const item of checkpoints.slice(0, 100)) {
          const key = self.launderKey(item?.key);
          const version = self.apos.launder.integer(item?.version, -1);
          if (!key || (version < 1) || ((typeof item.value) !== 'string')) {
            throw self.apos.error('invalid');
          }
          const json = (item.doc && ((typeof item.doc) === 'object')) ? item.doc : null;
          try {
            await self.patchDoc(req, doc, {
              _patches: [ { [key]: item.value } ],
              _collab: {
                tabId,
                checkpoint: {
                  key,
                  version,
                  doc: json
                }
              }
            });
            results.push({
              key,
              accepted: true
            });
          } catch (e) {
            if (e.name !== 'collab-stale-checkpoint') {
              throw e;
            }
            results.push({
              key,
              accepted: false
            });
          }
        }
        return results;
      },

      // Throws unless `checkpoint.version` is newer than the version the
      // document holds, and was actually sequenced
      async checkCheckpoint(docId, checkpoint) {
        const key = self.launderKey(checkpoint.key);
        const { head, record } = await self.getHead(docId, key);
        const version = checkpoint.version;
        if (!key || (version <= (record?.version || 0)) || (version > head)) {
          throw self.apos.error('collab-stale-checkpoint');
        }
      },

      async recordCheckpoint(docId, {
        key, version, doc
      }) {
        await self.textDb.updateOne({ _id: self.getTextId(docId, key) }, {
          $set: {
            docId,
            key,
            version,
            doc: doc || null
          }
        }, { upsert: true });
      },

      // For every text key of `doc` that was edited collaboratively and for
      // which `touched(key)` is true, sequence a reset to the value now in
      // the document: something other than text operations replaced it, and
      // everyone must start over from there
      async resetText(req, doc, touched) {
        const records = await self.textDb.find({ docId: doc._id }).toArray();
        for (const record of records) {
          if (!touched(record.key)) {
            continue;
          }
          const value = self.apos.util.get(doc, record.key);
          if (value === undefined) {
            // The widget that held it is gone
            continue;
          }
          for (let attempt = 0; attempt < 100; attempt++) {
            const { head } = await self.getHead(doc._id, record.key);
            const batch = {
              docId: doc._id,
              key: record.key,
              start: head + 1,
              startKey: self.padVersion(head + 1),
              count: 1,
              reset: true,
              value,
              userId: req.user?._id || null,
              title: req.user?.title || ''
            };
            if (await self.insertBatch(doc._id, record.key, head, batch)) {
              await self.textDb.updateOne({ _id: record._id }, {
                $set: {
                  version: batch.start,
                  doc: null
                }
              });
              await self.broadcast(req, doc._id, 'collab-text', {
                batch: self.getBroadcastBatch(batch)
              });
              break;
            }
          }
        }
      },

      // Ask everyone editing `doc` to checkpoint what they have typed, then
      // wait until all of it is saved, or `flushTimeout` passes. The saved
      // text is then copied into each of `targets`, such as the draft and
      // published documents in the middle of being published
      async flush(req, doc, targets = []) {
        const records = await self.textDb.find({ docId: doc._id }).toArray();
        const pending = async () => {
          for (const record of records) {
            const { head, record: current } = await self.getHead(doc._id, record.key);
            if ((current?.version || 0) < head) {
              return true;
            }
          }
          return false;
        };
        if (!await pending()) {
          return;
        }
        await self.broadcast(req, doc._id, 'collab-flush', {});
        const start = Date.now();
        while ((Date.now() - start) < self.options.flushTimeout) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!await pending()) {
            break;
          }
        }
        // The checkpoints changed the draft in the database, so the draft
        // about to be published must be brought up to date
        const saved = await self.apos.doc.db.findOne({ _id: doc._id });
        if (saved) {
          for (const record of records) {
            const value = self.apos.util.get(saved, record.key);
            if (value === undefined) {
              continue;
            }
            for (const target of targets.filter(Boolean)) {
              self.setAtKey(target, record.key, klona(value));
            }
          }
        }
      },

      setAtKey(doc, key, value) {
        try {
          self.apos.util.set(doc, key, value);
        } catch (e) {
          // Not a path we can write to, leave it be
        }
      },

      // Presence and cursors

      // A browser tab took or refreshed its lock on the document: it is here.
      // Someone new is announced, and anyone who stopped refreshing their
      // lock is announced as gone
      async join(req, doc, tabId) {
        const _id = `${doc._id}|${tabId}`;
        const now = new Date();
        const existing = await self.presenceDb.findOne({ _id });
        await self.presenceDb.updateOne({ _id }, {
          $set: {
            docId: doc._id,
            tabId,
            userId: req.user._id,
            title: req.user.title || req.user.username || '',
            username: req.user.username || '',
            updatedAt: now,
            expireAt: new Date(now.getTime() + self.options.presenceTimeout * 2000)
          }
        }, { upsert: true });
        if (!existing) {
          await self.broadcast(req, doc._id, 'collab-presence', {
            joined: true
          }, { tabId });
        }
        await self.sweepPresence(req, doc._id);
      },

      async leave(req, doc, tabId) {
        const response = await self.presenceDb.deleteOne({ _id: `${doc._id}|${tabId}` });
        if (response?.deletedCount || response?.result?.n) {
          await self.broadcast(req, doc._id, 'collab-presence', {
            left: true
          }, { tabId });
        }
      },

      // True if anyone has the document open for editing, in any process.
      // Nobody can be listening otherwise, so there is no point in
      // broadcasting
      async hasPresence(docId) {
        return !!(await self.presenceDb.findOne({ docId }, {
          projection: { _id: 1 }
        }));
      },

      async sweepPresence(req, docId) {
        const stale = await self.presenceDb.find({
          docId,
          updatedAt: { $lt: new Date(Date.now() - self.options.presenceTimeout * 1000) }
        }).toArray();
        for (const entry of stale) {
          await self.presenceDb.deleteOne({ _id: entry._id });
          await self.apos.notify(req, {
            bus: true,
            channel: self.getChannel(docId),
            event: {
              name: 'collab-presence',
              data: {
                docId,
                left: true,
                tabId: entry.tabId,
                userId: entry.userId,
                title: entry.title
              }
            }
          });
        }
      },

      // Everyone with the document open for editing: an array of
      // `{ tabId, userId, title }`
      async getPresence(docId) {
        const entries = await self.presenceDb.find({
          docId,
          updatedAt: { $gte: new Date(Date.now() - self.options.presenceTimeout * 1000) }
        }).toArray();
        return entries.map(({
          tabId, userId, title
        }) => ({
          tabId,
          userId,
          title
        }));
      },

      // Where the sender's cursor is: `{ key, anchor, head }` in a text field,
      // `{ widgetId }` for a focused widget, or empty when they are nowhere
      // in particular
      async applyAwareness(req, docId, tabId, awareness) {
        const launder = self.apos.launder;
        const data = {};
        const key = self.launderKey(awareness.key);
        if (key) {
          data.key = key;
          data.anchor = launder.integer(awareness.anchor, 0);
          data.head = launder.integer(awareness.head, 0);
          data.version = launder.integer(awareness.version, 0);
        }
        if (awareness.widgetId) {
          data.widgetId = launder.string(awareness.widgetId);
        }
        await self.broadcast(req, docId, 'collab-awareness', data, { tabId });
      }
    };
  }
};
