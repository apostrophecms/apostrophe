module.exports = (self) => {
  self.route('post', 'suggestions', self.apos.docs.requireEditorOfSomething, async (req, res) => {
    if (!req.body.term) {
      return res.status(200).send();
    }

    const suggestions = await self.getSuggestions(req, req.body.term);

    res.status(200).send(suggestions);
  });
};
