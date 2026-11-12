// Mentions: documents the editor names in a message with `@`. A message
// carries each as a `@[title](kind:_id)` token, the grammar of the panel's
// `ui/apos/lib/draft.js`. The server keeps a token only for a document the
// editor and the AI may read, with its own title and kind; any other token
// is left as its title.

const TOKEN = /@\[((?:\\.|[^\]\\])*)\]\(([a-z-]+):([^)\s]+)\)/g;
const MAX_MENTIONS = 20;
const MAX_RESULTS = 8;
const IMAGE = '@apostrophecms/image';

module.exports = (self) => {
  return {
    /**
     * Pages, pieces and images matching the letters typed after `@`, by the
     * start of their words, under the editor's permissions; the latest
     * updated for none.
     * Each with its `kind` (page, piece, image) and its type's label.
     *
     * @param {object} req
     * @param {string} [term]
     * @returns {Promise<object[]>}
     */
    async findMentions(req, term) {
      const letters = self.apos.launder.string(term).trim().slice(0, 100);
      let cursor = self.apos.doc.find(req.clone({ mode: 'draft' }), {
        type: { $in: getMentionTypes() }
      })
        .project({
          _id: 1,
          type: 1,
          title: 1,
          slug: 1
        })
        .limit(MAX_RESULTS);
      cursor = letters
        ? cursor.autocomplete(letters)
        : cursor.sort({ updatedAt: -1 });
      const docs = await cursor.toArray();
      return docs.map(doc => ({
        _id: doc._id,
        title: doc.title,
        type: doc.type,
        kind: getKind(doc),
        label: getLabel(doc)
      }));
    },

    /**
     * A message's mentions, verified: `message` with each token of a
     * readable document carrying its own title and kind, any other token
     * turned into its title, and `mentions`, each document once.
     *
     * @param {object} req
     * @param {string} message
     * @returns {Promise<{ message: string, mentions: object[] }>}
     */
    async verifyMentions(req, message) {
      const found = new Map();
      for (const [ , , , _id ] of message.matchAll(TOKEN)) {
        if (!found.has(_id) && (found.size < MAX_MENTIONS)) {
          found.set(_id, await findMention(_id));
        }
      }
      const mentions = [ ...new Map(
        [ ...found.values() ].filter(Boolean).map(doc => [ doc._id, doc ])
      ).values() ];
      return {
        message: message.replace(TOKEN, (token, title, kind, _id) => {
          const doc = found.get(_id);
          return doc
            ? `@[${escapeTitle(doc.title)}](${getKind(doc)}:${doc._id})`
            : unescapeTitle(title);
        }),
        mentions: mentions.map(doc => ({
          _id: doc._id,
          type: doc.type,
          title: doc.title,
          ...getLocale(doc),
          ...(doc._url && { url: doc._url })
        }))
      };

      async function findMention(_id) {
        try {
          const { doc, draftReq } = await self.apos.harness.findDraft(req, _id);
          return self.apos.ai.can(draftReq, 'view', doc) ? doc : null;
        } catch (e) {
          if (e.name === 'notfound') {
            return null;
          }
          throw e;
        }
      }
    },

    // A message as plain text, each token its title after an `@`
    getPlainMessage(message) {
      return message.replace(TOKEN, (token, title) => `@${unescapeTitle(title)}`);
    }
  };

  // The types the AI works with, but for one-of-a-kind ones such as the
  // global document: pages, pieces and images
  function getMentionTypes() {
    return self.apos.harness.getDocTypeNames().filter(name => {
      const { options } = self.apos.doc.getManager(name);
      return !(options.singleton || options.singletonAuto);
    });
  }

  function getKind(doc) {
    if (doc.type === IMAGE) {
      return 'image';
    }
    return self.apos.page.isPage(doc) ? 'page' : 'piece';
  }

  // Pages are pages whatever their type; pieces and images by their type
  function getLabel(doc) {
    return self.apos.page.isPage(doc)
      ? 'apostrophe:page'
      : (self.apos.doc.getManager(doc.type)?.options.label || doc.type);
  }

  // A document's own locale, none for a type that isn't localized
  function getLocale(doc) {
    const locale = self.apos.harness.getLocaleOf(doc);
    return locale ? { locale } : {};
  }

  function escapeTitle(title) {
    return (title || '').replace(/[\]\\]/g, '\\$&');
  }

  function unescapeTitle(title) {
    return title.replace(/\\(.)/g, '$1');
  }
};
