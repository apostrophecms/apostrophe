# Changelog

All tests passing.

## 2.7.0

* We do a better job of defaulting to a sort by search match quality if full-text search is present in a query. Under the hood this is powered by the new `defaultSort` filter, which just stores a default value for the `sort` filter to be used only if `search` (and anything else with an implicit preferred sort order) is not present. No more lame search results for blog posts. You can explicitly set the `sort()` filter in a cursor override if you really want to, but trust us, when `search` is present sorting by anything but search quality produces poor results.
* Fixed bugs in the sanitizer for page slugs. It is now impossible to save a slug with trailing or consecutive slashes (except the home page slug which is allowed to consist of a single "trailing" slash). Added unit tests.
* Apostrophe's dropdown menus, etc. will more robustly maintain their font size in the presence of project-level CSS. There is an explicit default font size for `.apos-ui`.

## 2.6.2

All tests passing.

* The auto-suggestion of titles upon uploading files also suggests slugs.
* The auto-suggestion of titles and slugs applies to both "files" and "images."
* Reduce the clutter in the versions collection by checking for meaningful change on the server side, where final sanitization of HTML, etc. has taken place to iron out distinctions without a difference.
* Use the permission name `edit-attachment` consistently, so that calling `addPublic('edit-attachment')` has the intended effect.
* Manage view of pieces does not crash if `updatedAt` is missing from a piece.

## 2.6.1

All tests passing.

* Choosers and schema arrays play nicely with the new fixed-position tabs.
* Better CSS solution to positioning the attachment upload buttons which doesn't interfere with other styles.
* Images in the chooser choices column "stay in their lane."
* Better error message when an attempt to edit an area with a hyphenated name is used.
* Array edit button fixed.
* The `type()` cursor filter now has a finalizer and merges its criteria there at the very end, so that you can override a previous call to it at any time prior to invoking `toArray` or similar.
* Area controls no longer interfere with visibility of widget type selection menu.

## 2.6.0

All tests passing.

* `relationship` fields defined for `joinByArray` can now have an `inline: true` flag. If they are inline, they are presented right in the chooser, rather than appearing in a separate modal dialog reachable by clicking an icon. This feature should be used sparingly, but that's true of relationship fields in general.
* Permissions editing for pages now takes advantage of the new inline relationship fields to make the "apply to subpages" functionality easier to discover.
* When uploading files or images, the title field is automatically suggested based on the filename.
* Improvements in form field UX and design.
* When choosing pieces (including images), if you elect to create a new piece it is automatically added to the selection.
* When choosing pieces, if the `limit` is reached and it is greater than 1, a helpful message appears, and the UI changes to make clear that you cannot add items until you remove one. If the limit is exactly 1, a new selection automatically replaces the current selection, and singular language is used to clarify what is happening.
* Syntax errors in "related types" such as cursors now produce an improved error message with filename and line number.
* Showstopper errors during startup are reported in a less redundant way.

## 2.5.2

All tests passing.

* New `blockLevelControls: true` option to areas ensures controls for "blocks," i.e. "layout" widgets whose primary purpose is to contain other widgets, can be easily distinguished from controls for "regular" areas nested inside them. Think of a "two-column" or "three-column" widget with three areas in its template. The controls for these areas are displayed in a distinct color and various visual affordances are made to ensure they are accessible when things would otherwise be tightly spaces.
* General improvements to the usability of area-related controls.
* The search index now correctly includes the text of string and select schema fields found in widgets, pieces, pages, etc., as it always did before in 0.5. You may use `searchable: false` to disable this on a per-field basis.
* Search indexing has been refactored for clarity (no changes to working APIs).
* Checkboxes for the `checkboxes` schema field type are now styled.
* "View file" links in the file library are now styled as buttons.

## 2.5.1

All tests passing.

* The `minSize` option to `apostrophe-images` widgets now works properly when cropping.
* The cropper no longer starts out cropping to the entire image, as this made it unclear what was happening. However if you click the crop button and then just save you still get reasonable behavior.
* Bigger crop handles.
* Textarea focus state receives the same "glow" as a regular text input field.
* Small documentation updates.

## 2.5.0

All tests passing.

