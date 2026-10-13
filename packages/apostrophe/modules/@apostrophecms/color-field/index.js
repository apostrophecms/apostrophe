const { TinyColor } = require('@ctrl/tinycolor');
const _ = require('lodash');

// TinyColor finds functional notations like rgb() anywhere in the string,
// so the whole value must also have the shape of a color
const colorShape = /^\s*(?:#?[0-9a-f]{3,8}|[a-z]+|(?:rgba?|hsla?|hsva?|cmyk)[\s(][-+0-9.%,\s/]*\)?)\s*$/i;

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

            const isVariable = destination[field.name].startsWith('--');
            const test = new TinyColor(destination[field.name]);
            const isColor = test.isValid && colorShape.test(destination[field.name]);
            if (!isColor && !isVariable) {
              destination[field.name] = null;
            } else if (isVariable) {
              // CSS custom property names: only allow alphanumeric, hyphens, underscores
              if (!/^--[a-zA-Z0-9_-]+$/.test(destination[field.name])) {
                destination[field.name] = null;
              }
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
