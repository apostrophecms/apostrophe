module.exports = {
  improve: '@apostrophecms/page-type',
  fields(self, options) {
    if (options.seoFields !== false) {
      return {
        add: {
          _seoCanonical: {
            label: 'aposSeo:canonical',
            type: 'relationship',
            max: 1,
            withType: '@apostrophecms/page',
            help: 'aposSeo:canonicalHelp',
            builders: {
              project: {
                title: 1,
                slug: 1,
                _url: 1
              }
            }
          }
        },
        group: {
          seo: {
            label: 'aposSeo:group',
            fields: [ '_seoCanonical' ],
            last: true
          }
        }
      };
    }
  }
};
