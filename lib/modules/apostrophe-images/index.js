module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-image',
  label: 'Image',
  alias: 'images',
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
  ]
};

