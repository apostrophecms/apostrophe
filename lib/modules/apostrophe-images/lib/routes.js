module.exports = (self) => {
  self.route('post', 'suggestions', self.apos.docs.requireEditorOfSomething, async (req, res) => {
    try {
      const {term, filters} = req.body;

      if (!term || typeof filters !== 'object') {
        const msg = !term
          ? 'A search term must be provided.'
          : 'Filters must be an object containing search filter.';

        return res.status(400).send(msg);
      }

      const suggestions = await self.getSuggestions(req, term, filters);

      res.status(200).send(suggestions);

    } catch (err) {
      res.status(500).send(err);
    }
  });
};
