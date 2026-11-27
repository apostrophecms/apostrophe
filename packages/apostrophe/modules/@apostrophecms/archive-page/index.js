module.exports = {
  // This is the page type manager for the main archive, the ancestor of
  // all archived pages
  extend: '@apostrophecms/page-type',
  options: {
    // Not a type anyone picks: its one page only holds the archive
    virtual: true
  }
};
