const fs = require('node:fs');
const { unlink } = require('node:fs/promises');
const multer = require('multer');
const { pipeline } = require('stream/promises');
const { parse: csvParse } = require('csv-parse');
const { Transform } = require('stream');
const generateTable = require('./generateTiptapTable');

module.exports = self => {
  const upload = multer({
    dest: require('os').tmpdir(),
    limits: {
      fileSize: self.options.csvTableMaxSize,
      files: 1
    }
  }).single('file');
  return {
    post: {
      generateCsvTable: [
        // Only users who can upload attachments (the same users who can
        // edit rich text) may use this route. Checked before multer so
        // that nothing is written to disk for anyone else
        (req, res, next) => self.apos.attachment.canUpload(req, res, next),
        (req, res, next) => upload(req, res, (err) => {
          if (err) {
            // multer removes its own partial files on error
            return res.status(400).send({
              name: 'invalid',
              message: err.code === 'LIMIT_FILE_SIZE'
                ? 'The file is too large'
                : 'Invalid upload'
            });
          }
          return next();
        }),
        async (req) => {
          try {
            return await generateCsvTable(req);
          } finally {
            if (req.file) {
              try {
                await unlink(req.file.path);
              } catch (e) {
                // OK if it is already gone
              }
            }
          }
        }
      ]
    }
  };

  async function generateCsvTable(req) {
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
};
