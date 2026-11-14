// A composer draft is a string: text with a `@[title](kind:id)` token for
// each chip, which is what the store keeps per chat tab

const TOKEN = /@\[((?:\\.|[^\]\\])*)\]\(([a-z-]+):([^)\s]+)\)/g;

/**
 * @param {string} draft
 * @returns {Array<{ text: string } | { mention: object }>} A mention has
 *   `id`, `title` and `kind`.
 */
export function parseDraft(draft) {
  const parts = [];
  let last = 0;
  for (const match of (draft || '').matchAll(TOKEN)) {
    if (match.index > last) {
      parts.push({ text: draft.slice(last, match.index) });
    }
    parts.push({
      mention: {
        title: match[1].replace(/\\(.)/g, '$1'),
        kind: match[2],
        id: match[3]
      }
    });
    last = match.index + match[0].length;
  }
  if (last < (draft || '').length) {
    parts.push({ text: draft.slice(last) });
  }
  return parts;
}

export function mentionToken({
  id, title, kind
}) {
  return `@[${title.replace(/[\]\\]/g, '\\$&')}](${kind}:${id})`;
}

export function serializeDraft(parts) {
  return parts
    .map(part => (part.mention ? mentionToken(part.mention) : part.text))
    .join('');
}

// The `@` and the letters typed after it, right before the caret
export function findQuery(textBefore) {
  const match = textBefore.match(/(?:^|\s)@([^\s@\uFFFC]{0,30})$/);
  return match ? match[1] : null;
}
