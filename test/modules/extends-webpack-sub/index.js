module.exports = {
  extend: 'extends-webpack',
  webpack: {
    bundles: {
      'my-sub-bundle': {}
    },
    extensions: {
      ext2: {
        rules: [
          {
            test: /\.ext2$/,
            loader: 'ext2-loader',
            overriden: true
          }
        ]
      },
      ext3: {
        rules: [
          {
            test: /\.ext3$/,
            loader: 'ext3-loader'
          }
        ]
      }
    }
  }
};
