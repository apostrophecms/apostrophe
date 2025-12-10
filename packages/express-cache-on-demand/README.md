# express-cache-on-demand

<a href="http://apostrophenow.org/"><img src="https://raw.githubusercontent.com/punkave/express-cache-on-demand/master/logos/logo-box-madefor.png" align="right" /></a>

Express middleware providing "on demand" caching that kicks in only when requests arrive simultaneously.

## Install

```
npm install express-cache-on-demand
```

## Example

```javascript
var expressCacheOnDemand = require('express-cache-on-demand')();

// Fetch a page from a database and build fancy
// navigation, then render the template; this is
// just an example of a big, possibly slow task.
// Use the expressCacheOnDemand middleware to
// send the same response to all simultaneous
// requests.

app.get('/:page', expressCacheOnDemand, function(req, res) {
  return getPage(req.params.page, function(page) {
    return addFancyNavigation(page, function(links) {
      return res.render('page.html', { links: links });
    });
  });
});

```
Under light load, with requests arriving far apart, every request for a given `req.url` will get an individually generated response, which gives them the newest content. This is the same behavior you see without the middleware.

But under heavy load, with new requests arriving while the first request is still being processed, the additional requests are queued up. When the first response is ready, it is simply sent to all of them. And then the response is discarded, so that the next request to arrive will generate a new response with the latest content.

This gives us "on demand" caching. The server is still allowed to generate new responses often, just not many of them simultaneously. It is the shortest practical lifetime for cached data and largely eliminates concerns about users seeing old content, as well as concerns about cache memory management.

## When to use it, when not to

This middleware is intended for routes that potentially take a long time to generate a relatively small response (under a megabyte, let's say). Dynamic web pages with lots of complicated moving parts are a perfect example.

You should *not* use this middleware for your entire site. In particular:

* It does not work and is not suitable anyway for routes that deliver entire files via `res.sendFile` and related methods
* It does not work and is not suitable anyway for routes that `pipe` content into `res`
* It shouldn't be registered globally before the `express.static` middleware

There may be other possible endings for an Express `res` object that are not properly handled by this middleware yet. Pull requests welcome.

## When we cache, when we don't

By default, the middleware only caches requests when:

* `req.method` is `GET` or `HEAD`.
* `req.user` is falsy.
* `req.session` is empty (*).

If the above conditions are not met, every request will generate its own response. This way we don't cause surprising behavior for logged-in users who are modifying site content and seeing personalized displays.

(*) The middleware is smart enough to ignore a few special cases, such as `req.session.cookie`, an empty `req.session.flash`, and an empty `req.session.passport`.

## Deciding when to cache on your own

If you don't like our rules for caching, you can write your own. Just pass a function that returns `false` for requests that should not be hashed, and a hash key such as `req.url` for requests that should be hashed.

```javascript
var expressCacheOnDemand =
  require('express-cache-on-demand')(hasher);

function hasher(req) {
  if (req.url.match(/nevercacheme/)) {
    return false;
  }
  return req.url;
}
```

## Using `cache-on-demand` for other tasks

This module is an Express middleware wrapper for our [cache-on-demand](https://github.com/punkave/cache-on-demand) module. If you would like to do the same trick with code that isn't powered by Express, try using that module directly.

## About P'unk Avenue and Apostrophe

`express-cache-on-demand` was created at [P'unk Avenue](http://punkave.com) for use in many projects built with Apostrophe, an open-source content management system built on node.js. If you like `cache-on-demand` you should definitely [check out apostrophecms.org](http://apostrophecms.org).

## Support

Feel free to open issues on [github](http://github.com/punkave/express-cache-on-demand).

<a href="http://punkave.com/"><img src="https://raw.githubusercontent.com/punkave/express-cache-on-demand/master/logos/logo-box-builtby.png" /></a>

## Changelog

### CHANGES IN 1.0.3

* The default hash function now correctly refuses to cache in the documented circumstances (i.e. logged-in users or a nontrivial `req.session` object). Previously a `return false` was missing, resulting in the possibility of a cached result going to a user with a different session.
* `var` has been eliminated and the code has been lightly refactored without other changes to behavior.

### CHANGES IN 1.0.2

`res.getHeader` support. Thanks to Vadim Fedorov.

### CHANGES IN 1.0.1

`cache-on-demand` is now at 1.0.0 also, plus the lodash dependency now points to a modern release. No functional changes.
### CHANGES IN 1.0.0

`redirect` now supports the optional status code argument properly. Thanks to Alexey Astafiev.

This module has been in successful production use for many moons, so we're declaring it stable (1.0.0).

### CHANGES IN 0.1.1

Fixed a bug in `redirect` support, which now works properly.

### CHANGES IN 0.1.0

Initial release. With shiny unit tests, of course.
