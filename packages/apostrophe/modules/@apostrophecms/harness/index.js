// This module provides `apos.harness`: what AI can see and do in the CMS,
// what it must follow and what gets recorded, shared by every door (the
// assistant, the MCP server). Its tools are registered on the AI engine
// with the `content` tag; each door selects them with its own tags (see
// `getDoorTools`). A door's write tells the browser tab that owns the
// request as it starts and once it settles (see lib/change-events.js).
//
// A door hands its context to the tools on the request it passes to
// `apos.ai.generate`, set by `withDoor`. Every write goes through
// `writeDocuments`: draft mode, the AI permission check, the lock, the
// type's own patch with nothing silently lost, marked as AI's. A door's
// saves land in the change log, `aposAiChanges`, which `revertRequests`
// takes back. A door sends the instructions `getInstructions` assembles.

module.exports = {
  options: {
    alias: 'harness',
    // Site-level text, added after the base instructions on every request
    // through either door
    guidance: null
  },
  async init(self) {
    self.addTools();
    await self.enableChangeLog();
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        // Guidance is static text sent to the model as is: a string, or
        // nothing
        validateGuidance() {
          const options = [
            [ self, [ 'guidance' ] ],
            ...[
              ...Object.values(self.apos.doc.managers),
              ...Object.values(self.apos.area.widgetManagers)
            ].map(manager => [ manager, [ 'aiWhen', 'aiHow' ] ])
          ];
          for (const [ module, names ] of options) {
            for (const name of names) {
              const value = module.options[name];
              if ((value != null) && (typeof value !== 'string')) {
                throw new Error(
                  `The "${module.__meta.name}" module's ${name} option must be a string.`
                );
              }
            }
          }
        }
      },
      '@apostrophecms/doc-type:beforeUpdate': {
        // A door's write to a document saved since the door last read or
        // wrote it is refused here: inside the save's own lock, after the
        // document was read for it, before anything is written. Once per
        // save; a document without `updatedAt` is not checked
        checkUnchanged(req, doc) {
          const expected = req.aposHarnessExpected;
          if (!expected || expected.checked || (expected.docId !== doc._id)) {
            return;
          }
          expected.checked = true;
          const saved = new Date(doc.updatedAt ?? NaN).getTime();
          if (!isNaN(saved) && (saved !== new Date(expected.updatedAt).getTime())) {
            throw self.apos.error('conflict');
          }
        }
      },
      '@apostrophecms/doc-type:afterSaveSettled': {
        async recordChange(req, doc, settled) {
          const { marker } = settled;
          if ((typeof marker?.door !== 'string') || (typeof marker.requestId !== 'string')) {
            return;
          }
          // Doors write drafts: a published copy changes by being published,
          // and its draft's entry holds the change
          if (doc.aposMode === 'published') {
            return;
          }
          // An editor's save of fields requests wrote into it from outside:
          // each request's own, nothing for a write to wait on
          if (marker.outside) {
            for (const part of marker.outside) {
              await self.recordChange(req, {
                ...settled,
                marker: {
                  ...marker,
                  requestId: part.requestId,
                  chat: part.chat
                },
                fields: part.fields,
                ended: part.ended
              });
            }
            return;
          }
          const entryId = await self.recordChange(req, settled);
          self.rememberSettled(marker, {
            entryId,
            before: settled.before,
            after: settled.after
          });
        }
      }
    };
  },
  tasks(self) {
    return require('./lib/tasks')(self);
  },
  methods(self) {
    return {
      ...require('./lib/door')(self),
      ...require('./lib/write')(self),
      ...require('./lib/guards')(self),
      ...require('./lib/change-log')(self),
      ...require('./lib/change-events')(self),
      ...require('./lib/revert')(self),
      ...require('./lib/read')(self),
      ...require('./lib/edit')(self),
      ...require('./lib/changes')(self),
      ...require('./lib/schema-read')(self),
      ...require('./lib/guidance')(self),
      ...require('./lib/tools')(self)
    };
  }
};
