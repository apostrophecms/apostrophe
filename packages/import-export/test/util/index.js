const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const FormData = require('form-data');
const { output: gzip } = require('../../lib/formats/gzip.js');

module.exports = {
  getAppConfig,
  extractFileNames,
  getExtractedFiles,
  buildFixtures,
  copyFixtures,
  cleanFixtures,
  cleanData,
  deletePiecesAndPages,
  deleteAttachments,
  insertPiecesAndPages,
  login,
  insertAdminUser
};

function getAppConfig(modules = {}, options = {}) {
  return {
    '@apostrophecms/express': {
      options: {
        session: { secret: 'supersecret' }
      }
    },
    '@apostrophecms/import-export': {},
    '@apostrophecms/uploadfs': {
      options: {
        storage: 'local'
      }
    },
    'home-page': {
      extend: '@apostrophecms/page-type'
    },
    'default-page': {
      extend: '@apostrophecms/page-type',
      fields: {
        add: {
          main: {
            label: 'Main',
            type: 'area',
            options: {
              widgets: {
                '@apostrophecms/rich-text': {},
                '@apostrophecms/image': {},
                '@apostrophecms/video': {}
              },
              importAsRichText: true
            }
          },
          _articles: {
            label: 'Articles',
            type: 'relationship',
            withType: 'article'
          }
        }
      }
    },
    nonLocalized: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'nonLocalized',
        localized: false
      }
    },
    article: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'article',
        autopublish: options.autopublish ?? true
      },
      fields: {
        add: {
          image: {
            type: 'attachment',
            group: 'images'
          },
          _topics: {
            label: 'Topics',
            type: 'relationship',
            withType: 'topic',
            builders: {
              project: {
                title: 1,
                image: 1,
                main: 1,
                aposMode: 1
              }
            }
          },
          main: {
            label: '',
            type: 'area',
            options: {
              widgets: {
                '@apostrophecms/image': {}
              }
            }
          }
        }
      }
    },

    topic: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'topic'
      },
      fields: {
        add: {
          description: {
            label: 'Description',
            type: 'string'
          },
          main: {
            label: 'Main',
            type: 'area',
            options: {
              widgets: {
                '@apostrophecms/rich-text': {}
              },
              importAsRichText: true
            }
          },
          _topics: {
            label: 'Related Topics',
            type: 'relationship',
            withType: 'topic',
            max: 2
          }
        }
      }
    },

    ...modules
  };
}

function extractFileNames (files) {
  return files.map((fullname) => {
    const regex = /-([\w\d-]+)\./;
    const [ , name ] = regex.exec(fullname);

    return name;
  });
}

async function getExtractedFiles(extractPath) {
  const docsData = await fs.readFile(
    path.join(extractPath, 'aposDocs.json'),
    { encoding: 'utf8' }
  );

  const attachmentsData = await fs.readFile(
    path.join(extractPath, 'aposAttachments.json'),
    { encoding: 'utf8' }
  );

  const attachmentFiles = await fs.readdir(path.join(extractPath, 'attachments'));

  return {
    docs: JSON.parse(docsData),
    attachments: JSON.parse(attachmentsData),
    attachmentFiles
  };
}

async function buildFixtures(apos) {
  const target = path.join(apos.rootDir, 'data/tmp/uploads');
  const directories = (await fs.readdir(path.join(target, 'gzip'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory());
  for (const directory of directories) {
    const { default: docs } = await import(
      path.join(directory.parentPath, directory.name, 'aposDocs.json'),
      { with: { type: 'json' } }
    );
    const { default: attachments } = await import(
      path.join(directory.parentPath, directory.name, 'aposAttachments.json'),
      { with: { type: 'json' } }
    );
    await gzip(
      path.join(target, `${directory.name}.tar.gz`),
      {
        docs,
        attachments
      },
      async () => {}
    );
  }
}

async function copyFixtures(apos) {
  const source = path.join(apos.rootDir, 'fixtures');
  const target = path.join(apos.rootDir, 'data/tmp/uploads');

  await fs.cp(source, target, { recursive: true });
}

async function cleanFixtures(apos) {
  const target = path.join(apos.rootDir, 'data/tmp/uploads');

  await cleanData([ target ]);
}

async function cleanData(paths) {
  for (const filePath of paths) {
    try {
      const files = await fs.readdir(filePath);
      for (const name of files) {
        await fs.rm(path.join(filePath, name), { recursive: true });
      }
    } catch (error) {
      console.error(error); // eslint-disable-line no-console
    }
  }
}

async function deletePiecesAndPages(apos) {
  await apos.doc.db.deleteMany({ type: /default-page|article|topic|@apostrophecms\/image/ });
}

async function deleteAttachments(apos, attachmentPath) {
  await apos.attachment.db.deleteMany({});
  await cleanData([ attachmentPath ]);
}

async function insertPiecesAndPages(apos) {
  const req = apos.task.getReq();

  const formData = new FormData();
  formData.append(
    'file',
    createReadStream(path.join(apos.rootDir, '/public/test-image.jpg'))
  );

  const jar = await login(apos.http);

  const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
    body: formData,
    jar
  });

  await apos.nonLocalized.insert(req, {
    ...apos.nonLocalized.newInstance(),
    title: 'nonLocalized1'
  });

  const image1 = await apos.image.insert(req, {
    ...apos.image.newInstance(),
    title: 'image1',
    attachment
  });

  const topic3 = await apos.topic.insert(req, {
    ...apos.topic.newInstance(),
    title: 'topic3'
  });

  const topic2 = await apos.topic.insert(req, {
    ...apos.topic.newInstance(),
    title: 'topic2'
  });

  const topic1 = await apos.topic.insert(req, {
    ...apos.topic.newInstance(),
    title: 'topic1',
    _topics: [ topic3 ]
  });

  await apos.article.insert(req, {
    ...apos.article.newInstance(),
    title: 'article1',
    _topics: [ topic2 ],
    image: attachment
  });

  const article2 = await apos.article.insert(req, {
    ...apos.article.newInstance(),
    title: 'article2',
    _topics: [ topic1 ]
  });

  const pageInstance = await apos.http.post('/api/v1/@apostrophecms/page', {
    body: {
      _newInstance: true
    },
    jar
  });

  await apos.page.insert(req, '_home', 'lastChild', {
    ...pageInstance,
    title: 'page1',
    type: 'default-page',
    _articles: [ article2 ],
    main: {
      _id: 'areaId',
      items: [
        {
          _id: 'cllp5ubqk001320613gaz2vmv',
          metaType: 'widget',
          type: '@apostrophecms/image',
          aposPlaceholder: false,
          imageIds: [ image1.aposDocId ],
          imageFields: {
            [image1.aposDocId]: {
              top: null,
              left: null,
              width: null,
              height: null,
              x: null,
              y: null
            }
          }
        }
      ],
      metaType: 'area'
    }
  });
}

async function login(http, username = 'admin') {
  const jar = http.jar();

  await http.post('/api/v1/@apostrophecms/login/login', {
    body: {
      username,
      password: username,
      session: true
    },
    jar
  });

  const loggedPage = await http.get('/', {
    jar
  });

  assert(loggedPage.match(/logged in/));

  return jar;
}

async function insertAdminUser(apos) {
  const user = {
    ...apos.user.newInstance(),
    title: 'admin',
    username: 'admin',
    password: 'admin',
    role: 'admin'
  };

  await apos.user.insert(apos.task.getReq(), user);
}
