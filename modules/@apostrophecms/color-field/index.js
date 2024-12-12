const { TinyColor } = require('@ctrl/tinycolor');
const _ = require('lodash');

module.exports = {
  options: {
    name: 'color',
    alias: 'colorFields'
  },
  init(self) {
    self.name = self.options.name;
    self.addFieldType();
    self.enableBrowserData();
    self.defaultOptions = {
      format: 'hex8',
      disableAlpha: false,
      disableFields: false,
      disableSpectrum: false,
      presetColors: [
        '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321',
        '#417505', '#BD10E0', '#9013FE', '#4A90E2', '#50E3C2',
        '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF'
      ]
    };
  },
  methods(self) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: 'color',
          async convert(req, field, data, destination) {
            destination[field.name] = self.apos.launder.string(data[field.name]);

            if (field.required && (_.isUndefined(destination[field.name]) || !destination[field.name].toString().length)) {
              throw self.apos.error('required');
            }

            const test = new TinyColor(destination[field.name]);
            if (!test.isValid && !destination[field.name].startsWith('--')) {
              destination[field.name] = null;
            }
          },
          isEmpty: function (field, value) {
            return !value.length;
          }
        });
      },
      getBrowserData(req) {
        return {
          name: self.name,
          action: self.action,
          defaultOptions: self.defaultOptions
        };
      }
    };
  }
};
