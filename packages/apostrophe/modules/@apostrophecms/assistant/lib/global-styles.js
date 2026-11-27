// Global Styles in the assistant. They are changed in their own window by
// default (`open_editor`, then `edit_open_document`), so nothing is live
// before the user saves there. A direct write with `update_document` is
// the user's choice: it always asks first, naming the locales it writes, as
// it is live in each of them at once. Asked for this page's locale alone, the
// user may send the change to the window instead.

const TOOL = 'update_document';
const TYPE = '@apostrophecms/styles';
const OPEN_MESSAGE = 'The user wants this change made in the Global Styles window instead, ' +
  'so nothing was written: open the window with open_editor on this Global Styles ' +
  'document and set the values there with edit_open_document; the user saves or cancels.';

module.exports = (self) => {
  return {
    // Registers the gate on direct writes of Global Styles
    addGlobalStylesGate() {
      self.addGate(TOOL, 'globalStyles', async (args, {
        req, ids, getScreen
      }) => {
        const docs = [];
        for (const id of ids) {
          try {
            docs.push((await self.apos.aposHarness.findDraft(req, id)).doc);
          } catch (e) {
            if (e.name !== 'notfound') {
              throw e;
            }
          }
        }
        const styles = docs.filter(doc => isGlobalStyles(doc.type));
        if (!styles.length) {
          return false;
        }
        // Written beside other documents: the standard confirmation names
        // them all
        if (styles.length < docs.length) {
          return true;
        }
        const locales = [
          ...new Set(styles.map(doc => self.apos.aposHarness.getLocaleOf(doc)))
        ];
        const pageLocale = self.getPageLocale(await getScreen());
        const live = { key: 'aposAssistant:assistantGateLive' };
        if (locales.length > 1) {
          return {
            title: {
              key: 'aposAssistant:assistantGateStylesLocales',
              values: { count: locales.length }
            },
            text: [ { list: locales.map(getLocaleLabel) }, live ],
            approve: 'aposAssistant:assistantApplyNow'
          };
        }
        return {
          title: {
            key: 'aposAssistant:assistantGateStylesLocale',
            values: { locale: getLocaleLabel(locales[0]) }
          },
          text: live,
          approve: 'aposAssistant:assistantApplyNow',
          // The window edits this page's locale and nothing else
          ...((locales[0] === pageLocale) && {
            alternatives: [ {
              name: 'window',
              label: 'aposAssistant:assistantOpenStyles',
              message: OPEN_MESSAGE
            } ]
          })
        };
      });

      function getLocaleLabel(locale) {
        return self.apos.i18n.locales[locale]?.label || locale;
      }
    },

    /**
     * After `update_document` wrote Global Styles in the assistant
     * (`afterToolCall`): the result names this page's locale and whether it
     * was one of those written, so the reply can say where the change
     * shows.
     *
     * @param {object} req
     * @param {object} payload The engine's `{ tool, args, result }`.
     */
    async noteGlobalStylesWrite(req, payload) {
      const { tool, result } = payload;
      if (!self.active || (self.apos.aposHarness.getDoor(req)?.door !== 'assistant') ||
        (tool.name !== TOOL) || !Array.isArray(result?.written)) {
        return;
      }
      const written = result.written.filter(item => isGlobalStyles(item.type));
      if (!written.length) {
        return;
      }
      const request = await self.requests.findOne({
        _id: self.apos.aposHarness.getDoor(req).requestId,
        ownerId: self.getOwnerId(req)
      }, { projection: { screen: 1 } });
      const pageLocale = self.getPageLocale(request?.screen);
      payload.result = {
        ...result,
        pageLocale,
        pageLocaleWritten: written.some(item => item.locale === pageLocale)
      };
    }
  };

  function isGlobalStyles(type) {
    const manager = self.apos.doc.getManager(type);
    return Boolean(manager) && self.apos.instanceOf(manager, TYPE);
  }
};
