// Regression tests for GHSA-x77x-88mc-36vg: the `dynamicChoices` parameter of
// the piece type REST API must not reveal the choices of a filter to the
// public API, or to a user who may not view the filtered field
// (`viewPermission`), just like the `choices` and `counts` query builders.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Pieces: dynamicChoices permissions (GHSA-x77x-88mc-36vg)', function() {
  let apos;
  const jars = {};

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              slug: 1
            }
          },
          filters: {
            add: {
              secretCategory: {
                label: 'Secret Category',
                choices: 'getSecretCategories()'
              },
              score: {
                label: 'Score',
                choices: 'getScoreChoices()'
              },
              other: {
                label: 'Other',
                choices: 'getScoreChoices()'
              }
            }
          },
          fields: {
            add: {
              secretCategory: {
                type: 'select',
                label: 'Secret Category',
                choices: 'getSecretCategories()',
                viewPermission: {
                  action: 'publish',
                  type: 'article'
                }
              },
              score: {
                type: 'select',
                label: 'Score',
                choices: 'getScoreChoices()'
              }
            }
          },
          methods(self) {
            return {
              getSecretCategories() {
                return [
                  {
                    label: 'CONFIDENTIAL-Titan',
                    value: 'titan'
                  }
                ];
              },
              getScoreChoices() {
                return [
                  {
                    label: 'High',
                    value: 'high'
                  }
                ];
              }
            };
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  function getChoices(role, dynamicChoices) {
    return apos.http.get('/api/v1/article', {
      ...(role && { jar: jars[role] }),
      qs: { dynamicChoices }
    });
  }

  it('does not run filter choices methods for the public API', async function() {
    const result = await getChoices(null, [ 'secretCategory', 'score', 'other' ]);
    assert.equal(result.choices, undefined);
    assert.ok(!JSON.stringify(result).includes('CONFIDENTIAL'));
  });

  it('does not send the choices of a filter on a field the user may not view', async function() {
    const { choices } = await getChoices('contributor', [ 'secretCategory', 'score', 'other' ]);
    assert.equal(choices.secretCategory, undefined);
    assert.deepEqual(choices.score, [ {
      label: 'High',
      value: 'high'
    } ]);
    assert.deepEqual(choices.other, choices.score);
  });

  for (const role of [ 'editor', 'admin' ]) {
    it(`sends the choices of a filter on a field the ${role} may view`, async function() {
      const { choices } = await getChoices(role, [ 'secretCategory', 'score' ]);
      assert.deepEqual(choices.secretCategory, [ {
        label: 'CONFIDENTIAL-Titan',
        value: 'titan'
      } ]);
      assert.deepEqual(choices.score, [ {
        label: 'High',
        value: 'high'
      } ]);
    });
  }

  it('still refuses an unknown filter', async function() {
    await assert.rejects(getChoices('admin', [ 'nonexistent' ]), (e) => {
      assert.equal(e.status, 400);
      return true;
    });
  });
});
