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

      console.info(`[gzip] extracting ${filepath} into ${exportPath}`);
      await extract(filepath, exportPath);

      console.info(`[gzip] removing ${filepath}`);
      await remove(filepath);
    }

    const docsPath = path.join(exportPath, 'aposDocs.json');
    const attachmentsPath = path.join(exportPath, 'aposAttachments.json');
    const attachmentFilesPath = path.join(exportPath, 'attachments');

    console.info(`[gzip] reading docs from ${docsPath}`);
    console.info(`[gzip] reading attachments from ${attachmentsPath}`);
    console.info(`[gzip] reading attachment files from ${attachmentFilesPath}`);

    const docs = await fsp.readFile(docsPath);
    const attachments = await fsp.readFile(attachmentsPath);

    const parsedDocs = EJSON.parse(docs);
    const parsedAttachments = EJSON.parse(attachments);

    const attachmentsInfo = parsedAttachments.map(attachment => ({
      attachment,
      file: {
        name: `${attachment.name}.${attachment.extension}`,
        path: path.join(attachmentFilesPath, `${attachment._id}-${attachment.name}.${attachment.extension}`)
      }
    }));

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
        console.info(`[gzip] export file written to ${filepath}`);
        resolve(result);
      });

      for (const [ filename, content ] of Object.entries(data.json || {})) {
        console.info(`[gzip] adding ${filename} to the tarball`);
        addTarEntry(pack, { name: filename }, content).catch(reject);
      }

      addTarEntry(pack, {
        name: 'attachments/',
        type: 'directory'
      })
        .then(() => {
          processAttachments(data.attachments, async (attachmentPath, name, size) => {
            console.info(`[gzip] adding attachments/${name} to the tarball`);

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
      if (header.type === 'directory') {
        fsp
          .mkdir(path.join(exportPath, header.name))
          .then(next)
          .catch(reject);
      } else {
        stream.pipe(fs.WriteStream(path.join(exportPath, header.name)));
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
