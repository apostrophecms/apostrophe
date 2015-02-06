// A lot more needs to be migrated here, found this in assets.js

module.exports = {
  construct: function(self, options) {
    if (options.browseByType) {
      options.browseByType = _.filter(mediaOptions.browseByType, function(byType) {
        return byType.value = byType.extensions.join(',');
      });
    }
    self.pushAsset('template', { name: 'mediaLibrary', when: 'user', data: options });
  }
}
