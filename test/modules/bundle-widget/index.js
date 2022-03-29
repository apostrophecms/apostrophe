module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Bundle Widget'
  },
  webpack: {
    bundles: {
      'extra-bundle2': {}
    }
  }
};
