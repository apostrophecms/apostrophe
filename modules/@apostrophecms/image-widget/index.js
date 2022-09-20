module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:image',
    className: false,
    icon: 'image-icon',
    dimensionAttrs: false,
    initialModal: false,
    placeholderClass: false,
    placeholderUrl: '/modules/@apostrophecms/image-widget/placeholder.jpg'
  },
  fields: {
    add: {
      _image: {
        type: 'relationship',
        label: 'apostrophe:image',
        max: 1,
        required: true,
        withType: '@apostrophecms/image'
      }
    }
  }
};
