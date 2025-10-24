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
      presetColors: [ '#f9c80e', '#f86624', '#ea3546', '#662e9b', '#43bccd' ]
    };
  },
  methods(self) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: 'color',
          async convert(req, field, data, destination) {
            destination[field.name] = self.apos.launder.string(data[field.name]);

            const isUndefined = _.isUndefined(destination[field.name]) ||
              !destination[field.name].toString().length;
            if (field.required && isUndefined) {
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
