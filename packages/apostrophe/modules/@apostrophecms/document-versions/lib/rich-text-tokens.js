// What the two readers of rich text markup share: `rich-text-diff.js` marks
// the words that changed, `rich-text-format.js` lists the formatting that
// did. Both read the markup as a flat list of tokens and compare two lists.

const cheerio = require('cheerio');
const { diffArrays, wordsWithSpaceDiff } = require('diff');

// Elements that flow with the text around them. A boundary of any other
// element separates words
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i',
  'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'time', 'u', 'var'
]);
// The most tokens the two sides may differ by. Past it the comparison costs
// more than a request can take and the marks more than a reader can
const MAX_EDIT_LENGTH = 2000;

module.exports = {
  INLINE,
  parse,
  getWords,
  compareTokens
};

// The markup as a cheerio fragment
function parse(html) {
  return cheerio.load(html || '', null, false);
}

// A text node as `{ key, text }`, one for every word, run of white space
// and punctuation mark. Two tokens are the same when their `key` is
function getWords(text) {
  return wordsWithSpaceDiff.tokenize(text).map(word => ({
    key: `"${word}`,
    text: word
  }));
}

// Two token lists compared by `key`, as the parts of `diffArrays`.
// `undefined` when they differ by more than `MAX_EDIT_LENGTH`
function compareTokens(older, newer) {
  return diffArrays(older, newer, {
    comparator: (one, two) => one.key === two.key,
    maxEditLength: MAX_EDIT_LENGTH
  });
}
