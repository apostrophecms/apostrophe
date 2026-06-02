module.exports = {
  init(self) {
    self.addHelpers({
      safeBold(text) {
        return self.apos.template.safe(`<b>${self.apos.util.escapeHtml(text)}</b>`);
      }
    });
  }
};
