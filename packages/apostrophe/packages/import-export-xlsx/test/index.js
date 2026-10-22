const path = require('path');
const fs = require('fs');
const assert = require('assert').strict;
const xlsx = require('../lib/xlsx');

describe('@apostrophecms/import-export-xlsx', function () {
  const filepath = path.join(__dirname, 'test.xlsx');

  this.timeout(2000);

  after(() => {
    fs.unlinkSync(filepath);
  });

  describe('output', function () {
    it('should write a .xlsx file with the docs and their properties stringified', async function () {
      const docs = [
        {
          name: 'John Doe',
          age: 42,
          object: { foo: 'bar' },
          array: [ 1, 2, { foo: 'bar' } ]
        },
        {
          name: 'Jane Doe',
          age: 43,
          empty: ''
        }
      ];
      await xlsx.output(filepath, { docs });
    });
  });

  describe('input', function () {
    it('should read a .xlsx file and return the parsed docs in an object', async function () {
      const result = await xlsx.input(filepath);
      const expected = [
        {
          name: 'John Doe',
          age: 42,
          object: { foo: 'bar' },
          array: [ 1, 2, { foo: 'bar' } ]
        },
        {
          name: 'Jane Doe',
          age: 43
        }
      ];
      assert.deepEqual(result.docs, expected);
    });
  });
});
