// Shared helpers and fixtures for the document versions tests

const path = require('path');
const fs = require('fs-extra');
const t = require('../../test-lib/test.js');

const moduleName = '@apostrophecms/document-versions';
const uploadSource = path.join(__dirname, '../data/upload_tests/');
const uploadTarget = path.join(__dirname, '../public/uploads/');

const fields = {
  main: {
    type: 'area',
    label: 'Main',
    options: {
      widgets: {
        '@apostrophecms/image': {},
        '@apostrophecms/video': {},
        '@apostrophecms/rich-text': {}
      }
    }
  },
  _related: {
    label: 'Related articles',
    type: 'relationship',
    withType: 'article'
  },
  int: {
    label: 'Integer',
    type: 'integer'
  },
  float: {
    label: 'Float',
    type: 'float'
  },
  boolean: {
    label: 'Boolean',
    type: 'boolean'
  },
  attachment: {
    label: 'Resume',
    type: 'attachment',
    fileGroup: 'office'
  },
  array: {
    label: 'Contact information',
    type: 'array',
    titleField: 'label',
    fields: {
      add: {
        label: {
          type: 'string',
          label: 'Label'
        },
        value: {
          type: 'string',
          label: 'Value'
        }
      }
    }
  },
  date: {
    label: 'Date',
    type: 'date'
  },
  time: {
    label: 'Time',
    type: 'time'
  },
  object: {
    label: 'Object',
    type: 'object',
    fields: {
      add: {
        key1: {
          type: 'string',
          label: 'Key1'
        },
        key2: {
          type: 'string',
          label: 'Key2'
        }
      }
    }
  }
};

const group = {
  basics: {
    label: 'Basics',
    fields: [
      'main',
      '_related',
      'int',
      'float',
      'boolean',
      'attachment',
      'array',
      'date',
      'time',
      'object'
    ]
  }
};

// Doc type fixtures. A test names the ones it wants in `modules`
// and may pass `options` or `fields` overrides for each.
const fixtures = {
  article: {
    extend: '@apostrophecms/piece-type',
    options: {
      label: 'Article',
      pluralLabel: 'Articles',
      alias: 'article'
    },
    fields: {
      add: fields,
      group
    }
  },
  'article-page': {
    extend: '@apostrophecms/piece-page-type',
    options: {
      label: 'Article Index Page',
      pluralLabel: 'Article Index Pages',
      alias: 'articlePage'
    },
    fields: {
      add: fields,
      group
    }
  },
  'default-page': {
    extend: '@apostrophecms/page-type',
    options: {
      label: 'Default Page',
      pluralLabel: 'Default Pages'
    },
    fields: {
      add: fields,
      group
    }
  },
  'module-autopublish_true': {
    extend: '@apostrophecms/piece-type',
    options: {
      autopublish: true
    }
  },
  'module-autopublish_true-versions_true': {
    extend: '@apostrophecms/piece-type',
    options: {
      autopublish: true,
      versions: true
    }
  },
  'module-versions_false': {
    extend: '@apostrophecms/piece-type',
    options: {
      versions: false
    }
  }
};

function withFixture(name, override = {}) {
  const fixture = fixtures[name];
  if (!fixture) {
    return override;
  }
  return {
    ...fixture,
    ...override,
    options: {
      ...fixture.options,
      ...override.options
    },
    ...((fixture.fields || override.fields) && {
      fields: {
        ...fixture.fields,
        ...override.fields,
        add: {
          ...fixture.fields?.add,
          ...override.fields?.add
        }
      }
    })
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `root` is the calling test's `module`, so fixtures resolve from `test/`
async function bootstrap(config = {}) {
  const { modules = {}, ...rest } = config;
  return t.create({
    ...rest,
    modules: {
      '@apostrophecms/page': {
        options: {
          types: [
            {
              name: 'default-page',
              label: 'Default page'
            },
            {
              name: '@apostrophecms/home-page',
              label: 'Home page'
            }
          ]
        }
      },
      ...Object.fromEntries(
        Object.entries(modules)
          .map(([ name, override ]) => [ name, withFixture(name, override) ])
      )
    }
  });
}

async function destroy(apos) {
  if (apos) {
    await t.destroy(apos);
  }
}

function getReq(apos, config = {}) {
  const {
    _id = 'userId',
    title = 'user',
    username = 'username',
    ...rest
  } = config;
  const req = apos.task.getReq(rest);
  req.user = {
    ...req.user,
    _id,
    title,
    username
  };
  return req;
}

async function removeUploads() {
  await fs.remove(uploadTarget);
}

async function cleanup(apos) {
  await removeUploads();
  await apos.doc.db.deleteMany({
    type: {
      $not: {
        $in: [
          '@apostrophecms/home-page',
          '@apostrophecms/global',
          '@apostrophecms/user'
        ]
      }
    }
  });
  await apos.docVersions.db.deleteMany({});
  await apos.attachment.db.deleteMany({});
}

async function upload(filename, apos) {
  return apos.attachment.insert(getReq(apos), {
    name: filename,
    path: `${uploadSource}${filename}`
  });
}

async function addUser(apos, role, { username, password } = {}) {
  const name = username || role;
  return t.createUser(apos, role, {
    username: name,
    title: name,
    password: password || 'password',
    email: `${name}@example.com`
  });
}

async function login(apos, role, { username, password } = {}) {
  return t.loginAs(apos, username || role, password || 'password');
}

async function seedVersionsFor(apos, docInstance, count) {
  const req = getReq(apos);
  const doc = await apos.doc.getManager(docInstance.type).insert(req, {
    ...docInstance,
    title: docInstance.title + ' 1'
  });
  const first = await apos.docVersions.findOne(
    getReq(apos),
    apos.docVersions.getTimelineCriteria(doc)
  );

  const promises = [];
  for (let index = 2; index <= count; index++) {
    // ensure proper sort
    await wait(5);
    promises.push(apos.docVersions.createFor(req, {
      ...doc,
      title: docInstance.title + ' ' + index
    }));
  }

  const versions = await Promise.all(promises);
  return {
    doc,
    versions: [ ...versions.reverse(), first ]
  };
}

module.exports = {
  t,
  moduleName,
  bootstrap,
  destroy,
  cleanup,
  removeUploads,
  wait,
  getReq,
  upload,
  addUser,
  login,
  seedVersionsFor
};
