module.exports = {
  improve: '@apostrophecms/doc-type',
  fields(self) {
    if (self.options.autopublish || self.options.localized === false) {
      return;
    }

    return {
      add: {
        scheduledPublish: {
          type: 'dateAndTime',
          label: 'apostrophe:scheduledPublish',
          publishedLabel: 'apostrophe:scheduledUpdate',
          permission: {
            action: 'publish',
            type: self.__meta.name
          }
        },
        scheduledUnpublish: {
          type: 'dateAndTime',
          label: 'apostrophe:scheduledUnpublish',
          permission: {
            action: 'publish',
            type: self.__meta.name
          }
        }
      },
      group: {
        utility: {
          fields: [
            'scheduledPublish',
            'scheduledUnpublish'
          ]
        }
      }
    };
  }
};
