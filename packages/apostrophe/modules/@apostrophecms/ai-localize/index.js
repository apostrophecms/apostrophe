// AI localization: the "Only new and modified content" choice of the
// Localize dialog. Instead of copying a document over its existing copies
// in other locales, an AI agent brings each copy up to date with what
// changed since its last localization and translates it, keeping work done
// in the other locale alone. A document new to a locale is copied and
// translated in full.
//
// Built on `apos.ai`: the agent is a plain generate loop over tools this
// module registers under the "ai-localize" tag (lib/tools.js), and runs as a
// background job the dialog follows and can stop (lib/run.js). What "since
// its last localization" means is kept in localization records
// (lib/records.js). Available whenever `apos.ai` has a provider configured.

module.exports = {
  options: {
    alias: 'aiLocalize',
    recordsCollection: 'aposAiLocalizations',
    // Model turns one document's pass into one locale may take, plus two
    // for each extra part of a long document's text (see lib/parts.js)
    maxSteps: 40,
    // Characters a part of a long text field aims to stay under
    partMaxChars: 8000,
    // Characters of one page of localize_read_text and of
    // localize_read_outline. Lowering these, and partMaxChars, is how tests
    // exercise long documents with short ones
    textPageChars: 60000,
    outlinePageChars: 20000,
    // The `apos.ai` routing level the passes run on; the AI module's
    // default when unset
    effort: null,
    // Milliseconds between checks of the job's cancellation flag
    cancelPollInterval: 1500
  },
  async init(self) {
    await self.ensureRecords();
    self.registerTools();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:afterLocalize': {
        async recordLocalization(req, source, result, options) {
          await self.recordCoreLocalization(req, source, result, options);
        }
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        // Start a run. Body: `mainId`, the document the dialog was opened
        // for, which "related documents only" leaves out of `docIds`;
        // `docIds`, every draft to localize, related ones included;
        // `toLocales`; `overwriteMain`, to replace the main document's copies
        // whole ("All content") rather than update them; `overwriteRelated`,
        // the same for related documents that already exist; `translateLocales`, the
        // target locales whose content is translated rather than brought
        // over in the source language as is. Returns `{ jobId, pairs }`;
        // follow it with the "ai-localize" bus event and the job module's
        // status route, stop it with the job module's cancel route
        async run(req) {
          if (!req.user || !self.apos.permission.can(req, 'view-draft')) {
            throw self.apos.error('forbidden');
          }
          // Drafts are what get localized, so published ids stand for theirs
          const toDraft = (id) => id.replace(/:published$/, ':draft');
          const mainId = toDraft(self.apos.launder.id(req.body.mainId));
          const docIds = self.apos.launder.ids(req.body.docIds).map(toDraft);
          const toLocales = self.apos.launder.strings(req.body.toLocales)
            .filter((locale) => self.apos.i18n.isValidLocale(locale));
          if (!docIds.length || !toLocales.length) {
            throw self.apos.error('invalid');
          }
          return self.startRun(req, {
            mainId,
            docIds,
            toLocales,
            overwriteMain: self.apos.launder.boolean(req.body.overwriteMain),
            overwriteRelated: self.apos.launder.boolean(req.body.overwriteRelated),
            translateLocales: self.apos.launder.strings(req.body.translateLocales)
          });
        }
      }
    };
  },
  methods(self) {
    return {
      ...require('./lib/records')(self),
      ...require('./lib/tools')(self),
      ...require('./lib/run')(self),
      getBrowserData(req) {
        return {
          action: self.action,
          enabled: Boolean(self.apos.ai.active)
        };
      }
    };
  }
};
