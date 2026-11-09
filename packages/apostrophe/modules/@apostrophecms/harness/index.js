// This module provides `apos.harness`: what AI can see and do in the CMS,
// what it must follow and what gets recorded, shared by every door (the
// assistant, the MCP server). Its tools are registered on the AI engine
// with the `content` tag; each door selects them with its own tags (see
// `getDoorTools`).
//
// A door hands its context to the tools on the request it passes to
// `apos.ai.generate`, set by `withDoor`. Every write goes through
// `writeDocuments`: draft mode, the AI permission check, the lock, the
// type's own patch with nothing silently lost, marked as AI's. A door's
// saves land in the change log, `aposAiChanges`.

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
      '@apostrophecms/doc-type:afterSaveSettled': {
        async recordChange(req, doc, settled) {
          const { marker } = settled;
          if ((typeof marker?.door !== 'string') || (typeof marker.request !== 'string')) {
            return;
          }
          // Doors write drafts: a published copy changes by being published,
          // and its draft's entry holds the change
          if (doc.aposMode === 'published') {
            return;
          }
          await self.recordChange(req, settled);
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
      ...require('./lib/tools')(self)
    };
  }
};
