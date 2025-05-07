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
  widgetOperations(self, options) {
    const {
      relationshipEditor = 'AposImageRelationshipEditor',
      relationshipEditorLabel = 'apostrophe:editImageAdjustments',
      relationshipEditorIcon = 'image-edit-outline'
    } = options.apos.image.options || {};
    return {
      add: {
        adjustImage: {
          label: relationshipEditorLabel,
          icon: relationshipEditorIcon,
          modal: relationshipEditor,
          tooltip: relationshipEditorLabel
        }
      }
    };
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
