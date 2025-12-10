// This code is for EDITORS, to allow them to follow the permalinks
// even though they are not replaced with the actual page URLs in
// the markup on the server side. We do not do that for editors
// because otherwise the permalink would be lost on the next edit.

export default function() {
  window.addEventListener('hashchange', e => {
    // Typical case: hash link followed after page load
    if (followPermalink()) {
      e.stopPropagation();
    }
  });
  // Or, the URL could already contain a permalink
  followPermalink();
  async function followPermalink() {
    const hash = location.hash || '';
    const matches = hash.match(/#apostrophe-permalink-(.*)$/);
    if (matches) {
      const aposDocId = matches[1].replace(/\?.*$/, '');
      const doc = await apos.http.get(`${apos.doc.action}/${aposDocId}`, {});
      if (doc._url) {
        // This way the hashed version does not enter the history
        location.replace(doc._url);
        return true;
      }
    }
  }
};
