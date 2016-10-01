# Changelog

## 2.1.4

All tests passing.

* Previously chosen items that now reside in the trash no longer break the chooser for editing joins
* All joins editable; certain edge cases weren't getting blessed
* A field appears properly when two diferent choices list it for `showFields`
* As in 0.5, a required field hidden by `showFields` is not required (but will be if you elect the choice that shows it)

## 2.1.3

All tests passing.

* A typo in the unit tests caused unit tests to fail. This has been fixed.
* The recent addition of the HTML5 doctype caused the login page to be invisible in the sandbox project (not the boilerplate project). This has been fixed.
* The recent addition of the HTML5 doctype caused the admin bar to appear with a slight visual defect. This has been fixed.

## 2.1.2

Fix for [#668](https://github.com/punkave/apostrophe/issues/668), crash occurring when admin bar group leader starts out too close to the end of the admin bar items array.

## 2.1.1

Full Windows compatibility restored. The "recursively copy asset folders if on Windows" behavior from 0.5 was reimplemented. This is necessary to allow Apostrophe to run as a non-administrator on Windows. Running as administrator is the moral equivalent of running as root on Linux, which we would never recommend.

Since Apostrophe did not function previously on Windows and there is no behavior change on Mac/Linux this is effectively a bug fix rather than a new feature, thus 2.1.1.

## 2.1.0

* Introduced the new `apos.areas.richText` and `apos.areas.plaintext` methods, which are also available in templates by the same names.

* Added and documented the `addImageSizes` option of the `apostrophe-attachments` module.

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



>>>>>>> master
