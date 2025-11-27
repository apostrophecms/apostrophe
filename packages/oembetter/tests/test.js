
const assert = require('assert');
const oembetter = require('../index.js')();

// For testing custom before filters
oembetter.addBefore(function(url, options, response, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('hootenanny.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  const matches = parsed.pathname.match(/pages\/(\d+).html/);
  if (!matches) {
    return setImmediate(callback);
  }
  const id = matches[1];
  const newResponse = {
    thumbnail_url: 'http://hootenanny.com/thumbnails/' + id + '.jpg',
    html: '<iframe src="http://hootenanny.com/videos/' + id + '"></iframe>'
  };
  return callback(null, url, options, newResponse);
});

// For testing a before filter that just adjusts the URL
oembetter.addBefore(function(url, options, response, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('wiggypants.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  url = url.replace(/wiggypants\.com/g, 'jiggypants.com');
  return callback(null, url);
});

// just verifying that wiggypants became jiggypants
oembetter.addBefore(function(url, options, response, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('jiggypants.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  return callback(null, url, options, { html: 'so jiggy' });
});

// "after" filter can change a response
oembetter.addAfter(function(url, options, response, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('jiggypants.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  response.extra = 'extra';
  return callback(null);
});

// "fallback" filter can create a response when oembed fails
oembetter.addFallback(function(url, options, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('wonkypants83742938.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  return callback(null, { html: 'so wonky' });
});

// fallback filter for a working domain has no effect
oembetter.addFallback(function(url, options, callback) {
  const parsed = new URL(url);
  if (!oembetter.inDomain('youtube.com', parsed.hostname)) {
    return setImmediate(callback);
  }
  return callback(null, { html: 'oopsie' });
});

describe('oembetter', function() {
  // youtube oembed can be sluggish
  this.timeout(10000);
  it('should be an object', function() {
    assert(oembetter);
  });
  it('should return no response gracefully for apostrophecms.com', function(done) {
    oembetter.fetch('http://apostrophecms.com/', function(err, response) {
      assert(err);
      return done();
    });
  });
  it('should return an oembed response for youtube full links', function(done) {
    const oembetter = require('../index.js')();
    // Use the suggested endpoints, youtube sometimes has discovery issues
    // so we always do this in production
    oembetter.endpoints(oembetter.suggestedEndpoints);
    oembetter.fetch('https://www.youtube.com/watch?v=zsl_auoGuy4', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html);
      done();
    });
  });
  it('should return an oembed response for youtube sharing links', function(done) {
    const oembetter = require('../index.js')();
    // Use the suggested endpoints, youtube sometimes has discovery issues
    // so we always do this in production
    oembetter.endpoints(oembetter.suggestedEndpoints);
    oembetter.fetch('https://youtu.be/RRfHbyCQDCo?si=U5yxvQeXgACwajqa', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html);
      done();
    });
  });
  it('should return an oembed response for youtube with forced use of XML', function(done) {
    require('../oembed.js').setForceXml(true);
    oembetter.fetch('https://www.youtube.com/watch?v=zsl_auoGuy4', function(err, response) {
      require('../oembed.js').setForceXml(false);
      assert(!err);
      assert(response);
      assert(response.html);
      assert(response._xml);
      done();
    });
  });
  it('should respect a custom before filter', function(done) {
    oembetter.fetch('http://hootenanny.com/pages/50.html', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html);
      assert(response.html === '<iframe src="http://hootenanny.com/videos/50"></iframe>');
      return done();
    });
  });
  it('inDomain method should handle a subdomain properly', function(done) {
    oembetter.fetch('http://www.hootenanny.com/pages/50.html', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html);
      assert(response.html === '<iframe src="http://hootenanny.com/videos/50"></iframe>');
      return done();
    });
  });
  it('inDomain method should flunk a bad domain', function(done) {
    oembetter.fetch('http://flhootenanny.com/pages/50.html', function(err, response) {
      assert(err);
      return done();
    });
  });
  it('before filter can adjust URL', function(done) {
    oembetter.fetch('http://wiggypants.com/whatever', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html === 'so jiggy');
      return done();
    });
  });
  it('after filter can change response', function(done) {
    oembetter.fetch('http://jiggypants.com/whatever', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.extra === 'extra');
      assert(response.html === 'so jiggy');
      return done();
    });
  });
  it('fallback filter can provide last ditch response', function(done) {
    oembetter.fetch('http://wonkypants83742938.com/purple', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html === 'so wonky');
      return done();
    });
  });
  it('fallback filter for a working oembed service has no effect', function(done) {
    oembetter.fetch('https://www.youtube.com/watch?v=zsl_auoGuy4', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html !== 'oopsie');
      return done();
    });
  });
  it('setting allowlist does not crash', function() {
    oembetter.allowlist([ 'jiggypants.com' ]);
  });
  it('allowlisted domains work', function(done) {
    oembetter.fetch('http://jiggypants.com/whatever', function(err, response) {
      assert(!err);
      assert(response);
      assert(response.html === 'so jiggy');
      return done();
    });
  });
  it('does not allow domains not on the allowlist', function(done) {
    oembetter.fetch('http://wiggypants.com/whatever', function(err, response) {
      assert(err);
      return done();
    });
  });
  it('suggested allowlist is available', function() {
    assert(Array.isArray(oembetter.suggestedAllowlist));
  });
  it('non-http URLs fail up front with the appropriate error', function(done) {
    oembetter.fetch('test://jiggypants.com/whatever', function(err, response) {
      assert(err);
      assert(err.message === 'oembetter: URL is neither http nor https: test://jiggypants.com/whatever');
      return done();
    });
  });
  it('We can set the suggested endpoints and allowlist', function() {
    oembetter.allowlist(oembetter.suggestedAllowlist);
    oembetter.endpoints(oembetter.suggestedEndpoints);
  });
  if (process.env.VIMEO_PRIVATE_URL) {
    it('Can embed vimeo private video with full metadata', function(done) {
      oembetter.fetch(process.env.VIMEO_PRIVATE_URL, {
        headers: {
          Referer: process.env.VIMEO_PRIVATE_REFERER
        }
      }, function(err, response) {
        assert(!err);
        assert(response);
        assert(response.html);
        assert(response.thumbnail_url);
        done();
      });
    });
  }
});
