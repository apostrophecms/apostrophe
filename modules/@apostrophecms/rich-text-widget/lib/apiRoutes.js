const fs = require('node:fs');
const multer = require('multer');
const { pipeline } = require('stream/promises');
const { parse: csvParse } = require('csv-parse');
const { Transform } = require('stream');
const generateTable = require('./generateTiptapTable');

module.exports = self => {
  return {
    post: {
      generateCsvTable: [
        multer({ dest: require('os').tmpdir() }).single('file'),
        async (req) => {
          const file = req.file;
          if (!file) {
            throw self.apos.error('invalid', 'A file is required');
          }

          const extension = file.originalname.split('.').pop();
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
