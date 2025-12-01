const gzip = require('./gzip');
const csv = require('./csv');

// Keep gzip at the top of the list so it's the default format
module.exports = {
  gzip,
  csv
};
