const _ = require('lodash');
const cacheOnDemand = require('cache-on-demand');

module.exports = expressCacheOnDemand;

function expressCacheOnDemand(hasher = expressHasher) {
  const codForMiddleware = cacheOnDemand(worker, hasher);

  return (req, res, next) => {
    return codForMiddleware(req, res, next, (_res) => {
      // Replay the captured response
      if (_res.statusCode) {
        res.statusCode = _res.statusCode;
      }
      _.each(_res.headers || {}, (val, key) => {
        res.setHeader(key, val);
      });
      if (_res.redirect) {
        return res.redirect(_res.redirectStatus, _res.redirect);
      }
      if (_res.body) {
        return res.send(_res.body);
      }
      if (_res.raw) {
        return res.end(_res.raw);
      }
      // We know about ending a request with one of
      // the above three methods. Anything else doesn't
      // make sense with this middleware

      console.log('Attempted Request URL: ' + req.url);
      throw 'cacheOnDemand.middleware does not know how to deliver this response, use the middleware only with routes that end with res.redirect, res.send or res.end';
    });
  };

}

function worker(req, res, next, callback) {
  // Patch the response object so that it doesn't respond
  // directly, it builds a description of the response that
  // can be replayed by each pending res object

  const _res = { headers: {} };
  const originals = {};

  // We're the first in, we get to do the real work.
  // Patch our response object to collect data for
  // replay into many response objects

  patch(res, {
    redirect (url) {
      let status = 302;

      if (typeof arguments[0] === 'number') {
        status = arguments[0];
        url = arguments[1];
      }

      _res.redirectStatus = status;
      _res.redirect = url;
      return finish();
    },
    send (data) {
      _res.body = data;
      return finish();
    },
    end (raw) {
      _res.raw = raw;
      return finish();
    },
    getHeader (key) {
      return _res.headers[key];
    },
    setHeader (key, val) {
      _res.headers[key] = val;
    }
  });

  function finish() {
    // Folks tend to write to this one directly
    _res.statusCode = res.statusCode;
    // Undo the patching so we can replay into this
    // response object, as well as others
    restore(res);
    // Great, we're done
    return callback(_res);
  }

  // All set to continue the middleware chain
  return next();

  function patch(obj, overrides) {
    _.assign(originals, _.pick(obj, _.keys(overrides)));
    _.assign(obj, overrides);
  }

  function restore(obj) {
    _.assign(obj, originals);
  }
}

function expressHasher(req) {
  if ((req.method !== 'GET') && (req.method !== 'HEAD')) {
    return false;
  }
  if (req.user) {
    return false;
  }
  // Examine the session
  let safe = true;
  _.each(req.session || {}, function(val, key) {
    if (key === 'cookie') {
      // The mere existence of a session cookie
      // doesn't mean we can't cache. There has
      // to actually be something in the session
      return;
    }
    if ((key === 'flash') || (key === 'passport')) {
      // These two are often empty objects, which
      // are safe to cache
      if (!_.isEmpty(val)) {
        safe = false;
        return false;
      }
    } else {
      // Other session properties must be assumed to
      // be specific to this user, with a possible
      // impact on the response, and thus mean
      // this request must not be cached
      safe = false;
      return false;
    }
  });

  return !safe ? safe : req.url;
}
