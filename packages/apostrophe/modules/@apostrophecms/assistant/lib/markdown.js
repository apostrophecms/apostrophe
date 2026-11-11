// Replies are Markdown. They are rendered on the server and sanitized
// against an allow list before the panel shows them, since model text is
// untrusted: it can repeat anything a document it read contains. The stored
// transcript keeps the raw text, which is what the next request replays.

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

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
     * A reply's Markdown as sanitized HTML.
     *
     * @param {string} text
     * @returns {string}
     */
    renderMarkdown(text) {
      if (!text) {
        return '';
      }
      return self.apos.modules['@apostrophecms/rich-text-widget']
        .sanitizeHtml(self.markdown.parse(text), SANITIZE);
    },

    /**
     * A request as the panel reads it: each assistant message with text
     * gets its rendered `html` beside the raw content. Never stored.
     *
     * @param {object} request
     * @returns {object}
     */
    renderRequest(request) {
      return {
        ...request,
        messages: (request.messages || []).map((message) => {
          if (message.role !== 'assistant') {
            return message;
          }
          const text = (message.content || [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
          return text
            ? {
              ...message,
              html: self.renderMarkdown(text)
            }
            : message;
        })
      };
    }
  };
};
