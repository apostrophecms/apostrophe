module.exports = {
  extend: '@apostrophecms/piece-page-type',
  options: {
    label: 'aposEvent:eventPage',
    piecesFilters: [
      { name: 'year' },
      { name: 'month' },
      { name: 'day' }
    ]
  },
  extendMethods(self) {
    return {
      indexQuery(_super, req) {
        return _super(req).upcoming(true);
      }
    };
  }
};
