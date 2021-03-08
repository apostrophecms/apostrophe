module.exports = (self) => {
  self.route('post', 'suggestions', self.apos.docs.requireEditorOfSomething, async (req, res) => {
    try {
      if (!req.body.term) {
        return res.status(200).send();
      }

      const suggestions = await self.getSuggestions(req, req.body.term);

      res.status(200).send(suggestions);

    } catch (err) {
      res.status(500).send(err);
    }
  });
};
