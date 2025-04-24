module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:image',
    className: false,
    icon: 'image-icon',
    dimensionAttrs: false,
    placeholder: true,
    placeholderClass: false,
    placeholderImage: 'jpg'
  },
  widgetOperations: {
    add: {
      adjustImage: {
        label: 'apostrophe:editImageAdjustments',
        icon: 'image-edit-outline',
        modal: 'AposImageRelationshipEditor',
        tooltip: 'apostrophe:editImageAdjustments'
      }
    }
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
  },
  init(self) {
    self.determineBestAssetUrl('placeholder');
  }
};
