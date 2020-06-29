module.exports = (options, apos) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['vue-style-loader', 'css-loader']
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                plugins: () => [require('autoprefixer')]
              }
            },
            {
              loader: 'sass-loader',
              options: {
                prependData: `
@import "./node_modules/apostrophe/lib/modules/@apostrophecms/ui/scss/imports";
              `
              }
            }
          ]
        }
      ]
    },
    plugins: [
    ]
  };
};
