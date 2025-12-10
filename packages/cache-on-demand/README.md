# cache-on-demand

<a href="http://apostrophenow.org/"><img src="https://raw.githubusercontent.com/punkave/cache-on-demand/master/logos/logo-box-madefor.png" align="right" /></a>

"On demand" caching that kicks in only when requests arrive simultaneously.

```javascript
var cacheOnDemand = require('cache-on-demand');

// Find all the things related to a URL.
// Let's just say this is a slow operation.

function getTheStuff(url, callback) {
  return myDatabase.find({ url: url }).toArray(callback);
}

// Create a new function with on-demand caching.

var cachedGetTheStuff = cacheOnDemand(getTheStuff, function(url) {
  // A URL makes a great hash key
  return url;
});

// Call cachedGetTheStuff just like we'd call the original.

getTheStuff('/welcome', function(err, stuff) {
  // Hooray, let's loop over the stuff
});
```

Under light load, with calls to `cachedGetTheStuff` taking place separated in time, every request for a given URL will get an individually generated response, which gives them the newest content. Just like calling `getTheStuff` directly.

But under heavy load, with new requests arriving while the first request is still being processed, the additional requests are queued up. When the first response is ready, it is simply sent to all of them. And then the response is discarded, so that the next request to arrive will generate a new response with the latest content.

This gives us "on demand" caching. The server is still allowed to generate new responses often, just not many of them simultaneously. It is the shortest practical lifetime for cache requests and largely eliminates concerns about users seeing old content, as well as concerns about cache memory management. In fact most users will get *fresher content than they would without the caching*, because the server is not overwhelmed and generating responses slowly.

## Writing your hash function

The second argument to `cache-on-demand` is a hash function. It receives the same arguments as your original function, except for the callback.

If this call *should not be cached*, just return `false`.

If this call *should* be cached, return a string for use as a hash key. All calls with the same hash key that arrive while your worker function is running will get the same response, without calling the function again.

## What about errors?

If your main function reports an error to its callback, it is reported to the original caller and all of the pending callers as well. In fact, we simply deliver *all of the same arguments* that your worker function passed to its callback.

## Express middleware

There's an easy way to use this module with web apps powered by Express. Check out [express-cache-on-demand](https://github.com/punkave/express-cache-on-demand).

## About P'unk Avenue and Apostrophe

`cache-on-demand` was created at [P'unk Avenue](http://punkave.com) for use in many projects built with Apostrophe, an open-source content management system built on node.js. If you like `cache-on-demand` you should definitely [check out apostrophenow.org](http://apostrophenow.org).

## Support

Feel free to open issues on [github](http://github.com/punkave/cache-on-demand).

<a href="http://punkave.com/"><img src="https://raw.githubusercontent.com/punkave/cache-on-demand/master/logos/logo-box-builtby.png" /></a>

## Changelog

### CHANGES IN 1.0.1

Eliminated use of `var` and introduced use of `...` to make the code more maintainable. No functional changes.

### CHANGES IN 1.0.0

This has been in production use for many moons, so we're declaring 1.0.0 stable. Also bumped the dependencies up to modern releases.

### CHANGES IN 0.2.0

Moved all the expressly Express-related stuff to the [express-cache-on-demand](https://github.com/punkave/express-cache-on-demand) module.

### CHANGES IN 0.1.0

Initial release. With shiny unit tests, of course.
