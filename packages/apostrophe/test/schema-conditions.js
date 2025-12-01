const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

const getLib = () => import('../lib/universal/check-if-conditions.mjs');

describe('Schema - conditions', function () {
  this.timeout(t.timeout);
  let apos;

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'external-condition': {
          methods() {
            return {
              async externalCondition() {
                return 'yes';
              }
            };
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          // All kind of conditional fields with following values
          fields: {
            add: {
              conditions: {
                type: 'object',
                fields: {
                  add: {
                    optional: {
                      type: 'string'
                    },
                    showIfDeepArrLength: {
                      type: 'string',
                      required: true,
                      // String and array values are still supported
                      following: '<deepArr',
                      if: {
                        '<deepArr.length': { $gt: 0 }
                      }
                    },
                    showIfDeepArrField: {
                      type: 'string',
                      required: true,
                      // String and array values are still supported
                      following: [ '<deepArr' ],
                      if: {
                        '<deepArr.length': { $gt: 1 },
                        '<deepArr.deepArrField': 'show'
                      }
                    },
                    showIfDeepArrExactField: {
                      type: 'string',
                      required: true,
                      following: [ '<deepArr' ],
                      if: {
                        '<deepArr.1.deepArrField': 'show'
                      }
                    },
                    showIfObjField: {
                      type: 'string',
                      required: true,
                      following: [ '<deepArr' ],
                      if: {
                        '<deepArr.obj.objField': 'show'
                      }
                    },
                    showIfObjFieldAndObjArrField: {
                      type: 'string',
                      required: true,
                      following: [ '<deepArr' ],
                      if: {
                        '<deepArr.obj.objField': 'show',
                        '<deepArr.obj.objArr.objArrField': 'show'
                      }
                    },
                    crazyField: {
                      type: 'string',
                      required: true,
                      following: [ '<title', '<deepArr' ],
                      if: {
                        '<title': { $in: [ 'show', 'crazy' ] },
                        'external-condition:externalCondition()': 'yes',
                        // Same schema condition value
                        optional: { $exists: true },
                        '<deepArr.length': {
                          $gte: 2,
                          $lte: 3
                        },
                        $or: [
                          { '<deepArr.deepArrField': 'show' },
                          { '<deepArr.obj.objField': 'show' },
                          { '<deepArr.obj.objArr.objArrField': 'show' }
                        ]
                      }
                    }
                  }
                }
              },
              deepArr: {
                type: 'array',
                fields: {
                  add: {
                    deepArrField: {
                      type: 'string'
                    },
                    obj: {
                      type: 'object',
                      fields: {
                        add: {
                          objField: {
                            type: 'string'
                          },
                          objArr: {
                            type: 'array',
                            fields: {
                              add: {
                                objArrField: {
                                  type: 'string'
                                }
                              }
                            }
                          }
                        }
                      }
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

  describe('checkIfConditions (library)', function () {
    it('should match external conditions', async function () {
      const { isExternalCondition } = await getLib();
      assert.equal(isExternalCondition('externalCondition()'), true);
      assert.equal(
        isExternalCondition('external-condition:externalCondition()'),
        true
      );
      assert.equal(isExternalCondition('<followingField'), false);
      assert.equal(isExternalCondition('regularField'), false);
    });

    it('should evaluate simple conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2,
        c: 3
      };
      const conditions = {
        a: 1,
        b: 2
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
    });

    it('should evaluate nested conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: { c: 2 }
      };
      const conditions = {
        'b.c': 2
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
    });

    it('should evaluate $or conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2
      };
      const conditions = {
        $or: [
          { a: 1 },
          { b: 3 }
        ]
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
    });

    it('should evaluate $and conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2
      };
      const conditions = {
        $and: [
          { a: 1 },
          { b: 2 }
        ]
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
    });

    it('should evaluate mixed top level only $or and $and conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2,
        c: 3
      };
      const conditions = {
        $or: [
          { a: 1 },
          { b: 3 }
        ],
        $and: [
          { c: 3 },
          { b: 2 }
        ]
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = {
          $or: [
            { a: 1 },
            { b: 3 }
          ],
          $and: [
            { c: 3 },
            { b: 4 }
          ]
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $gt (greater than) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $gt: 3 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $gt: 5 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $gte (greater than or equal) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $gte: 5 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $gte: 6 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $lt (less than) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $lt: 10 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $lt: 5 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $lte (less than or equal) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $lte: 5 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $lte: 4 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $eq (equal) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $eq: 5 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $eq: 3 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $eq (equal) conditions for array values', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: [ 1, 2, 3 ] };
      const conditions = { a: { $eq: [ 2, 1, 3 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $eq: [ 1, 2 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $ne (not equal) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $ne: 3 } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $ne: 5 } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $ne (not equal) conditions for array values', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: [ 1, 2, 3 ] };
      const conditions = { a: { $ne: [ 2, 1, 3 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, false);

      {
        const conditions = { a: { $ne: [ 1, 2 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }
    });

    it('should evaluate $in conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $in: [ 3, 5, 7 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $in: [ 3, 7, 9 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $in conditions for array values', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: [ 1, 2, 3 ] };
      const conditions = { a: { $in: [ 2, 1, 3 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $in: [ 1, 2 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      {
        const conditions = { a: { $in: [ 1, 2, 3, 4 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      {
        const conditions = { a: { $in: [ 4, 5 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should throw when $in condition is not an array', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $in: 3 } };
      assert.throws(() => {
        checkIfConditions(doc, conditions);
      }, {
        name: 'Error',
        message: '$in and $nin operators require an array as condition value'
      });
    });

    it('should evaluate $nin (not in) conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $nin: [ 3, 7, 9 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $nin: [ 3, 5, 7 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate $nin (not in) conditions for array values', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: [ 1, 2, 3 ] };
      const conditions = { a: { $nin: [ 4, 5 ] } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $nin: [ 2, 1, 3 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const conditions = { a: { $nin: [ 1, 2 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const conditions = { a: { $nin: [ 1, 2, 3, 4 ] } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should throw when $nin condition is not an array', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $nin: 3 } };
      assert.throws(() => {
        checkIfConditions(doc, conditions);
      }, {
        name: 'Error',
        message: '$in and $nin operators require an array as condition value'
      });
    });

    it('should evaluate $exists conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { b: { $exists: false } };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = { a: { $exists: false } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const conditions = { a: { $exists: true } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      {
        const conditions = { b: { $exists: true } };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should match deep array and object values using dot notation', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: {
          b: [ { c: 1 }, { c: 2 } ]
        }
      };
      const conditions = {
        'a.b.c': 2
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = {
          'a.b.c': 3
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const conditions = {
          'a.b.c': { $eq: 1 }
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      // Using exact index
      {
        const conditions = {
          'a.b.0.c': 1
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      {
        const conditions = {
          'a.b.0.c': { $eq: 1 }
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, true);
      }

      {
        const conditions = {
          'a.b.0.c': 2
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should support dot notation props for strings', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: {
          b: 'test'
        }
      };
      const conditions = {
        'a.b.length': { $gt: 3 }
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
      {
        const conditions = {
          'a.b.length': { $gt: 5 }
        };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should not be able to break the app with bad props', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 'test'
      };
      const conditions = {
        'a.notAThing': 'a value'
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, false);

      {
        const doc = {
          a: {
            b: null
          }
        };
        const conditions = {
          'a.b.notAThing': 'a value'
        };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const doc = {
          a: {
            b: undefined
          }
        };
        const conditions = {
          'a.b.length': 0
        };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const doc = {
          a: {
            b: 0
          }
        };
        const conditions = {
          'a.b.length': 0
        };
        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate multiple comparison operators in a single condition', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 10,
        b: 20,
        c: 30
      };

      const conditions = {
        a: {
          $gte: 5,
          $lte: 10
        },
        b: {
          $gt: 10,
          $lt: 25
        },
        c: {
          $eq: 30,
          $ne: 25
        }
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = {
          a: {
            $gte: 5,
            $lte: 9
          },
          b: {
            $gt: 10,
            $lt: 25
          },
          c: {
            $eq: 30,
            $ne: 25
          }
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }

      {
        const conditions = {
          a: {
            $gte: 5,
            $lte: 15
          },
          b: {
            $gt: 10,
            $lt: 25
          },
          c: {
            $eq: 30,
            $ne: 30
          }
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate nested conditions', async function () {
      const { default: checkIfConditions } = await getLib();

      const doc = {
        a: 1,
        b: {
          c: [ { d: 2 }, { d: 3 } ],
          e: { f: 4 }
        },
        g: [ { h: 5 }, { h: 6 } ],
        i: 7
      };

      const conditions = {
        $and: [
          {
            $or: [
              { a: 1 },
              { 'b.c.d': { $in: [ 2, 3 ] } }
            ]
          },
          {
            $or: [
              { 'b.e.f': { $gte: 4 } },
              { 'g.h': { $nin: [ 8, 9 ] } }
            ]
          }
        ]
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = {
          $and: [
            {
              $or: [
                { a: 2 },
                { 'b.c.d': { $in: [ 2, 3 ] } }
              ]
            },
            {
              // This fails
              $or: [
                { 'b.e.f': { $gte: 5 } },
                { 'g.h': { $in: [ 8, 9 ] } }
              ]
            }
          ]
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should evaluate complex conditions', async function () {
      const { default: checkIfConditions } = await getLib();

      const doc = {
        a: 1,
        b: {
          c: [ { d: 2 }, { d: 3 } ],
          e: { f: 4 }
        },
        g: [ { h: 5 }, { h: 6 } ],
        i: 7
      };

      const conditions = {
        a: 1,
        'b.c.d': { $in: [ 2, 3 ] },
        'b.e.f': { $gte: 4 },
        'g.h': { $nin: [ 8, 9 ] },
        i: { $exists: true },
        $or: [
          { 'b.c.0.d': 2 },
          { 'g.1.h': 6 }
        ],
        $and: [
          { 'b.e.f': 4 },
          { i: { $eq: 7 } }
        ]
      };

      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);

      {
        const conditions = {
          a: 1,
          'b.c.d': { $in: [ 2, 3 ] },
          'b.e.f': { $gte: 5 },
          'g.h': { $nin: [ 8, 9 ] },
          i: { $exists: true },
          $or: [
            { 'b.c.0.d': 2 },
            { 'g.1.h': 7 }
          ],
          $and: [
            { 'b.e.f': 4 },
            { i: { $eq: 8 } }
          ]
        };

        const actual = checkIfConditions(doc, conditions);
        assert.equal(actual, false);
      }
    });

    it('should ignore external conditions', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2
      };
      const conditions = {
        a: 1,
        'externalCondition()': true
      };

      // External conditions should not affect the evaluation by default
      const actual = checkIfConditions(doc, conditions);
      assert.equal(actual, true);
    });

    it('should handle external conditions via voter function', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = {
        a: 1,
        b: 2
      };
      const conditions = {
        a: 1,
        'externalCondition()': true
      };

      // If we provide a voter function that handles external conditions,
      const evaluatedExternalCondtions = {
        'externalCondition()': false
      };
      const actual = checkIfConditions(doc, conditions, (key) => {
        if (Object.hasOwn(evaluatedExternalCondtions, key)) {
          return evaluatedExternalCondtions[key];
        }
      });
      assert.equal(actual, false);
    });

    it('should throw when unknown operator is used', async function () {
      const { default: checkIfConditions } = await getLib();
      const doc = { a: 5 };
      const conditions = { a: { $unknown: 3 } };

      assert.throws(() => {
        checkIfConditions(doc, conditions);
      }, {
        name: 'Error',
        message: 'Unsupported operator: $unknown'
      });
    });
  });

  describe('Schema conditions with following fields', function () {
    it('should ignore not visible due to following value conditions required fields', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article'
      };
      const output = {};
      await apos.schema.convert(req, schema, input, output);
      // No `required` throw
    });

    it('should show a field based on following array length', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article',
        deepArr: [
          {
            deepArrField: 'test'
          }
        ]
      };
      const output = {};
      // Throw (an array) - showIfDeepArrLength is visible and required
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;
        assert.equal(error.data.errors.length, 1);
        assert.equal(error.path, 'conditions');
        assert.equal(error.data.errors[0].path, 'showIfDeepArrLength');
        return true;
      });
    });

    it('should show a field based on following array length and field value', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article',
        deepArr: [
          {
            deepArrField: 'show'
          },
          {
            deepArrField: 'test'
          }
        ]
      };
      const output = {};
      // Throw (an array) - showIfDeepArrLength, showIfDeepArrField
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;
        assert.equal(error.data.errors.length, 2);
        const errorByValue = error.data.errors.find(e => e.path === 'showIfDeepArrField');
        const errorByLength = error.data.errors.find(e => e.path === 'showIfDeepArrLength');

        assert(errorByValue, 'showIfDeepArrField error is missing');
        assert(errorByLength, 'showIfDeepArrLength error is missing');

        return true;
      });
    });

    it('should show a field based on following array exact field value', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article',
        deepArr: [
          {
            deepArrField: 'test'
          },
          {
            deepArrField: 'show'
          }
        ]
      };
      const output = {};
      // Throw (an array) - showIfDeepArrExactField
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;
        assert.equal(error.data.errors.length, 3);
        assert.equal(error.path, 'conditions');
        const errorByValue = error.data.errors.find(e => e.path === 'showIfDeepArrField');
        const errorByExactValue = error.data.errors.find(e => e.path === 'showIfDeepArrExactField');
        const errorByLength = error.data.errors.find(e => e.path === 'showIfDeepArrLength');

        assert(errorByValue, 'showIfDeepArrField error is missing');
        assert(errorByExactValue, 'showIfDeepArrExactField error is missing');
        assert(errorByLength, 'showIfDeepArrLength error is missing');

        return true;
      });
    });

    it('should show a field based on following deep object field value', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article',
        deepArr: [
          {
            obj: {
              objField: 'test'
            }
          },
          {
            obj: {
              objField: 'show'
            }
          }
        ]
      };
      const output = {};
      // Throw (an array) - showIfObjField
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;
        assert.equal(error.data.errors.length, 2);
        assert.equal(error.path, 'conditions');

        const errorByValue = error.data.errors.find(e => e.path === 'showIfObjField');
        const errorByLength = error.data.errors.find(e => e.path === 'showIfDeepArrLength');

        assert(errorByValue, 'showIfObjField error is missing');
        assert(errorByLength, 'showIfDeepArrLength error is missing');

        return true;
      });
    });

    it('should show a field based on following deep object field and object array field values', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'Test Article',
        deepArr: [
          {
            obj: {
              objField: 'test',
              objArr: [
                { objArrField: 'test' }
              ]
            }
          },
          {
            obj: {
              objField: 'show',
              objArr: [
                { objArrField: 'show' }
              ]
            }
          }
        ]
      };
      const output = {};
      // Throw (an array) - showIfObjFieldAndObjArrField
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;

        assert.equal(error.data.errors.length, 3);
        assert.equal(error.path, 'conditions');

        const errorByObjValue = error.data.errors.find(e => e.path === 'showIfObjField');
        const errorByObjArrValue = error.data.errors.find(e => e.path === 'showIfObjFieldAndObjArrField');
        const errorByLength = error.data.errors.find(e => e.path === 'showIfDeepArrLength');

        assert(errorByLength, 'showIfDeepArrLength error is missing');
        assert(errorByObjValue, 'showIfObjField error is missing');
        assert(errorByObjArrValue, 'showIfObjFieldAndObjArrField error is missing');

        return true;
      });
    });

    it('should show a field based on complex following conditions', async function () {
      const req = apos.task.getReq();
      const schema = apos.modules.article.schema;
      const input = {
        title: 'crazy',
        conditions: {
          optional: 'it exists'
        },
        deepArr: [
          {
            deepArrField: 'test'
          },
          {
            obj: {
              objField: 'test',
              objArr: [
                { objArrField: 'show' }
              ]
            }
          }
        ]
      };
      const output = {};
      // Throw (an array) - crazyField
      await assert.rejects(async () => {
        await apos.schema.convert(req, schema, input, output);
      }, (arr) => {
        assert.equal(arr.length, 1);
        const [ error ] = arr;

        assert.equal(error.data.errors.length > 0, true);
        assert.equal(error.path, 'conditions');

        const crazyFieldError = error.data.errors.find(e => e.path === 'crazyField');
        assert(crazyFieldError, 'crazyField error is missing');

        return true;
      });
    });
  });
});
