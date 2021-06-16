const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

describe('Utils', function() {

  this.timeout(t.timeout);

  let apos;

  after(() => {
    return t.destroy(apos);
  });

  it('should exist on the apos object', async () => {
    apos = await t.create({
      root: module
    });
    assert(apos.util);
  });

  // UTIL METHODS ------------------------------------------------------- //

  describe('methods', function() {

    it('generateId: should return a string of an number', function(done) {
      const id = apos.util.generateId();

      assert((typeof id) === 'string');
      assert((typeof parseInt(id)) === 'number');
      return done();
    });

    it('globalReplace: should replace multiple instances of a string', function(done) {
      const s = apos.util.globalReplace('apostrophe is for cool kids. therefore apostrophe is cool.', 'apostrophe', 'comma');

      assert(s.indexOf('apostrophe') < 0);
      assert(s.split('comma').length === 3);
      return done();
    });

    it('truncatePlaintext: should tuncate a message without cutting off a word', function(done) {
      const s = apos.util.truncatePlaintext('I want to be cut off here. This is an extra sentance.', 25);

      assert(s.indexOf('here') > 0);
      return done();
    });

    it('escapeHtml: should replace html tags with html string entites', function(done) {
      const s = apos.util.escapeHtml('<div>hello</div>');

      assert(s.indexOf('<') < 0 && s.indexOf('&lt;') >= 0);
      return done();
    });

    it('htmlToPlaintext: should strip all html notation', function(done) {
      const s = apos.util.htmlToPlaintext('<div>hello</div>');

      assert(s.indexOf('<') < 0 && s.indexOf('hello') >= 0);
      return done();
    });

    it('capitalizeFirst: should capitalize the first letter', function(done) {
      const s = apos.util.capitalizeFirst('hello');

      assert(s.indexOf('hello') < 0 && s.indexOf('H' === 0));
      return done();
    });

    it('cssName: should covert camelCase or underscore name formats to hyphenated css-style', function(done) {
      const s = apos.util.cssName('camelCase and under_score');

      assert(s.indexOf('C') < 0 && s.indexOf('_') < 0);
      assert(s.indexOf('camel-case') >= 0);
      return done();
    });

    it('cssName: should preserve double dash', function() {
      const s = apos.util.cssName('this-is--doubled');
      assert(s === 'this-is--doubled');
    });

    it('cssName: should not preserve triple dash', function() {
      const s = apos.util.cssName('this-is---tripled');
      assert(s === 'this-is--tripled');
    });

    it('camelName: should convert non digits or ASII characters to a capitalized version of the next character', function(done) {
      const s = apos.util.camelName('hello apostrophe');

      assert(s.indexOf(' ') < 0 && s.indexOf('A') === 5);
      return done();
    });

    it('addSlashIfNeeded: should add a slash "/" to the end of a path if necessary', function(done) {
      const s = apos.util.addSlashIfNeeded('/my/path');

      assert(s === '/my/path/');
      return done();
    });

    it('clonePermanent: should discard properties beginning with _ other than _id', function() {
      assert(_.isEqual(
        apos.util.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }),
        {
          tree: {
            branch: {
              leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          }
        }
      ));
    });

    it('clonePermanent with keepScalars: should discard properties beginning with _ other than _id unless they are scalars (non-objects)', function() {
      assert(_.isEqual(
        apos.util.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }, true),
        {
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true
        }
      ));
    });

    it('clonePermanent should not behave bizarrely with a test case from the punkave site', function() {
      const input = {
        attachment: {
          _id: 'a205filea1media97',
          title: 'http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30790014_5081-225x300-jpg',
          width: 225,
          height: 300,
          length: 22014,
          md5: 22014,
          extension: 'jpg',
          group: 'images',
          name: 'http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30790014_5081-225x300-jpg',
          landscape: false,
          portrait: true,
          a15Export: true,
          tags: [
            'p\'window',
            '2009'
          ],
          searchText: 'http window punkave com wp content uploads 2009 01 n56601994 30790014 5081 225x300 jpg http window punkave com wp content uploads 2009 01 n56601994 30790014 5081 225x300 jpg jpg',
          type: 'attachment'
        }
      };
      const clone = apos.util.clonePermanent(input);
      assert(clone.attachment._id === 'a205filea1media97');
    });

    it('gives sensible results for insensitiveSort', function() {
      const input = [
        'Fred',
        'dog',
        5,
        10,
        'jane'
      ];
      apos.util.insensitiveSort(input);
      assert(input.length === 5);
      assert(input[0] === 5);
      assert(input[1] === 10);
      assert(input[2] === 'dog');
      assert(input[3] === 'Fred');
      assert(input[4] === 'jane');
    });

    it('does not crash when apos.util.profile is called with two arguments', function() {
      apos.util.profile(apos.task.getReq(), 'this.is.a.path')();
      assert(true);
    });

    it('does not crash when apos.util.profile is called with three arguments', function() {
      apos.util.profile(apos.task.getReq(), 'this.is.a.path', 100);
      assert(true);
    });

    it('does not crash when apos.util.profile is called with one argument (no req arg)', function() {
      apos.util.profile('this.is.a.path')();
      assert(true);
    });

    it('does not crash when apos.util.profile is called with two arguments (no req arg)', function() {
      apos.util.profile('this.is.a.path', 100);
      assert(true);
    });

    it('can get a top level property with utils.get', () => {
      const data = {
        age: 5
      };
      assert(apos.util.get(data, 'age') === 5);
    });

    it('can set a top level property with utils.set', () => {
      const data = {
        age: 5
      };
      apos.util.set(data, 'age', 7);
      assert(data.age === 7);
    });

    it('can get a nested property with utils.get', () => {
      const data = {
        shoe: {
          size: 5
        }
      };
      assert(apos.util.get(data, 'shoe.size') === 5);
    });

    it('can set a nested property with utils.set', () => {
      const data = {
        shoe: {
          size: 5
        }
      };
      apos.util.set(data, 'shoe.size', 7);
      assert(data.shoe.size === 7);
    });

    it('can get a nested property with utils.get', () => {
      const data = {
        shoe: {
          size: 5
        }
      };
      assert(apos.util.get(data, 'shoe.size') === 5);
    });

    it('can get a nested array property with utils.get', () => {
      const data = {
        shoe: {
          laces: [
            'intact',
            'busted'
          ]
        }
      };
      assert(apos.util.get(data, 'shoe.laces.0', 'intact'));
    });

    it('can set a nested array property with utils.set', () => {
      const data = {
        shoe: {
          laces: [
            'intact',
            'busted'
          ]
        }
      };
      apos.util.set(data, 'shoe.laces.0', 'gnarly');
      assert(data.shoe.laces[0] === 'gnarly');
    });

    it('can get a subobject with @ syntax', () => {
      const data = {
        shoes: [
          {
            _id: 'stylin'
          },
          {
            _id: 'busted'
          }
        ]
      };
      assert(apos.util.get(data, '@stylin')._id === 'stylin');
    });

    it('can update a subobject property with @ syntax', () => {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      apos.util.set(data, '@stylin.size', 7);
      assert(data.shoes[0]._id === 'stylin');
      assert.strictEqual(data.shoes[0].size, 7);
    });

    it('can get a subobject property with @ syntax', () => {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      assert(apos.util.get(data, '@stylin.size') === 5);
    });

    it('can replace a subobject with @ syntax', () => {
      const data = {
        shoes: [
          {
            _id: 'stylin',
            size: 5
          },
          {
            _id: 'busted',
            size: 6
          }
        ]
      };
      apos.util.set(data, '@stylin', {
        _id: 'stylin',
        size: 8
      });
      assert(data.shoes[0].size === 8);
    });

  });
});
