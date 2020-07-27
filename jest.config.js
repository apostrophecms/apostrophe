module.exports = {
  preset: '@vue/cli-plugin-unit-jest/presets/no-babel',
  testMatch: ['**/test/unit/**/*.spec.js'],
  globals: {
    'vue-jest': {
      babelConfig: {
        plugins: [
          'babel-plugin-transform-es2015-modules-commonjs',
          'babel-plugin-transform-object-rest-spread'
        ]
      }
    }
  },
  collectCoverage: true,
  collectCoverageFrom: ['lib/**/*.vue'],
  coverageReporters: ['html', 'text-summary']
};
