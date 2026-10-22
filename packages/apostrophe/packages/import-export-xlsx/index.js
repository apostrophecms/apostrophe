const xlsx = require('./lib/xlsx');

module.exports = {
  improve: '@apostrophecms/import-export',
  init(self) {
    self.registerFormats({ xlsx });
  }
};
