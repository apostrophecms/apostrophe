module.exports = {
  instantiate: false,
  webpack: {
    extensions: {
      ext1: {
        rules: [
          {
            test: /\.ext$/,
            loader: 'ext-loader'
          }
        ]
      },
      ext2: {
        rules: [
          {
            test: /\.ext2$/,
            loader: 'ext2-loader'
          }
        ]
      }
    }
  }
};
