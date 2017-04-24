# Changelog

** 2.23.0

All tests passing.

* The "manage" view of `apostrophe-pieces` now supports robust filters, in the same way they were already supported on the front end for `apostrophe-pieces-pages`. Use the `addFilters` option to configure them. There is bc with existing filters that relied on the old assumption that manage filters have a boolean API. However now you can specify any field with a cursor filter, which includes most schema fields, notably including joins.

Note that since all of the options are presented in a dropdown, not all fields are good candidates for this feature.

The "manage" view filters now refresh to reflect only the options that still make sense based on the other filters you have selected, reducing user frustration.

See [reusable content with pieces](http://apostrophecms.org/docs/tutorials/getting-started/reusable-content-with-pieces.html) for more information and examples.

Thanks to Michelin for their support of this work.

* `apos.utils.isFalse` allows you to check for values that are strictly `=== false` in templates.

* `apos.utils.startCase` converts property names to English, roughly speaking. It is used as a fallback if a filter does not have a `label` property. This is primarily for bc, you should add a `label` property to your fields.

* Production now matches the dev environment with regard to relative URLs in LESS files, such as those used to specify background images or font files. Previously the behavior was different in dev and production, which is a bug.

* You can now pass a `less` option to `apostrophe-assets`, which is merged with the options given to `less.render` both in dev and production. You can use this, for instance, to enable `strictMath`.

* `apostrophe.oembed`'s `fetch` method now propagates its `options` object to `oembetter` correctly. Thanks to Fotis Paraskevopoulos.

** 2.22.0

All tests passing.

* Apostrophe now supports publishing CSS and JS assets via S3 rather than serving them directly.

Apostrophe already had an option to build asset "bundles" and deploy them at startup, as described in our [cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html). However this serves the assets from the cloud webserver, such as a Heroku dyno or EC2 instance. It is now possible to serve the assets from Amazon S3.

See the [updated cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html) for details.

Thanks to Michelin for their support of this work.

* Enforce string field `min` and `max` properties on server side.

* When validation of a form with tabs fails, such as a pieces edit modal, activate the correct tab and scroll to the first error in that tab.

* thanks to Ludovic Bret for fixing a bug in the admin bar markup.

** 2.21.0

All tests passing.

* For a small performance boost, `defer` option can be set to `true` when configuring any widget module.
This defers calls to the `load` method until just before the page is rendered, allowing a single query
to fetch them all in simple cases. This is best applied
to the `apostrophe-images-widgets` module and similar widgets. It should not be applied if you wish
to access the results of the join in asynchronous code, because they are not available until the last
possible moment.

Thanks to Michelin for their support of this work.

* You can also set `deferImageLoading` to `true` for the `apostrophe-globals` module if you want the
same technique to be applied when loading the `global` doc's widgets. This does not always yield a
performance improvement.

* Bug fix: if two crops of the same image were present in separate widgets on a page, only one of the crops would be seen in template code. This issue has been resolved.

** 2.20.3

All tests passing.

* The search filter is once again available when choosing images. This involved a deeper fix to modals: filters for sliding modals were not being properly captured and hoisted into the shared part of the outer div. This is now being done exactly as it is done for the controls (buttons) and the instructions.

To avoid incompatibility with existing uses of `self.$filters`, such as in the manage modal, they are captured to `self.$modalFilters`. A small change to the manage modal was needed to take advantage of this.

* Moved a warning message from `console.log` to `console.error`. `stdout` should never be used for warnings and errors. Moving toward clean output so that command line tasks can be safely used in pipelines.

** 2.20.2

All tests passing.

Improved UI for editing widgets. The edit button is no longer separate from the area-related controls such as up, down, etc. This reduces clutter and reduces difficulty in accessing widgets while editing.

** 2.20.1

All tests passing.

When autocompleting doc titles to add them to a join, Apostrophe again utilizes search result quality to display the best results first.

** 2.20.0

All tests passing.

This is a significant update with two useful new features and various minor improvements.

* Support for batch uploads. The `apostrophe-images` and `apostrophe-files` modules now implement batch uploads by default.

When you click "New File" or "New Image," you now go directly to the file browser, and if you select multiple files they are uploaded without a modal dialog appearing for each one; the title and slug are populated from the filename, and that's that.

You can also drag one or more files directly to the chooser/manager modal.

If you are choosing files or images for a widget, they are automatically selected after a batch upload.

This feature can be disabled by setting the `insertViaUpload` option to `false` for `apostrophe-images` or `apostrophe-files`. If you are adding `required` fields to `apostrophe-images` or `apostrophe-files`, then batch uploading is not the best option for you because it would bypass that.

**If you wish, you can enable the feature for your own `apostrophe-pieces` modules that have an `attachment` field in their schema by setting the `insertViaUpload` option to `true`.** However please note that this does not currently do anything for pieces that refer to an image or file indirectly via widget.

* Global preference editing, and a standard UI to roll back to earlier versions of global content. There is now a "Global Content" admin bar button. By default, this launches the version rollback dialog box for shared global content.

However, if you use `addFields` to add schema fields to the `apostrophe-global` module, this button instead launches an editing modal where you can edit those fields, and also offers a "Versions" button accessible from there.

Global preferences set in this way are accessible in all situations where `data.global` is available. This is very useful for creating project-wide preference settings.

All the usual features of schemas can be used, including `groupFields`. Of course, if you choose to use joins or widgets in global content, you should keep the performance impact in mind.

* Various UX fixes to the manager and chooser modals.

* If there is a `minSize` setting in play, that information is displayed to the user when choosing images.

* The `checkboxes` schema field type now supports the `browseFilters` feature.

* When batch file uploads fail, a more useful set of error messages are displayed.

** 2.19.1

All tests passing.

* When saving any doc with a schema, if an attachment field does not match a valid attachment that has actually been uploaded, that field is correctly nulled out. In addition, if the attachment's file extension is not in a valid fileGroup as configured via the attachments module, the field is nulled out. Finally, the `crop: true` option for attachments is saved successfully. This option allows for attachments to have a crop that is inherent to them, useful when there is no widget standing between the doc and the attachment.

All of these changes correct bugs in intended behavior. Certain checks were present in the code but not completely functional. If you need to update your configuration to add file extensions, [apostrophe-attachments](http://apostrophecms.org/docs/modules/apostrophe-attachments/).

** 2.19.0

All tests passing.

* As always, Apostrophe always populates `req.data.home`; when `req.data.page._ancestors[0]` exists that is used, otherwise Apostrophe carries out a separate query. However as a performance enhancement, you may now disable this additional query by passing the `home: false` option to the `apostrophe-pages` module. Note that `req.data.home` is not guaranteed to exist if you do this.

As for children of the home page, for performance you may now pass `home: { children: false }` option to the `apostrophe-pages` module. This option only comes into play when using `filters: { ancestors: false }`.

Thanks to Michelin for their support of this work.

** 2.18.2

All tests passing.

* Performance enhancement: when fetching `req.data.home` directly in the absence of `req.page._ancestors[0]`, such as on the home page itself or a non-page route like `/login`, we must apply the same default filters before applying the filter options, namely `.areas(false).joins(false)`, otherwise duplicate queries are made.

* Fixed bug in as-yet-unused `schemas.export` method caught by babel's linter.

Thanks to Michelin for their support of this work.

** 2.18.0

All tests passing.

* New batch editing features for pieces! You can now use the checkboxes to select many items and then carry out the following operations in one step: trash, rescue from trash, publish, unpublish, tag and untag.

In addition there is a clearly documented procedure for creating new batch editing features with a minimum of new code.

* Several bugs in the array editor were fixed. Up, down and remove buttons work properly again, an aesthetic glitch was resolved and redundant ordinal numbers do not creep in when managing the order of an array without the `titleField` option.

* Logging out completely destroys the session. While the standard behavior of `req.logout` in the Passport module is only to break the relationship between the `user` object and the session, users expect a clean break.

** 2.17.2

All tests passing.

* Members of a group that has the admin permission for a specific piece type can now move pieces of that type to and from the trash. (This was always intended, so this is a bug fix.)
* For better out-of-the-box SEO, an `alt` attribute with the title of the image is now part of the `img` markup of `apostrophe-images` widgets.

** 2.17.1

All tests passing.

* Fixed XSS (cross-site scripting) vulnerability in `req.browserCall` and `apos.push.browserCall`.

* Removed confusing strikethrough of "Apply to Subpages" subform when the permission is being removed rather than added.

* Improved UX of area widget controls.

* Improved modal array tab UI and CSS.

* The `oembedReady` Apostrophe event is now emitted correctly after `apostrophe-oembed` renders an oembed-based player, such as a YouTube video player for the `apostrophe-video` widget. This event can be listened for via `apos.on('apostrophe-oembed', fn)` and receives a jQuery object referring to the relevant element.

** 2.17.0

All tests passing.

* `array` schema fields now accept a `limit` option. They also support the `def` property to set defaults for individual fields. The array editor code has been refactored for better reliability and performance and documentation for the methods has been written.

* Relative `@import` statements now work when you push plain `.css` files as Apostrophe assets. There is no change in behavior for LESS files. Thanks to Fredrik Ekelund.

* Controls such as the "Finished" button of the reorganize modal were floating off the screen. This has been fixed.

** 2.16.1

All tests passing.

* If you have tried using `piecesFilters` with a `tags` field type, you may have noticed that when the query string parameter is present but empty, you get no results. This is suboptimal because that's a common result if you use an HTML form to drive the query. An empty string for a `tags` filter now correctly does nothing.

* In `apostrophe-rich-text-widgets`, initialize CKEditor on `instanceReady`, rather than via a dodgy timeout. Thanks to Frederik Ekelund for finding a better way!

** 2.16.0

All tests passing.

* Reintroduced the reorganize feature for editors who have permissions for some pages but not others. You are able to see the pages you can edit and also their ancestors, in order to navigate the tree. However you are able to drag pages only to parents you can edit.

* Introduced the new `deleteFromTrash` option to the `apostrophe-pages` module. If this option is enabled, a new icon appears in "reorganize" when looking at pages in the trash. This icon allows you to permanently delete a page and its descendants from the site.

The use of this option can lead to unhappy customers if they do not clearly understand it is a permanent action. For that reason, it is disabled by default. However it can be quite useful when transitioning from the initial site build to long-term support. We recommend enabling it during that period and disabling it again after cleanup.

* "Reorganize" no longer displays nonfunctional "view" and "trash" icons for the trash and pages inside it.

* The tests for the `apostrophe-locks` module are now deterministic and should always pass.

** 2.15.2

All tests passing.

Fixed a bug which could cause a crash if the `sort` filter was explicitly set to `search` and no search was actually present. Conditions existed in which this could happen with the autocomplete route.

** 2.15.1

Due to a miscommunication the version number 2.15.0 had been previously used. The description below was originally intended for 2.15.0 and has been published as 2.15.1 purely to address the version numbering conflict.

All tests passing.

* `apos.permissions.addPublic` accepts multiple arguments and array arguments,
adding all of the permission names given including any listed in the arrays.
* Permissions checks for pieces admin routes longer check for req.user, checking for the appropriate `edit-` permission is sufficient and makes addPublic more useful.
* Updated the `i18n` module to address a problem where labels that happened to be numbers rather than strings would crash the template if passed to `__()`.
* Documentation improvements.

** 2.14.3

All tests passing.

The mechanism that preserves text fields when performing AJAX refreshes was preserving
other types of `input` elements. Checkboxes, radio buttons and `type="submit"` are now
properly excluded from this mechanism.

## 2.14.2

Fixed [#385](https://github.com/punkave/apostrophe/issues/385): if a page is moved to the trash, its slug must always change, even if it has been edited so that it no longer has its parent's slug as a prefix. In addition, if the resulting slug of a descendant of the page moving to the trash conflicts with an existing page in the trash, steps are taken to ensure uniqueness.

## 2.14.1

All tests passing.

* The `apos.utils.clonePermanent` method no longer turns objects into long arrays of nulls if they happen to have a `length` property. `lodash` uses the `length` property as an indicator that the object should be treated as an array, but this would be an unrealistic restriction on Apostrophe schema field names. Instead, `clonePermanent` now uses `Array.isArray` to distinguish true arrays. This fixes a nasty bug when importing content from A1.5 and subsequently editing it.

* When a user is logged in there is an `apos.user` object on the browser side. Due to a bug this was an empty object. It now contains `title`, `_id` and `username` properties as intended.

## 2.14.0

All tests passing.

* A version rollback dialog box for the `global` doc is now opened if an element with the `data-apos-versions-global` attribute is clicked. There is currently no such element in the standard UI but you may introduce one in your own layout if you have mission-critical content in the `global` doc that is awkward to recreate after an accidental deletion, such as a custom sitewide nav.
* An error message is correctly displayed when login fails.
* Many UI messages are now passed through the `__()` internationalization helper correctly. Thanks to `timaebi`.

## 2.13.2

All tests passing.

The `data-apos-ajax-context` feature had a bug which prevented ordinary anchor links from performing AJAX refreshes correctly.

## 2.13.1

All tests passing.

The `apostrophe-attachments` module now calls `apos.ui.busy` correctly on the fieldset so that the busy and completed indicators are correctly shown and hidden. Previously the string `0` was passed, which is not falsy.

## 2.12.0

All tests passing.

* Developers are no longer required to set `instantiate: false` in `app.js` when configuring an npm module that uses the `improve` property to implicitly subclass and enhance a different module. In addition, bugs were fixed in the underlying `moog-require` module to ensure that assets can be loaded from the `public` and `views` folders of modules that use `improve`.
* `string` has replaced `csv` as the property name of the schema field converters that handle plaintext. Backwards compatibility has been implemented so that existing `csv` converters will work transparently and calls to `convert` with `csv` as the `from` argument still work as well. In all new custom field types you should say `string` rather than `csv`. There is no change in the functionality or implementation other than the name.

## 2.11.0

All tests passing.

You can now add middleware to your Apostrophe site via any module in your project. Just add an `self.expressMiddleware` method to your module, which takes the usual `req, res, next` arguments. Or, if it's more convenient, set `self.expressMiddleware` to an array of such functions. "Module middleware" is added immediately after the minimum required Apostrophe middleware (bodyParser, `req.data`, etc), and before any routes.

## 2.10.3

All tests passing.

Fixed bug in `autoPreserveText` feature of our `data-apos-ajax-context` mechanism; also, restricted it to text inputs and textareas that actually have the focus so that you can replace their values normally at other times

## 2.10.2

All tests passing.

A very minor fix, but 2.10.1 had a very noisy console.log statement left in.

## 2.10.1

All tests passing.

* The built-in cursor filters for `float` and `integer` no longer incorrectly default to filtering for docs with the value `0` if the value being filtered for is undefined or null. They default to not filtering at all, which is correct.

## 2.10.0

All tests passing.

* Apostrophe now automatically recompiles modified Nunjucks templates. This means you can hit refresh in your browser after hitting save in your editor when working on `.html` files. Also note that this has always worked for `.less` files.
* Fixed a longstanding bug in `joinByArrayReverse`, which now works properly.

## 2.9.2

All tests passing.

* Starting with MongoDB 3.3.x (?), it is an error to pass `safe: true` when calling `ensureIndex`, and it has never done anything in any version. In our defense, cargo-cult practice was probably adopted back in the days when MongoDB would invoke your write callback without actually confirming anything unless you passed `safe: true`, but apparently this was never a thing for indexes. Removed all the `safe: true` arguments from `ensureIndex` calls.
* Added a `beforeAjax` Apostrophe event to facilitate progress display and animations when using the new `data-apos-ajax-content` feature.

## 2.9.1

All tests passing.

* Fixed an omission that prevented the use of the back button to undo the very first click when using the new `data-apos-ajax-context`. Later clicks worked just fine, but for the first one to work we need a call to `replaceState` to make it possible to restore the original query.

## 2.9.0

All tests passing.

* Two major new features in this release: built-in filters for most schema fields, and built-in AJAX support for `apostrophe-pieces-pages`. These combine to eliminate the need for custom code in a wide array of situations where you wish to allow users to browse and filter blog posts, events, etc. In most cases there is no longer any need to write your own `cursor.js` or your own AJAX implementation. The provided AJAX implementation handles browser history operations, bookmarking and sharing properly and is SEO-friendly.

[See the official summary of the pull request for details and examples of usage.](https://github.com/punkave/apostrophe/pull/766)

* We also fixed a bug in the `refinalize` feature of cursors. state.criteria is now cloned before finalize and restored after it. Otherwise many criteria are added twice after refinalize which causes a fatal error with a few, like text search in mongodb.

In addition, we merged a contribution from Fotis Paraskevopoulos that allows a `bodyParser` option with `json` and `urlencoded` properties to be passed to the `apostrophe-express` module. Those properties are passed on to configure those two body parser middleware functions.

## 2.8.0

All tests passing.

* `APOS_MONGODB_URI` environment variable is used to connect to MongoDB if present. Helpful for cloud hosting. See the new [deploying Apostrophe in the cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html).
* `APOS_S3_BUCKET`, `APOS_S3_ENDPOINT` (optional), `APOS_S3_SECRET`, `APOS_S3_KEY`, and `APOS_S3_REGION` environment variables can be used to configure Apostrophe to use S3 for uploaded media storage. This behavior kicks in if `APOS_S3_BUCKET` is set. See the new [deploying Apostrophe in the cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html).
* New advisory locking API accessible via `apos.locks.lock` and `apos.locks.unlock`. `apostrophe-migrations:migrate` is now wrapped in a lock. More locks are coming, although Apostrophe was carefully designed for benign worst case outcomes during race conditions.
* Better asset deployment for Heroku and other cloud services. `node app apostrophe:generation --create-bundle=NAME` now creates a new folder, `NAME`, containing assets that would otherwise have been written to `public`. Launching a server with the `APOS_BUNDLE` environment variable set to `NAME` will then copy that bundle's contents into `public` before listening for connections. See the new [deploying Apostrophe in the cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html).
* `apostrophe-pieces-pages` index pages are about 2x faster; discovered we were inefficiently deep-cloning `req` when cloning a cursor.
* Helpful error message if you forget to set the `name` property of one of your `types` when configuring `apostrophe-pages`.

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