* Implemented `apos.areas.fromPlaintext`, which accepts a string of plaintext (not markup) and returns an area with a single `apostrophe-rich-text` widget in it, containing that text. Useful in implementing importers.
* The so-called `csv` import mode of `apos.schemas.convert` works properly for areas, using the above. Although it is called csv this mode is really suitable for any situation in which you have plaintext representations of each property in an object and would like those sanitized and converted to populate a doc.
* Bug fix: emit the `enhance` Apostrophe event only once on page load. This event is emitted only when there is new content that has been added to the page, e.g. once at page load, and also when a new widget is added or updated, etc. The first argument to your event handler will be a jQuery element which will contain only new elements.
* Legacy support for `data/port` and `data/address` files has been restored. (Note that `PORT` and `ADDRESS` environment variables supersede these. In modern Stagecoach deployments `data/port` is often a space-separated list of ports, and the `deployment/start` script parses these out and launches multiple processes with different PORT variables.)

## 2.4.0

All tests passing.

Workarounds for two limitations in MongoDB that impact the use of Apostrophe cursors:

* The `addLateCriteria` cursor filter has been introduced. This filter should be used only when
you need to invoke `$near` or another MongoDB operator that cannot be used within `$and`. The object
you pass to `addLateCriteria` is merged with the criteria object that is built normally by the cursor.
**Use of this filter is strongly discouraged unless you must use operators that do
not support `$and`.** 
* Custom filters that invoke `$near` or other MongoDB operators that are incompatible
with `$text` queries may call `self.set('regexSearch', true)` to force the cursor to use
a regular expression search rather than full MongoDB full-text search, if and when the
`search()` filter is called on the same cursor. This was implemented to allow combination
of full-text and geographical searches, subject of course to the limitation that regular expression
search is not indexed. It also doesn't sort by quality, but `$near` provides its own sort
by distance.

Since these are new features a minor version level bump is appropriate. However neither of these is a feature that a typical site developer will need to call directly.

## 2.3.2

All tests passing.

* The quality of the autocomplete search results shown when selecting pages or pieces via a join was low. This has been corrected by calling the `.sort('search')` filter to sort by search result quality rather than the default sort order for the doc type manager in question.
* All of the autocomplete suggestions fit on the screen on reasonably sized displays. With the recent addition of the "flip" feature to push the suggestions up rather than down if the bottom of the screen would otherwise be reached, this is critical to show the first and best suggestion. Further discussion for future UX improvement in [issue 704](https://github.com/punkave/apostrophe/issues/704).

## 2.3.1

All tests passing.

* Fixed a bug in the new "copy page" feature that affects pages that have `null` properties.
* Improved the experience of using the widget controls to manage the widgets in an area.
* The `login` module now has an alias, `apos.login`, like other core modules.
* Updated the jquery projector plugin to the latest version.

## 2.3.0

All tests passing.

* Fixed a bug affecting the use of `arrangeFields` in modules that extend another module's use of `arrangeFields`. Added unit test based directly on a real-world project.
* `baseUrl` project-wide option added, yielding the same benefit as in 0.5: you get absolute URLs for all pages everywhere. (If you don't want absolute URLs, just don't set it.) This is very beneficial when generating `og:meta` tags for Facebook, or generating emails.
* A direct link to the original file has been added to the file manager's editor modal.

## 2.2.2

All tests passing.

* Addition of slugs to projection for autocomplete is now done in a way that still allows overrides at the doc level to add other properties.
* Addition of slugs to projection for autocomplete works for joins with a specific page type, too.
* Fixed a chicken-and-egg problem in the global module that kicked in if the "global" doc contains widgets powered by modules not yet initialized at the time the global module checks for the existence of the doc.

## 2.2.1

All tests passing.

Fixed an oversight: the new `pageBeforeCopy` global method now takes `req` as its first parameter. Since `2.2.0` was first published 5 minutes ago and this method has not yet been documented this is not regarded as a bc break.

## 2.2.0

All tests passing.

* Fixed bug that broke removal of permissions for pages.
* "Copy Page" feature added to the page menu.
* Automatically reposition the autocomplete dropdown for joins if it would collide with the bottom of the window.
* Include page slugs in the autocomplete dropdown for joins with pages.
* `chooserChoiceBase.html` restored; some projects were depending on extending it, which is a useful technique.

## 2.1.5

All tests passing.

* Admin bar: previously grouped fields can be re-grouped successfully, so concatenating admin bar configuration works just as well as concatenating `addFields` arrays
* Files widget displays upload button in the same user-friendly position as the images widget
* Font size for tabs and help labels is explicit to avoid side effects from project-level CSS

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
