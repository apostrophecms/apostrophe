const t = require('../test-lib/test.js');
const assert = require('assert');
// const request = require('request-promise');
// const qs = require('qs');

describe('Oembed', function() {
  this.timeout(t.timeout);

  let apos;

  after(function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    const apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          session: {
            secret: 'xxx'
          },
          port: 7900,
          csrf: false
        }
      }
    });

    assert(apos.modules['apostrophe-oembed']);
    assert(apos.oembed.__meta.name === 'apostrophe-oembed');
  });

  // TODO: test this with mocks. Travis CI erratically times out
  // when we test against real YouTube, which produces false
  // failures that lead us to ignore CI results.
  //
  // let youtube = 'https://www.youtube.com/watch?v=us00G8oILCM&feature=related';

  // it('YouTube still has the video we like to use for testing', async function() {
  //   try {
  //     const response = await request({
  //       method: 'GET',
  //       uri: youtube,
  //       resolveWithFullResponse: true
  //     });

  //     assert(response.statusCode === 200);
  //   } catch (e) {
  //     assert(false);
  //   }
  // });

  // it('Should deliver an oembed response for YouTube', async function() {
  //   const queryString = qs.stringify({ url: youtube });
  //   const uri = `http://localhost:7900/modules/apostrophe-oembed/query?${queryString}`;

  //   const response = await request({
  //     uri,
  //     method: 'GET',
  //     resolveWithFullResponse: true
  //   });

  //   assert(response.statusCode === 200);
  //   const data = JSON.parse(response.body);
  //   assert(data.type === 'video');
  // });
});
