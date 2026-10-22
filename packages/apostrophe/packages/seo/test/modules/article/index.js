module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    alias: 'article'
  },
  fields: {
    add: {
      _featuredImage: {
        label: 'Featured Image',
        type: 'relationship',
        withType: '@apostrophecms/image',
        max: 1
      },
      publishedAt: {
        label: 'Publication Date',
        type: 'date'
      },
      author: {
        label: 'Author',
        type: 'string'
      }
    }
  }
};
