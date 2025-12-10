module.exports = {
  improve: '@apostrophecms/doc-type',
  fields(self, options) {
    if (options.openGraph !== false) {
      return {
        add: {
          openGraphTitle: {
            label: 'aposOg:title',
            type: 'string',
            help: 'aposOg:titleHelp'
          },
          openGraphDescription: {
            label: 'aposOg:description',
            type: 'string',
            textarea: true,
            help: 'aposOg:descriptionHelp'
          },
          openGraphType: {
            label: 'aposOg:type',
            type: 'string',
            htmlHelp: 'aposOg:typeHelp'
          },
          // TODO this needs minSize and aspectRatio options when they exist
          _openGraphImage: {
            type: 'relationship',
            label: 'aposOg:image',
            max: 1,
            withType: '@apostrophecms/image'
          }
        },
        group: {
          openGraph: {
            label: 'aposOg:group',
            fields: [
              'openGraphTitle',
              'openGraphDescription',
              'openGraphType',
              '_openGraphImage'
            ],
            last: true
          }
        }
      };
    }
  }
};
