const fs = require('node:fs');
const { stringify } = require('csv-stringify');
const { parse } = require('csv-parse');

module.exports = {
  label: 'CSV',
  extension: '.csv',
  allowedExtension: '.csv',
  allowedTypes: [ 'text/csv' ],
  async input(filepath) {
    const reader = fs.createReadStream(filepath);
    const parser = reader
      .pipe(
        parse({
          columns: true,
          bom: true,
          cast(value, context) {
            if (context.header) {
              return value;
            }

            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
        })
      );

    const docs = [];

    parser.on('readable', function() {
      let doc;
      while ((doc = parser.read()) !== null) {
        docs.push(doc);
      }
    });

    return new Promise((resolve, reject) => {
      reader.on('error', reject);
      parser.on('error', reject);
      parser.on('end', () => {
        console.info(`[csv] docs read from ${filepath}`);
        resolve({ docs });
      });
    });
  },
  async output(filepath, { docs }) {
    const writer = fs.createWriteStream(filepath);
    const stringifier = stringify({
      header: true,
      columns: getColumnsNames(docs),
      cast: {
        date(value) {
          return value.toISOString();
        },
        boolean(value) {
          return value ? 'true' : 'false';
        }
      }
    });

    stringifier.pipe(writer);

    // plunge each doc into the stream
    docs.forEach(record => {
      stringifier.write(record);
    });

    stringifier.end();

    return new Promise((resolve, reject) => {
      stringifier.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', () => {
        console.info(`[csv] export file written to ${filepath}`);
        resolve();
      });
    });
  }
};

function getColumnsNames(docs) {
  const columns = new Set();
  docs.forEach(doc => {
    Object.keys(doc).forEach(key => columns.add(key));
  });
  return Array.from(columns);
}
