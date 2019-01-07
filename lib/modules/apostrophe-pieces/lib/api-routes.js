module.exports = function(self, options) {
  self.apiRoute('post', 'list', async req => {
    if (!(req.body.filters && (typeof req.body.filters === 'object'))) {
      throw 'invalid';
    }
    const filters = req.body.filters;
    const cursor = self.find(req)
      .perPage(self.options.perPage)
      .trash(null)
      .published(null)
      .queryToFilters(filters, 'manage');
    const pieces = await cursor.toArray();
    return {
      pieces: pieces,
      totalPages: cursor.get('totalPages')
    };
  });
};
