const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const stream = require('node:stream/promises');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const { EJSON } = require('bson');

module.exports = {
  label: 'gzip',
  extension: '.tar.gz',
  allowedExtension: '.gz',
  allowedTypes: [
    'application/gzip',
    'application/x-gzip'
  ],
  includeAttachments: true,
  async input(filepath) {
    let exportPath = filepath;

    // If the given path is actually the archive, we first need to extract it.
    // Then we no longer need the archive file, so we remove it.
    if (filepath.endsWith(this.allowedExtension)) {
      exportPath = filepath.replace(this.allowedExtension, '');

      await extract(filepath, exportPath);

      await remove(filepath);
    }

    const docsPath = path.join(exportPath, 'aposDocs.json');
    const attachmentsPath = path.join(exportPath, 'aposAttachments.json');
    const attachmentFilesPath = path.join(exportPath, 'attachments');

    const docs = await fsp.readFile(docsPath);
    const attachments = await fsp.readFile(attachmentsPath);

    const parsedDocs = EJSON.parse(docs);
    const parsedAttachments = EJSON.parse(attachments);

    const attachmentsInfo = parsedAttachments.map(attachment => {
      // The archive is parsed with EJSON, which can revive objects such as
      // `{ $ne: null }`. Require the identity fields to be plain strings so
      // they cannot (a) smuggle a MongoDB query operator into the later
      // `attachment.db.findOne({ _id })` lookup, nor (b) coerce into an
      // unexpected on-disk path below.
      if (
        typeof attachment._id !== 'string' ||
        typeof attachment.name !== 'string' ||
        typeof attachment.extension !== 'string'
      ) {
        throw new Error('Invalid attachment metadata in import archive: _id, name and extension must be strings');
      }

      const filename = `${attachment._id}-${attachment.name}.${attachment.extension}`;
      const filePath = path.join(attachmentFilesPath, filename);

      // Guard against path traversal (GHSA-79qf-vqgc-7xx3): the `_id`, `name`
      // and `extension` fields come straight from the untrusted archive, so a
      // `../` sequence (or an absolute path) could otherwise point `file.path`
      // at an arbitrary host file, which would then be read and copied into the
      // public uploads directory. Reject any entry whose reconstructed source
      // path escapes the extraction's attachments directory. The tar entry
      // names are guarded separately in `extract()` above.
      const base = path.resolve(attachmentFilesPath) + path.sep;
      if (!path.resolve(filePath).startsWith(base)) {
        throw new Error(`Invalid attachment path in import archive: ${filename}`);
      }

      return {
        attachment,
        file: {
          name: `${attachment.name}.${attachment.extension}`,
          path: filePath
        }
      };
    });

    return {
      docs: parsedDocs,
      attachmentsInfo,
      exportPath
    };
  },
  async output(
    filepath,
    {
      docs,
      attachments = [],
      attachmentUrls = {}
    },
    processAttachments
  ) {
    const data = {
      json: {
        'aposDocs.json': EJSON.stringify(docs, undefined, 2),
        'aposAttachments.json': EJSON.stringify(attachments, undefined, 2)
      },
      attachments: attachmentUrls
    };

    const writeStream = fs.createWriteStream(filepath);
    const pack = tar.pack();
    const gzip = zlib.createGzip();

    pack
      .pipe(gzip)
      .pipe(writeStream);

    let result;

    return new Promise((resolve, reject) => {
      writeStream.on('error', reject);
      gzip.on('error', reject);
      pack.on('error', reject);

      writeStream.on('finish', () => {
        resolve(result);
      });

      for (const [ filename, content ] of Object.entries(data.json || {})) {
        addTarEntry(pack, { name: filename }, content).catch(reject);
      }

      addTarEntry(pack, {
        name: 'attachments/',
        type: 'directory'
      })
        .then(() => {
          processAttachments(data.attachments, async (attachmentPath, name, size) => {
            const readStream = fs.createReadStream(attachmentPath);
            const entryStream = pack.entry({
              name: `attachments/${name}`,
              size
            });

            await stream.pipeline([ readStream, entryStream ]);
          })
            .then((res) => {
              result = res;
              pack.finalize();
            });
        })
        .catch(reject);
    });
  }
};

async function extract(filepath, exportPath) {
  if (fs.existsSync(exportPath)) {
    return;
  }

  await fsp.mkdir(exportPath);

  const readStream = fs.createReadStream(filepath);
  const gunzip = zlib.createGunzip();
  const extract = tar.extract();

  readStream
    .pipe(gunzip)
    .pipe(extract);

  return new Promise((resolve, reject) => {
    readStream.on('error', reject);
    gunzip.on('error', reject);
    extract.on('error', reject);

    extract.on('entry', (header, stream, next) => {
      // Normalize \ to / before checking for zip-slip
      const name = header.name.replace(/\\/g, '/');
      if (name.includes('../')) {
        // Reject zip-slip attacks without revealing information. Discard any
        // body and ALWAYS advance to the next entry. Directory entries carry
        // no body but tar-stream still requires next() to be called; skipping
        // it (as a previous version did for directories) stalls the whole
        // extraction, hanging the import indefinitely (a denial of service).
        stream.on('end', next);
        stream.resume();
        return;
      }
      if (header.type === 'directory') {
        fsp
          .mkdir(path.join(exportPath, name))
          .then(next)
          .catch(reject);
      } else {
        stream.pipe(fs.WriteStream(path.join(exportPath, name)));
        stream.on('end', next);
      }
    });
    extract.on('finish', resolve);
  });
}

// This independent function is designed for file removal.
// Avoid invoking `self.remove` within this script,
// as it should remain separate from the apos context.
async function remove(filepath) {
  try {
    await fsp.unlink(filepath);
  } catch (error) {
    console.error(error);
  }
}

function addTarEntry(pack, options, data = null) {
  return new Promise((resolve, reject) => {
    pack.entry(options, data, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
