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
    defaultImageWidth: 0,
    imageResizeStep: 5
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
          min: 0,
          max: 100,
          step: self.options.imageResizeStep || 1,
          def: self.options.defaultImageWidth ?? 100
        }
      }
    };
  },
  init(self) {
    self.determineBestAssetUrl('placeholder');
  }
};
