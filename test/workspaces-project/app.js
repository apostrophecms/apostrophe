module.exports = {
  root: module,
  shortName: 'workspaces-project',
  modules: {
    '@apostrophecms/express': {
      options: {
        address: '127.0.0.1'
      }
    },
    '@apostrophecms/sitemap': {
      options: {
        baseUrl: 'http://localhost:3000'
      }
    }
  }
};
