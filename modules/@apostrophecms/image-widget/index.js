module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:image',
    className: false,
    icon: 'image-icon',
    dimensionAttrs: false
  },
  fields: {
    add: {
      _image: {
        type: 'relationship',
        editor: 'AposImageRelationshipEditor',
        label: 'apostrophe:image',
        max: 1,
        required: true,
        withType: '@apostrophecms/image',
        fields: {
          add: {
            top: {
              type: 'integer',
              label: 'top'
            },
            left: {
              type: 'integer',
              label: 'left'
            },
            width: {
              type: 'integer',
              label: 'width'
            },
            height: {
              type: 'integer',
              label: 'height'
            },
            x: {
              type: 'integer',
              label: 'x'
            },
            y: {
              type: 'integer',
              label: 'y'
            }
          }
        }
      }
    }
  }
};
