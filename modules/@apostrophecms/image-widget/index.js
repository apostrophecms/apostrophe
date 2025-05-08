module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:image',
    className: false,
    icon: 'image-icon',
    dimensionAttrs: false,
    placeholder: true,
    placeholderClass: false,
    placeholderImage: 'jpg',
    // 0 means disabled width setting
    defaultImageWidth: 100,
    imageResizeStep: 5
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
  fields(self) {
    return {
      add: {
        _image: {
          type: 'relationship',
          label: 'apostrophe:image',
          max: 1,
          required: true,
          withType: '@apostrophecms/image'
        },
        width: {
          type: 'range',
          label: 'apostrophe:imageWidth',
          help: 'apostrophe:imageWidthHelp',
          // 0 makes no sense, so we skip it and
          // go for the 1st step
          min: self.options.imageResizeStep,
          max: 100,
          step: self.options.imageResizeStep,
          def: self.options.defaultImageWidth
        }
      }
    };
  },
  init(self) {
    self.determineBestAssetUrl('placeholder');
  }
};
