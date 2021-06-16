module.exports = (options, apos) => {
  return {
    target: 'es5',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: [
            /\/core-js($|\/)/,
            /\/regenerator-runtime($|\/)/
          ],
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      targets: {
                        browsers: '> 1%, IE 11, not dead'
                      }
                    }
                  ]
                ]
              }
            }
          ]
        }
      ]
    }
  };
};
