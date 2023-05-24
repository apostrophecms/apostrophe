const t = require('../../test-lib/test.js');

const apiKey = 'this is a test api key';

(async function () {
  await t.create({
    root: module,

    modules: {
      '@apostrophecms/express': {
        options: {
          apiKeys: {
            [apiKey]: {
              role: 'admin'
            }
          }
        }
      },
      malformed: {
        extend: '@apostrophecms/piece-type',
        fields: {
          add: {
            type: {
              label: 'Foo',
              type: 'string'
            }
          }
        }
      }
    }
  });
})();
