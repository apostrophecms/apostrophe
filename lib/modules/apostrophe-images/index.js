module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-image',
  label: 'Image',
  alias: 'images',
  perPage: 20,
  manageViews: ['grid', 'list'],
  addFields: [
    {
      type: 'attachment',
      name: 'attachment',
      label: 'Image File',
      subtype: 'images',
      required: true
    },
    {
      type: 'string',
      name: 'description',
      label: 'Description',
      textarea: true
    },
    {
      type: 'string',
      name: 'credit',
      label: 'Credit'
    },
    {
      type: 'url',
      name: 'creditUrl',
      label: 'Credit URL'
    },
  ],
  construct: function(self, options) {
    self.pushAsset('script', 'chooser', { when: 'user' });
    self.pushAsset('script', 'relationship-editor', { when: 'user' });
  }
};
