// Argument schemas the harness's tool definitions share.

module.exports = (self) => {
  return {
    // The handler name of a harness method
    handler: name => `@apostrophecms/harness:${name}`,

    // A document, widget or version id
    id: description => ({
      type: 'string',
      minLength: 1,
      description
    }),

    // The `locale` argument, only in a project with several locales
    locale: description => {
      const names = self.getLocaleNames();
      return (names.length > 1)
        ? {
          locale: {
            type: 'string',
            enum: names,
            description
          }
        }
        : {};
    }
  };
};
