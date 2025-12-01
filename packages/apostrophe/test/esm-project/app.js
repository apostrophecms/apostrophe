export default {
  root: import.meta,
  shortName: 'esm-project',
  baseUrl: 'http://localhost:3000',
  modules: {
    '@apostrophecms/express': {
      options: {
        address: '127.0.0.1'
      }
    },
    '@apostrophecms/sitemap': {}
  }
};
