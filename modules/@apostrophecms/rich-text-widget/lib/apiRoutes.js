const fs = require('node:fs');
const connectMultiparty = require('connect-multiparty');
const { pipeline } = require('stream/promises');
const { parse: csvParse } = require('csv-parse');
const { Transform } = require('stream');
const generateTable = require('./generateTiptapTable');

module.exports = self => {
  return {
    post: {
      generateCsvTable: [
        connectMultiparty(),
        async (req) => {
          const { file } = req.files || {};
          if (!file) {
            throw self.apos.error('invalid', 'A file is required');
          }

          const extension = file.name.split('.').pop();
          if (extension !== 'csv') {
            throw self.apos.error('invalid', 'Only csv files are supported');
          }

          const data = {
            header: [],
            rows: []
          };
          await pipeline(
            fs.createReadStream(file.path),
            csvParse({
              columns: headers => {
                data.header = headers;
                return headers;
              }
            }),
            new Transform({
              objectMode: true,
              transform: function (record, encoding, callback) {
                const row = Object.values(record);
                data.rows.push(row);
                callback();
              }
            })
          );

          return generateTable(data);
        }
      ]
    }
  };
};
