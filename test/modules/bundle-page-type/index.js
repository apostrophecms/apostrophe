module.exports = {
  extend: '@apostrophecms/piece-page-type',
  webpack: {
    bundles: {
      main: {},
      another: {}
    }
  },
  options: {
    label: 'Bundle base page type'
  }
};
