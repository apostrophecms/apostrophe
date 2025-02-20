const fs = require('node:fs');
const connectMultiparty = require('connect-multiparty');
const { pipeline } = require('stream/promises');
const { parse: csvParse } = require('csv-parse');
const { Transform } = require('stream');

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

          const table = generateTable(data);
          console.dir(table, { depth: 8 });
          return table;
        }
      ]
    }
  };
};

function generateTable({ header, rows }) {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        attrs: { tableHeader: true },
        content: header.map(header => ({
          type: 'tableCell',
          content: [ {
            type: 'text',
            text: header
          } ]
        }))
      },
      ...rows.map(row => ({
        type: 'tableRow',
        content: row.map(cell => ({
          type: 'tableCell',
          content: [ {
            type: 'text',
            text: cell
          } ]
        }))
      }))
    ]
  };

}
