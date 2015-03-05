// A lot more needs to be migrated here, found this in assets.js

module.exports = {
  construct: function(self, options) {
    self.defaultImageSizes = options.defaultImageSizes || [
      {
        name: 'full',
        width: 1140,
        height: 1140
      },
      {
        name: 'two-thirds',
        width: 760,
        height: 760
      },
      {
        name: 'one-half',
        width: 570,
        height: 700
      },
      {
        name: 'one-third',
        width: 380,
        height: 700
      },
      // Handy for thumbnailing
      {
        name: 'one-sixth',
        width: 190,
        height: 350
      }
    ];

    // mediaLibrary.js would have to be patched to support changing this. -Tom
    self.trashImageSizes = options.trashImageSizes || [ 'one-sixth' ];
    
    // Default file type groupings
    self.fileGroups = options.fileGroups || [
      {
        name: 'images',
        label: 'Images',
        extensions: [ 'gif', 'jpg', 'png' ],
        extensionMaps: {
          jpeg: 'jpg'
        },
        // uploadfs should treat this as an image and create scaled versions
        image: true
      },
      {
        name: 'office',
        label: 'Office',
        extensions: [ 'txt', 'rtf', 'pdf', 'xls', 'ppt', 'doc', 'pptx', 'sldx', 'ppsx', 'potx', 'xlsx', 'xltx', 'docx', 'dotx' ],
        extensionMaps: {},
        // uploadfs should just accept this file as-is
        image: false
      },
    ];

    // TODO figure this out
    // self.pushGlobalData({
    //   files: self.options.files || {}
    // });

    require('./lib/api')(self, options);
    require('./lib/findApi')(self, options);
    require('./lib/routes')(self, options);

    // Add the find files API to nunjucks locals
    self.apos.templates.addToApos({
      files: {
        find: self.find
      }
    });

    self.apos.files = self;

    if (options.browseByType) {
      options.browseByType = _.filter(mediaOptions.browseByType, function(byType) {
        return byType.value = byType.extensions.join(',');
      });
    }
    self.pushAsset('template', { name: 'mediaLibrary', when: 'user', data: options });
  }
}
