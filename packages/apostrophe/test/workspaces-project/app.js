module.exports = {
  root: module,
  shortName: 'workspaces-project',
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
