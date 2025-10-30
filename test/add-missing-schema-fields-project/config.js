export default {
  root: import.meta,
  shortName: 'add-missing-schema-fields-project',
  baseUrl: 'http://localhost:3000',
  modules: {
    '@apostrophecms/express': {
      options: {
        address: '127.0.0.1'
      }
    },
    product: {}
  }
};
