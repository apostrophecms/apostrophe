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
              type: 'integer'
            },
            left: {
              type: 'integer'
            },
            width: {
              label: 'W',
              type: 'integer',
              modifiers: [ 'inline' ]
            },
            height: {
              label: 'H',
              type: 'integer',
              modifiers: [ 'inline' ]

            },
            x: {
              type: 'integer'
            },
            y: {
              type: 'integer'
            }
          }
        }
      }
    }
  }
};
