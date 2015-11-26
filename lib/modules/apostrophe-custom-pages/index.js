var _ = require('lodash');

module.exports = {
  afterConstruct: function(self) {
    self.schema = self.apos.schemas.refine(self.apos.pages.schema, self.options);
    // inherit some useful methods from the default manager for our page type,
    // if we never bothered to override them
    self.manager = self.apos.pages.getManager(self.name);
    _.defaults(self, self.manager);
    // now make ourselves the manager
    self.apos.pages.setManager(self.name, self);
  },
  construct: function(self, options) {

    self.name = self.options.name || self.__meta.name.replace(/\-pages$/, '-page');

    require('./lib/dispatch.js')(self, options);

    // As a doc manager, we can provide default templates for use when
    // choosing docs of our type. With this code in place, subclasses of
    // custom pages can just provide custom chooserChoice.html and chooserChoices.html
    // templates with no additional plumbing. -Tom

    self.choiceTemplate = self.__meta.name + ':chooserChoice.html';
    self.choicesTemplate = self.__meta.name + ':chooserChoices.html';
    self.relationshipTemplate = self.__meta.name + ':relationshipEditor.html';
  }
};
