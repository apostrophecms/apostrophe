let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');
let request = require('request');
let async = require('async');

let apos;

describe('Tags', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async () => {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          options: {
            secret: 'xxx',
            port: 7900,
            csrf: {
              // We're not here to test CSRF, so make the test simpler
              exceptions: [ '/modules/apostrophe-tags/autocomplete' ]
            }
          }
        },
        'events': {
          extend: 'apostrophe-pieces',
          options: {
            name: 'event'
          }
        }
      }
    });
    assert(apos.tags);
  });

  it('should insert some docs to test itself', async () => {
    let testDocs = [
      {
        title: 'Tag Test Doc 1',
        slug: '/tag-test-doc-1',
        published: true,
        tags: ['tag1', 'tag2', 'agressive'],
        type: 'default'
      },
      {
        title: 'Tag Test Doc 2',
        slug: '/tag-test-doc-2',
        published: true,
        tags: ['tag3', 'tag4', 'pizza'],
        type: 'default'
      },
      {
        title: 'Tag Test Doc Event',
        type: 'event',
        slug: 'tag-test-doc-event',
        published: true,
        tags: ['featured event']
      }
    ];

    for (const doc of testDocs) {
      await apos.docs.insert(apos.tasks.getReq(), doc);
    }
  });

  it('should have a listTags method that returns a list of tags', async() => {
    const tags = await apos.tags.listTags(apos.tasks.getReq(), {});
    assert(tags);
    assert(Array.isArray(tags));
  });

  it('should have a prefix option on the get method that filters the tags', function(done) {
    return apos.tags.listTags(apos.tasks.getReq(), { prefix: 'tag' }, function(err, tags) {
      assert(!err);
      assert(_.includes(tags, 'tag1', 'tag2', 'tag3', 'tag4'));
      assert(!_.includes(tags, 'agressive'));
      done();
    });
  });

  it('should have a contains option on the get method that filters the tags', function(done) {
    return apos.tags.listTags(apos.tasks.getReq(), { contains: 'ag' }, function(err, tags) {
      assert(!err);
      assert(_.includes(tags, 'agressive', 'tag1', 'tag2', 'tag3', 'tag4'));
      done();
    });
  });

  it('should return an empty array if a prefix or contains option does not match', function(done) {
    return apos.tags.listTags(apos.tasks.getReq(), { contains: '9046gobbledygook1678' }, function(err, tags) {
      assert(!err);
      assert(tags.length === 0);
      done();
    });
  });

  it('should provide an api route for autocomplete', function(done) {
    return request({
      url: 'http://localhost:7900/modules/apostrophe-tags/autocomplete',
      method: 'POST',
      form: { term: 'ag' }
    }, function(err, response, body) {
      assert(!err);
      assert(body);
      body = JSON.parse(body);
      assert(Array.isArray(body));

      // make sure we don't have any results that didn't match our term.
      _.each(body, function(item) {
        assert(item.value !== 'pizza');
      });

      done();
    });
  });

  it('should provide an api route for autocomplete', function(done) {
    return request({
      url: 'http://localhost:7900/modules/apostrophe-tags/autocomplete',
      method: 'POST',
      form: { term: 'ag', prefix: true }
    }, function(err, response, body) {
      assert(!err);
      assert(body);
      body = JSON.parse(body);
      assert(Array.isArray(body));

      // make sure we don't have any results that didn't match our term.
      _.each(body, function(item) {
        assert(item.value !== 'pizza');
      });

      done();
    });
  });

});
