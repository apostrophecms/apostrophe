module.exports = {
  improve: '@apostrophecms/global',
  fields: {
    add: {
      favicon: {
        label: 'aposFavicon:faviconFieldLabel',
        type: 'area',
        options: {
          widgets: {
            '@apostrophecms/image': {
              minSize: [ 192, 192 ],
              aspectRatio: [ 1, 1 ]
            }
          },
          max: 1
        }
      }
    },
    group: {
      favicon: {
        label: 'aposFavicon:faviconGroupLabel',
        fields: [ 'favicon' ]
      }
    }
  }
};
