// Change events: a door's write to a document tells the browser tab that
// owns its request, the lock family, as the save starts and once it has
// settled, so the page can show what is being written as busy and take the
// write as a step of its own undo history. Two bus events over the
// notification poll, for that browser tab alone:
//
//   'content-change-starting': `{ docId, requestId, ids, fields }`, the
//     `_id`s of the widgets and items the write sets or removes, and the
//     top-level fields it sets
//   'content-change-settled': `{ docId, requestId, written }`; once written,
//     with `entryId`, the change log entry the save landed in, and `parts`,
//     what it changed as `[{ key, before, after }]` (see `getChangeParts` in
//     the versions module)
//
// A door without a browser tab sends nothing. A missed event costs the page
// its busy marks and the undo step; the save stands either way.

const STARTING = 'content-change-starting';
const SETTLED = 'content-change-settled';

// Keys of a patch that say how to save it, not what to set
const META = new Set([ '_lossless', '_strict', '_advisoryLock', '_publish', '_patches' ]);

module.exports = (self) => {
  // What each save marker's saves left, by document `_id`, until the write
  // that made the marker reads it
  const settledSaves = new WeakMap();

  return {
    /**
     * Tells the browser tab of a door's request that a save of `doc` starts.
     *
     * @param {object} req The write's `req`, with the door context.
     * @param {object} doc The document about to be saved.
     * @param {object[]} inputs The patches the save applies.
     */
    async publishChangeStarting(req, doc, inputs) {
      if (!getTabId(req)) {
        return;
      }
      const ids = new Set();
      const fields = new Set();
      for (const input of inputs) {
        for (const [ key, value ] of Object.entries(input)) {
          if (META.has(key)) {
            continue;
          }
          if (!key.startsWith('$')) {
            addKey(key);
            continue;
          }
          for (const [ path, operand ] of Object.entries(value || {})) {
            if (!path.startsWith('@')) {
              fields.add(path.split('.')[0]);
            }
            if (key === '$pullAllById') {
              for (const id of [ operand ].flat()) {
                ids.add(id);
              }
            }
          }
        }
      }
      await publish(req, STARTING, {
        docId: doc._id,
        ids: [ ...ids ],
        fields: [ ...fields ]
      });

      function addKey(key) {
        if (key.startsWith('@')) {
          ids.add(key.substring(1).split('.')[0]);
        } else {
          fields.add(key.split('.')[0]);
        }
      }
    },

    /**
     * Tells the browser tab of a door's request that a save of `doc` has
     * settled: what it changed, or that nothing was written.
     *
     * @param {object} req The write's `req`, with the door context.
     * @param {object} doc The document saved.
     * @param {object} [marker] The save's marker; none when nothing was
     *   written.
     */
    async publishChangeSettled(req, doc, marker) {
      const settled = marker && settledSaves.get(marker)?.get(doc._id);
      if (!settled) {
        await publish(req, SETTLED, {
          docId: doc._id,
          written: false
        });
        return;
      }
      settledSaves.get(marker).delete(doc._id);
      if (!getTabId(req)) {
        return;
      }
      let parts = null;
      try {
        parts = await self.apos.docVersions.getChangeParts(
          req,
          settled.before,
          settled.after
        );
      } catch (e) {
        // Without its parts the page shows the write, and has no step for it
        self.logError(req, 'change-parts-failed', e.message, {
          docId: doc._id,
          stack: e.stack
        });
      }
      await publish(req, SETTLED, {
        docId: doc._id,
        written: true,
        entryId: settled.entryId,
        ...(parts && { parts })
      });
    },

    // Keeps what a marked save left for the write that made the marker
    rememberSettled(marker, {
      entryId, before, after
    }) {
      if (!settledSaves.has(marker)) {
        settledSaves.set(marker, new Map());
      }
      settledSaves.get(marker).set(after._id, {
        entryId,
        before,
        after
      });
    }
  };

  async function publish(req, name, data) {
    const tab = getTabId(req);
    if (!tab || !req.user) {
      return;
    }
    try {
      await self.apos.notification.trigger(req, {
        bus: true,
        tab,
        event: {
          name,
          data: {
            ...data,
            requestId: self.getDoor(req).requestId
          }
        }
      });
    } catch (e) {
      self.logError(req, 'change-event-failed', e.message, {
        event: name,
        docId: data.docId,
        stack: e.stack
      });
    }
  }

  // The browser tab that owns the door's request: its lock family
  function getTabId(req) {
    return self.getDoor(req)?.family || null;
  }
};
