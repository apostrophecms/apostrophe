# Changelog

## 2.0.4

* The `apostrophe-login` module now invokes `loginAfterLogin(req, callback)` on all modules that have such a method, via `apos.callAll`. Modules that do not need a callback can supply this method with only one argument. Afterwards, `apostrophe-login` redirects to `req.redirect`, as is supported elsewhere in Apostrophe. So you can assign to `req.redirect` in your callback to change the user's destination after a successful login. If `req.redirect` is not set, the user is redirected to the home page.

## 2.0.3

The `ancestors` and `children` filters defaulted to `areas(false)`, but `joins(false)` was omitted, contrary to documentation which has always indicated the information returned is limited for performance. This was fixed. You can still override freely with the `filters` option to `apostrophe-pages`.

The HTML5 doctype was added to `outerLayoutBase`. HTML5 was always assumed, and the absence of the doctype broke jQuery's support for distinguishing `$(window).height()` from `$(document).height()`, causing runaway infinite scroll loading.

Warning message instructions for configuring the session secret were fixed (the actual location has not changed).

## 2.0.2

Previously the `contextual` flag of a pieces module was not considered before deciding to redirect to the "show page" for the piece, which might not exist. This has been fixed. It should only happen when the module has `contextual: true`, creating a reasonable expectation that such a page must exist.

## 2.0.1

Packaging and documentation issues only.

## 2.0.0

Inaugural npm release of Apostrophe 2.x, which was used prior to that in many projects via git dependencies.



