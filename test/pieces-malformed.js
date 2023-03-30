const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;
const apiKey = 'this is a test api key';

describe('Pieces malformed', function () {
  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  it('should not initialize with a forbidden field schema name', async function () {
    const actual = async () => {
      apos = await t.create({
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
                  label: 'Type',
                  type: 'string'
                }
              }
            }
          }
        }
      });
      assert(false);
    };

    const expected = new Error('@apostrophecms/piece-type field property name cannot be "type"');

    assert.rejects(actual, expected);
  });

  it('should initialize with a good field schema name', async function () {
    const actual = async () => {
      apos = await t.create({
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
                author: {
                  label: 'Type',
                  type: 'string'
                }
              }
            }
          }
        }
      });
      assert(false);
    };

    const expected = new Error('@apostrophecms/piece-type field property name cannot be "type"');

    assert.rejects(actual, expected);
  });
});
