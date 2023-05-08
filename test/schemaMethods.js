const assert = require('assert').strict;
const t = require('../test-lib/test.js');

let apos;

describe('Schema Methods', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        randomPiece: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'randomPiece'
          }
        },
        mod: {
          options: {
            alias: 'mod'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              stringField: {
                type: 'string',
                label: 'Name',
                required: true,
                pattern: /^\//
              },
              arrayField: {
                type: 'array',
                label: 'Favorite Animals',
                fields: {
                  add: {
                    name: {
                      type: 'string',
                      label: 'Name',
                      pattern: /^\//
                    },
                    type: {
                      type: 'string',
                      label: 'Type',
                      pattern: /^\//
                    }
                  }
                }
              },
              objectField: {
                type: 'object',
                label: 'Object',
                fields: {
                  add: {
                    sub1: {
                      label: 'Sub 1',
                      type: 'string',
                      pattern: /^\//
                    },
                    sub2: {
                      label: 'Sub 2',
                      type: 'string',
                      pattern: /^\//
                    }
                  }
                }
              },
              _relationshipField: {
                label: 'Relationship Field',
                type: 'relationship',
                withType: 'randomPiece',
                fields: {
                  add: {
                    relationField: {
                      label: 'Relation Field',
                      type: 'string',
                      pattern: new RegExp('^/') // eslint-disable-line
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  it('should stringify fields patterns', function() {
    const patternSringifiedSchema = apos.schema.stringifyFieldsPatterns(apos.mod.schema);
    const fieldsWithPattern = [];
    checkStringifiedField(patternSringifiedSchema);

    console.log('rn', fieldsWithPattern);
    assert.deepEqual(fieldsWithPattern, [
      'stringField',
      'name',
      'type',
      'sub1',
      'sub2',
      'relationField'
    ]);

    function checkStringifiedField(schema) {
      schema.forEach((field) => {
        if (field.schema) {
          checkStringifiedField(field.schema);
        }

        if (field.pattern) {
          assert(field.pattern === '^\\/');
          fieldsWithPattern.push(field.name);
        }
      });
    }
  });
});
