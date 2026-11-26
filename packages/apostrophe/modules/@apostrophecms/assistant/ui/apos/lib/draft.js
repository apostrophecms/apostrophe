// A composer draft is a string: text with a `@[title](kind:id)` token for
// each chip, which is what the store keeps per chat tab. The grammar is the
// server's too (`ui/apos/universal/message.js`)
import {
  parseMentions, mentionToken
} from 'Modules/@apostrophecms/assistant/universal/message.js';

export {
  parseMentions as parseDraft, mentionToken
};

export function serializeDraft(parts) {
  return parts
    .map(part => (part.mention ? mentionToken(part.mention) : part.text))
    .join('');
}

// The letters of an `@` that opens a search: typed at the start or after a
// space, a single word right before the caret
export function findQuery(textBefore) {
  const match = textBefore.match(/(?:^|\s)@([^\s@\uFFFC]{0,30})$/);
  return match ? match[1] : null;
}
