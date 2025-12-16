# Changelog

## 1.0.4 (2025-12-01)

* Default hash function now distinguishes requests by hostname, and respects `req.originalUrl` in preference to `req.url` if available (ApostropheCMS).
* Passing the empty string to `res.send()` no longer causes a failure.
* If `express-cache-on-demand` does fail due to an unsupported way of ending a response, just issue a 500 error and log a useful message. Don't terminate the process.

## 1.0.3 (2022-02-18)

* eslint fixes

## 1.0.2 (2017-11-17)

* Supports getHeader

## 1.0.1 (2016-10-07)

* Modern dependencies

## 1.0.0 (2016-10-17)

* First stable release. Status code support in `res.redirect`, thanks to Alexey Astafiev
