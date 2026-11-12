// Messages and replies are Markdown. They are rendered on the server and
// sanitized against an allow list before the panel shows them, since model
// text is untrusted: it can repeat anything a document it read contains.
// The stored transcript keeps the raw text, which is what the next request
// replays.
//
// A mention token, `@[title](kind:_id)`, becomes a chip after sanitizing,
// so no text can make one: each token is set aside as a placeholder of
// private-use characters, which the input can't carry, and comes back as a
// chip only for a document the server checked.

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const TOKEN = /@\[((?:\\.|[^\]\\])*)\]\(([a-z-]+):([^)\s]+)\)/g;
const PLACEHOLDER = /\uE000(\d+)\uE001/g;
const PRIVATE = /[\uE000\uE001]/g;

const SANITIZE = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: [ 'href', 'title', 'target', 'rel' ],
    th: [ 'align' ],
    td: [ 'align' ]
  },
  allowedSchemes: [ 'http', 'https', 'mailto' ],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // A link in a reply leaves the editing session
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    })
  }
};

module.exports = (self) => {
  return {
    // `marked` is an ES module: loaded once the assistant is active
    async loadMarkdown() {
      const { Marked } = await import('marked');
      self.markdown = new Marked({
        async: false,
        gfm: true,
        breaks: true
      });
    },

    /**
     * Markdown as sanitized HTML, each token of a document in `mentions` a
     * chip: a link to the document's page when it has one, else a button
     * that opens its editor. Any other token is its title.
     *
     * @param {string} text
     * @param {object} [options]
     * @param {object[]} [options.mentions] Checked documents, `{ _id, type,
     *   title, url? }`.
     * @returns {string}
     */
    renderMarkdown(text, { mentions = [] } = {}) {
      if (!text) {
        return '';
      }
      const byId = new Map(mentions.map(mention => [ mention._id, mention ]));
      const tokens = [];
      const marked = text.replace(PRIVATE, '').replace(TOKEN, (token, title, kind, _id) => {
        tokens.push({
          title: title.replace(/\\(.)/g, '$1'),
          kind,
          mention: byId.get(_id)
        });
        return `\uE000${tokens.length - 1}\uE001`;
      });
      const html = self.apos.modules['@apostrophecms/rich-text-widget']
        .sanitizeHtml(self.markdown.parse(marked), SANITIZE);
      return html.replace(PLACEHOLDER, (placeholder, index) => renderChip(tokens[index]));
    }
  };

  function renderChip({
    title, kind, mention
  }) {
    const escape = self.apos.util.escapeHtml;
    if (!mention) {
      return escape(title);
    }
    const label = `<span class="apos-assistant-chip__title">${escape(mention.title)}</span>`;
    const attributes = 'class="apos-assistant-chip apos-assistant-chip--action" ' +
      `data-kind="${escape(kind)}" ` +
      `title="${escape(mention.title)}"`;
    return mention.url
      ? `<a ${attributes} href="${escape(mention.url)}">${label}</a>`
      : `<button type="button" ${attributes} data-id="${escape(mention._id)}" ` +
        `data-type="${escape(mention.type)}">${label}</button>`;
  }
};
