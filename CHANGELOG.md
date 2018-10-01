# Changelog

## 2.68.1

Unit tests passing.

Regression tests passing.

* When we introduced allowedSubpageTypes and allowedHomepageTypes in 2.67.0, we  broke support for different schemas in different page types. Those regressions are fixed here.
* The default page type choice offered for a new page is the first type permitted by its parent page.

## 2.68.0

Unit tests passing.

Regression tests passing.

* The `lateCriteria` cursor filter now works properly, allowing special mongodb criteria that are not allowed inside `$and` to be merged into the criteria object at the last minute.
* A noisy warning produced on every page send by the latest version of Bluebird has been silenced.
* Performance: explicitly shut off `sort()` for certain cases where we know only one document will be returned. This allows MongoDB to select a more efficient index more often.
* `nlbr` Nunjucks filter no longer results in double-escaped markup. Thanks to Ulf Seltmann.
* The `apostrophe-global` module now supports the `separateWhileBusyMiddleware` option. Iby separate middleware that checks for the lock flag in apostrophe-global even if the regular middleware of this method has been disabled and/or overridden to cache in such a way as to make it unsuitable for this purpose. For normal use this option is not necessary.
* Fixes made to further reduce conflicts between sites with `apostrophe-multisite`. For instance, the `apostrophe-workflow` module no longer breaks the dashboard.
* The home page can now be copied. If you copy the home page, you get a new child of the home page with the same content. Thanks to Tim Otlik.

## 2.67.0

Unit tests passing.

Regression tests passing.

* Pages can now be locked down with the `allowedHomepageTypes` and `allowedSubpageTypes` options, like this:

```javascript
// Only one type allowed for the home page
allowedHomepageTypes: [ 'home' ],

allowedSubpageTypes: {
  // Two subpage types allowed for the home page
  'home': [ 'default', 'apostrophe-blog-page' ],
  // No subpages for the blog page ("show pages" don't count)
  'apostrophe-blog-page': [],
  // default page type can only have another default page as a subpage
  'default': [ 'default' ]
}
```

These options make it easy to prevent users from creating unintended scenarios, like nesting pages too deeply for your navigation design.

* Pages now support batch operations, just like pieces do. The initial set includes trash, rescue, publish, unpublish, tag and untag. You can only rescue pages in this way if you are using the `trashInSchema` option of the docs module, which is always the case with `apostrophe-workflow`. With the conventional trash can, it is unclear what should happen because you have not indicated where you want each page to be restored. New batch operations for pages can be added in the same way that they are added for pieces.

* Important performance fix needed for those using the `apostrophe-pieces-orderings-bundle` module to create custom sort orders for pieces. Without this fix it is also possible to get a loader error and stop fetching content prematurely.

* The "revert" button for versions is now labeled "Revert to" to emphasize that it reverts to what you had at the end of that operation, not its beginning. Thanks to Fredrik Ekelund.

## 2.66.0

* Updated to CKEditor version 4.10.0. The CKEditor build now includes the CKEditor "widgets" feature (not to be confused with Apostrophe widgets). These are essential for modules like the forthcoming `apostrophe-rich-text-merge-tags`.
* `apos.areas.richText` and `apos.areas.plaintext` no longer produce duplicate text. To achieve this, the `apos.docs.walk` method no longer walks through the `_originalWidgets` property. This property is only used to preserve the previous versions of widgets that the user lacks permission to edit due to schema field permissions. Exploration of this property by `apos.docs.walk` led to the observed bug.
* The browser-side implementation of `apos.utils.escapeHtml` now works properly.

## 2.65.0

Unit tests passing.

Regression tests passing.

* **Important fix for MongoDB replica sets:** previously we used the `autoReconnect` option of the MongoDB driver by default. From now on, we use it only if the MongoDB URI does not refer to a replica set. The use of `autoReconnect` is [inappropriate with a replica set](https://github.com/apostrophecms/apostrophe/issues/1508) because it will keep trying to connect to the node that went down. Leaving this option out results in automatic use of nodes that are up. Also see the [apostrophe-db-mongo-3-driver](https://npmjs.org/package/apostrophe-db-mongo-3-driver) module for a way to use the newer `mongodb+srv` URIs. Thanks to Matt Broadstone of MongoDB for his advice.

* An `apostrophe-file` now has a default URL. The default `_url` property of an `apostrophe-file` piece is simply the URL of the file itself. This allows `apostrophe-file` to be included in your configuration for [apostrophe-permalinks](https://npmjs.org/package/apostrophe-permalinks); picking a PDF in this way generates a direct link to the PDF, which is what the user expects. Note that if the developer elects to set up an `apostrophe-files-pages` module that extends `apostrophe-pieces-pages`, that will still take precedence, so there is no bc break.

* Clicking directly from one rich text widget into another did not work properly; the toolbar did not appear in this situation. This bug has been fixed. The bug only occurred when clicking in a second rich text widget without any intervening clicks outside of all rich text widgets.

* Also see expanded notes on version `2.64.1`, below, which contained several features missed in the original changelog.

## 2.64.1

Unit tests passing.

Regression tests passing.

* Improved Apostrophe's ability to redisplay the appropriate widget, array element, and field and call the user's attention to it when a schema field error is not detected until server-side validation takes place. This addresses problems that come up when fields become `required` at a later time, and/or data was originally created with an earlier release of Apostrophe that did not enforce `required` in all situations. Browser-side validation is still preferred for ease of use but server-side validation no longer creates situations the user cannot easily resolve.

* Introduced the `apos.global.whileBusy` method. This method accepts a function to be run *while no one is permitted to access the site.* The provided function may return a promise, and that promise resolves before the site becomes accessible again. In the presence of `apostrophe-workflow` it is possible to mark only one locale as busy.

* By default, the `apos.locks.lock` method waits until the lock is available before proceeding. However there is now a `wait` option which can be set to `false` to avoid waiting at all, or to any number of milliseconds. If the method fails because of `wait`, the error is the string `locked`.

* The `apos.locks.lock` method also now accepts a `waitForSelf` option. By default, if the same process invokes `apos.locks.lock` for the same lock in two requests simultaneously, one of the two will receive an error. With `waitForSelf`, the second invocation will wait for the first to resolve and then obtain the lock.

## 2.64.0

Unit tests passing.

Regression tests passing.

* Apostrophe's "search suggestions" feature for `notFound.html` templates is now fully baked. It only takes two steps:

1. Include an element like this in your `notFound.html` template:

```
<div data-apos-notfound-search-results></div>
```

2. Set the `suggestions` option to `true` for the `apostrophe-search` module.

With `suggestions: true`, this feature no longer requires that you have a `/search` page, it uses a dedicated route. See the documentation of the `apostrophe-search` module for more information.

* The `showFields` option is now available for checkboxes. The syntax is as follows:

```
{
  "name": "awesomeBoolean",
  "label": "Awesome Boolean",
  "type": "boolean",
  "choices": [
    {
      "value": true,
      "showFields": ["otherField1"]
    },
    {
      "value": false,
      "showFields": ["otherField2"]
    }
  ]
}
```

Thanks to falkodev.

* A useful error message appears if you try to use a `mongodb+srv` URL. These are meant for newer versions of the MongoDB driver. You **can** use them, but you must install the [apostrophe-db-mongo-3-driver](https://npmjs.com/package/apostrophe-db-mongo-3-driver) module first. The error message now explains this, addressing a common question on stackoverflow.
* Basic styles added for the most common rich text markup tags when within the bounds of an Apostrophe modal. Thanks to Lars Houmark.
* Fixed UI overlap issue when joining with `apostrophe-page`.
* `apos.images.all`, `apos.images.first`, etc. now include `_description`, `_credit` and `_creditUrl` when they can be inferred from an `apostrophe-image` containing the attachment.
* `apos.images.srcset` helper improved. It is now smart enough to limit the image sizes it offers based on what it knows about the size of the original. Thanks to Fredrik Ekelund.
* Fixes to CSS asset URL generation to pass validation.
* Performance: eliminated use of `$or` MongoDB queries with regard to pages in the trash. MongoDB tests demonstrate that `$ne: true` is faster than `$or` for our purposes.

## 2.63.0

Unit tests passing.

Regression tests passing.

* “Promise events” have arrived. This is a major feature. Promise events will completely
replace `callAll` in Apostrophe 3.x. For 2.x, all existing invocations of `callAll` in the
core Apostrophe module now also emit a promise event. For instance, when the `docBeforeInsert`
callAll method is invoked, Apostrophe also emits the `beforeInsert` promise event on the 
apostrophe-docs` module.

Other modules may listen for this event by writing code like this:

```javascript
`self.on('apostrophe-docs:beforeInsert', 'chooseASpecialist', function(req, doc, options) {
  // Modify `doc` here. You may return a promise, and it will resolve before
  // any more handlers run. Then the doc is inserted
});
```

The above code adds a new `chooseASpecialist` method to your module. This way, the method can be overridden by assigning a new function to `self.chooseASpecialist` in a module that
extends it, or its behavior can be extended in the usual way following the `super` pattern.

But, since it does not have the same name as
the event (attempting to register a method of the same name will throw an error), it is unlikely
that parent class modules and subclass modules will have unintentional conflicts.

See the [original github issue](https://github.com/apostrophecms/apostrophe/issues/1415) for a more
complete description of the feature and the reasoning behind it.

**Your existing callAll methods will still work.** But, we recommend you start migrating to be
ready to move to 3.x in the future... and because returning promises is just a heck of
a lot nicer. You will have fewer problems.

* Optional SVG support for `apostrophe-attachments`. To enable it, set the `svgImages` option to
`true` when configuring the `apostrophe-attachments` module. SVG files can be uploaded just like
other image types. Manual cropping is not available. However, since most SVG files play very well
with backgrounds, the SVG file is displayed in its entirety without distortion at the largest size
that fits within the aspect ratio of the widget in question, if any (`background-size: contain`
is used). If you have overridden `widget.html` for `apostrophe-images-widgets`, you will want
to refer to the latest version of `widgetBase.html` for the technique we used here to ensure
SVG files do not break the slideshow’s overall height.
* New `apos.templates.prepend` and `apos.templates.append` methods. Call
`apos.templates.prepend('head', function(req) { ... })` to register a function to be called just after
the head tag is opened each time a page is rendered. The output of your function is inserted into
the markup. The standard named locations are `head`, `body`, `contextMenu` and `main`. This is
convenient when writing modules that add new features to Apostrophe. For project level work also see the
named Nunjucks blocks already provided in `outerLayoutBase.html`.
* `apos.singleton` now accepts an `areaOptions` option, which can receive any option that can be
passed to `apos.area`. Thanks to Manoj Krishnan.
* Apostrophe’s “projector” jQuery plugin now respects the `outerHeight` of the tallest slideshow item,
not just the inner height.
* `apos.area` now accepts an `addLabel` option for each widget type in the area. Thanks to
Fredrik Ekelund.
* UI improvements to versioning. Thanks to Lars Houmark.
* Button to revert to the current version has been replaced with a label indicating it is current,
since reverting to the current version has no effect.
* “Page settings” can now be accessed for any page in the trash via “reorganize.” When
working with `apostrophe-workflow`, this is
often required to commit the fact that a page is in the trash.
* The `uploadfs` module now has a `prefix` option. If present, the prefix is prepended to all uploadfs paths before they reach the storage layer, and is also prepended to URLs. In practice, this means that a single S3 bucket can be used to host multiple sites without all of the uploaded media jumbling together in `/attachments`. The `apostrophe-multisite` module now leverages this.

## 2.62.0

Unit tests passing.

Regression tests passing.

* Introduced a `findWithProjection()` method that is added to all MongoDB collection objects. All Apostrophe core modules are migrating towards using this method rather than `find()` when working **directly with MongoDB collections**. If you are using the standard MongoDB 2.x driver that is included with Apostrophe, this just calls regular `find()`. When using the forthcoming `apostrophe-db-mongo-3-driver` module to replace that with a newer driver that supports the full features of MongoDB 3.6, 4.0 and beyond, this method will provide backwards compatibility by accepting a projection as the second argument like `find()` did until the 3.x driver was released. Developers wishing to be compatible with both drivers will want to start using this method. Again, this **only concerns you if you are querying MongoDB directly and passing a projection to find() as the second argument**. And if you don't care about using the 3.x driver, you **do not have to change anything**.
* Various UX improvements and bug fixes to the page versions dialog box. Thanks to Lars Houmark.
* The widget wrapper is updated on the fly with new classes if they change due to edits. Thanks to Fredrik Ekelund.
* When configuring a `date` field, you may pass a `pikadayOptions` property. This object is passed on to the `pikaday` library. Thanks to Lars Houmark.
* The `counts: true` option for `piecesFilters` now works properly with joins.

## 2.61.0

Unit tests passing.

Regression tests passing.

* New "secrets" feature in `apostrophe-users` makes it easy to hash other "secrets" similar in spirit to passwords.
* This feature is now used for password reset tokens, making them more secure.
* Additional joins can now be added to the schema of a widget that extends `apostrophe-pieces-widgets`.
* Brute force password attacks against an Apostrophe server are now more difficult. Thanks to Lars Houmark.
* Tolerant sanitization of array items while they are still in the editor. This avoids confusion caused by `required` fields in the array editor.
* Error messages now behave sensibly when multiple label elements appear in a field. Thanks to Lars Houmark.
* Fix background color on notification on uploads when file extension is not accepted. Thanks to Lars Houmark.
* If you can't move a widget out of an area, you can no longer move widgets into that area either (movable: false is fully enforced). Thanks to Fredrik Ekelund.
* New browser-side events are emitted during the attachment upload process, and the built-in facility that delays the saving of a form until attachment uploads are complete has been fixed. Thanks to Lars Houmark.
* Fixes to the active state display of array items. Thanks to Lars Houmark.
* [Contributor Guide](https://github.com/apostrophecms/apostrophe/blob/master/CONTRIBUTING.md) expanded with lots of new information about practical ways to contribute to Apostrophe.
* [Contributor Covenant Code of Conduct](https://github.com/apostrophecms/apostrophe/blob/master/CODE_OF_CONDUCT.md) added to the project. The Apostrophe community is a welcoming place, and now is a great time to lock that in for the future.

## 2.60.4

Unit tests passing.

Regression tests passing.

* Shallowly clone the required definition in defineRelatedType to prevent yet more crosstalk between instances of apos when `apostrophe-multisite` is used. No other changes.

## 2.60.3

Unit tests passing.

Regression tests passing.

* Improved support for nested areas and widgets. Apostrophe now pushes the correct doc id and dot path all the way to the page in various situations where this could previously have led to errors at save time.
* The new `apos.locks.withLock(lockName, fn)` method can be used to execute a function while the process has the named lock. This ensures that other processes cannot run that function simultaneously. You may optionally pass a callback, otherwise a promise is returned. Similarly `fn` may take a callback, or no arguments at all, in which case it is expected to return a promise.
* Cleanup: don't call `server.close` unless we've succeeded in listening for connections.

## 2.60.2

Unit tests passing.

Regression tests passing.

* Version 2.60.1 broke validation of schema fields which were
`required`, but blank because they were hidden by `showFields`.
This is of course permitted, `required` applies only if the field
is active according to `showFields` or not addressed by any
`showFields` possibilities at all. Comprehensive unit testing was
added for this issue to prevent a recurrence.
* Version 2.60.1 also introduced a more subtle issue: if constraints
like `required` or `min`, or general improvements to validation such
as NaN detection for integers and floats, were added to a widget schema later
after content already existed then it became impossible to open a widget
editor and correct the issues. Validation tolerance was added for this
situation.
* When a user edits an area "in context" on the page, the server now
reports errors using a path that can be used to identify the widget
responsible and open its editing dialog box. A more relevant notification
is also displayed. This remains a secondary mechanism. Server-side
validation is mostly about preventing intentional abuse. Browser-side
validation is still the best way to provide feedback during data entry.

## 2.60.1

Unit tests passing.

Regression tests passing.

* Fields of type `checkboxes` now play nicely with the `live/draft` toggle of `apostrophe-workflow`.
* Improved validation of integers and floats. Thanks to Lars Houmark.
* The "Global" dialog box now follows the same pattern as that for other piece types, which means that the workflow dropdown menu is available if workflow is present.
* Options may be passed to the `express.static` middleware that serves the `public` folder, via the `static` option of the `apostrophe-express` module. Thanks to Leonhard Melzer.
* `apostrophe` now depends on `bluebird` properly and there are no lingering references to the wrong version fo `lodash`. Formerly we got away with this because some of our dependencies did depend on these, and npm flattens dependencies. Thanks to Leonhard Melzer.
* The new `eslint-config-punkave` ruleset is in place, and includes a check for "unofficial dependencies" in `require` calls that could go away suddenly.
* `fieldClasses` and `fieldAttributes` may be set on form fields themselves, similar to the existing `classes` and `attributes` properties that are applied to the `fieldset`. Thanks to Lars Houmark.
* The "Pages" admin UI now includes a "New Page" button, in addition to the usual "reorganize" functionality. Thanks to Lars Houmark.
* Fixed a crash when an `apostrophe-pieces-widget` is configured to always show all pieces via `by: 'all'`. Thanks to Aurélien Wolz.
* General UI styling improvements and fixes.

## 2.60.0

Unit tests passing.

Regression tests passing.

* New feature: you can now display counts for each tag, joined item, etc. when using the `piecesFilters` option of `apostrophe-pieces-pages`. Just add `counts: true` to the configuration for that filter. The count is then available in a `.count` property for each value in the array. See [creating filter UI with apostrophe-pieces-pages](https://apostrophecms.org/docs/tutorials/intermediate/cursors.html#creating-filter-u-i-with-code-apostrophe-pieces-pages-code) for more information.
* New feature: command line tasks such as `apostrophe-blog:generate` may now be run programmatically, for example: `apos.tasks.invoke('apostrophe-blog:generate', { total: 50 })`. A promise is returned if a callback is not passed. Note that not all tasks are written to behave politely and invoke their callback normally, however most do. This feature is most useful when writing tasks that logically should incorporate other tasks.
* Many UX and UI improvements that make the experience more pleasant in subtle and not-so-subtle ways. Thanks to Carsten, Marco Arnone and the prolific Lars Houmark for their contributions. This was an excellent week for Apostrophe PRs.
* The full set of controls for joined items are again available in the chooser, as well as in the browse modal.
* The automatic opening of the admin bar menu on page load can now be configured with the `openOnLoad`, `openOnHomepageLoad`, and `closeDelay` options.
* `autocomplete="off"` for date fields prevents chrome autocomplete suggestions from wrecking calendar UI.
* Always remove .apos-global-busy on unlock, even if the transition event never fires. Yes, that is sadly a thing. Prevents the UI from becoming unusable in rare situations (less rare inside functional tests).
* Use `one` to reduce the overhead of .apos-global-busy's transition event handler. We could do more here to reduce overhead, i.e. unhooking it entirely.
* Much-improved validation of `min`, `max` and `required` for strings, integers and floats on both the server and the browser side. Thanks to Lars Houmark.

## 2.59.1

Unit tests passing.

Regression tests passing.

* Widget schemas now support the `def` property for fields. This always worked for pieces and pages.
* Accommodations for functional testing in nightwatch. The currently active Apostrophe modal, and all of its proxies such as its controls that are in a separate div for presentation reasons, now has the attribute `data-apos-modal-current` which is set to the class name of the modal. This powers the new [apostrophe-nightwatch-tools](https://npmjs.org/package/apostrophe-nightwatch-tools) module, which provides reusable commands and steps that can be used to create test projects similar to our [apostrophe-enterprise-testbed](https://github.com/apostrophecms/apostrophe-enterprise-testbed). Testing with the enterprise testbed project is a standard part of our release process.
* Previously if workflow was in use slugs could not be reused by new pages when the original page was in the trash. This has been addressed; the slug is now deduplicated in the same way that email addresses and usernames of users are when in the trash.
* The infinite scroll feature of `apostrophe-pieces-pages` now works as documented with the styles provided. The code is also more efficient and scroll events are throttled for performance. Thanks to Lars Houmark.
* Various UX fixes, thanks to Lars Houmark and various members of the Apostrophe team.

## 2.59.0

Unit tests passing.

Regression tests passing.

* Fixed nested widget editing for existing widgets whose modal dialog boxes have been accessed (#1428).
* A clear warning message with instructions has been added for those who are seeing "unblessed" messages due to widget schemas and in-template `apos.area` calls that do not match (#1429). The easiest way to avoid this is to just mark the area `contextual: true` in your widget schema so it is edited *only* on the page. But if you really want to do both, the widget options must match.
* The mechanism that automatically makes slugs, paths and other keys unique now gives up eventually and reports the original duplicate key error. This makes it easier to debug your code if you are violating your own custom indexes that feature unique keys. It is possible to make the deduplicator aware of your own own properties that need to be made more unique on inserts if you wish, by implementing a `docFixUniqueError` method. *Please note:* this change is not a regression. Code that formerly never completed its task in this situation will simply report an error promptly rather than retrying inserts forever while degrading your database performance.
* A new profiling API has been added: the `apos.utils.profile` method. This method can be called to report how long code takes to run for later analysis. It does nothing in the default implementation; modules like our forthcoming profiler override it to give feedback on the speed of your code.

## 2.58.0

Unit tests passing.

Regression tests passing.

* Polymorphic joins have arrived! You may now create joins like this:

```javascript
{
  name: '_items',
  type: 'joinByArray',
  withType: [ 'apostrophe-blog', 'product', 'apostrophe-page' ]
}
```

When you join with more than one type, Apostrophe presents a chooser that allows you to pick between tabs for each type. Note that `apostrophe-page` can be included, so you can pick a mix of pages and pieces for the same join.

This feature is useful for creating navigation that may point to a variety of document types, without the need for an array of items with several different joins and a `select` element to choose between them.

Polymorphic joins work for both `joinByOne` and `joinByArray`. Currently they are **not** available for `joinByOneReverse`, `joinByArrayReverse`, or pieces filters. Their primary use case is creating navigation widgets.

* `apos.images.srcset` helper function added. You can use this function to generate a `srcset` attribute for responsive display of an image. Just pass an attachment to the helper:

`<img srcset="{{ apos.images.srcset(apos.images.first(data.piece.thumbnail)) }}" />`

A `src` attribute for backwards compatibility is always advisable too.

Thanks to Fredrik Ekelund for this contribution.

* Fast forms for big schemas are back! The issue with tags has been resolved.

* A single MongoDB connection may be reused by several `apos` objects for separate sites, a feature which is exploited by the [apostrophe-multisite](https://github.com/apostrophecms/apostrophe-multisite) module. Note that this only reuses the connection, it does not share a single MongoDB database. It *does* allow you to keep potentially hundreds of sites on a single MongoDB server or replica set, as the overhead of multiple logical "databases" is small in MongoDB's modern WiredTiger storage engine. To reuse a connection, pass it to the `apostrophe-db` module as the `db` option.

* Fixed a MongoDB 3.6 incompatibility in the "Apply to Subpages" feature for permissions. Also made this feature available again when *removing* someone's permissions. We plan further UX work here to make this feature easier to understand and use.

* UX fix to the "manage tags" dialog box: don't attempt to add an empty tag. Thanks to Anthony Tarlao.

* Warn developers if they use bad area names.

* For those deploying asset bundles to S3: the command line task that builds an asset bundle no longer requires access to your production database, although it still needs to start up normally with access to a database in the pre-production environment where you are building the bundle.

* Refactoring of the trash field deduplication features, in preparation to extend them to pages as well in an upcoming release.

## 2.57.2

Unit tests passing.

Relevant regression tests passing.

* New `extraHtml` block in `outerLayoutBase.html` allows your `outerLayout.html` to add attributes to the outer `html` element without the need to completely override the layout. It is a best practice to avoid completely overriding the layout because this maximizes your compatibility with future updates to our admin markup, etc.

## 2.57.1

Unit tests passing.

* Hotfix for bug in 2.57.0 that broke saving tags. We have reverted the "fast forms" change until the cause is understood.

## 2.57.0

Unit tests passing.

Functional tests passing.

* Displaying and saving schema-driven forms is much, much faster.
This becomes very noticeable with 100 or more fields. With about
250 fields, this formerly took about 4.5 seconds to load or to 
save such a form on a fast Mac. It now takes about 250 milliseconds.
* Users may re-order the items they have selected via drag and drop
when using "Browse" to select pieces, images, etc.
* Prior to this release, asset generation ids were surprisingly short and
made up only of digits due to an accidental holdover from an old version.
Conflicts were rare, but possible. Asset generation ids are now proper cuids,
no conflicts should occur.
* IDs may be added to notifications as a simple way to give other
code access to them.
* The `apos.global.addGlobalToData` method may now be called
with just `req` (returns a promise), with `req, callback` (invokes
the callback), or as middleware (which Apostrophe does by default).
This method is handy in command line tasks and other places
where middleware does not run and `req.data.global` is not populated
by default.

## 2.56.0

Unit tests passing.

Functional tests passing.

* **Security:** numerous issues formerly flagged by the new `npm audit` command have been addressed. We are now using a [maintained branch of lodash 3.x](https://github.com/sailshq/lodash) to keep bc while addressing security (many thanks to the Sails team). We are also using LESS 3.x, which has caused no issues in our testing and corrects security concerns with LESS 2.x. Numerous `npm audit` security reports regarding `imagemin` modules were addressed by removing `imagemin` from `uploadfs` itself, however you may opt into it via the new [`postprocessors` option of `uploadfs`](https://github.com/punkave/uploadfs). As of this writing, one `npm audit` complaint remains: the `azure-storage` module needs to update a dependency to address a possible vulnerability. You may mitigate this issue by not using the `azure` backend of `uploadfs` with Apostrophe until it is resolved upstream.
* Many UI enhancements when choosing, browsing and managing items which reduce user confusion. For instance: moving items up and down in a selection no longer refreshes the entire list and forces the user to scroll down again. Trashed pages are easier to distinguish in "reorganize." "More" dropdown for pieces is again fully visible when clicked. Placeholder helpers make the search field for joins easier to understand. Chevrons added to various select elements which were difficult to identify as dropdowns before. 
* Deeply nested areas now save properly. Formerly in certain situations the same widget might be duplicated.
* `apos.tasks.getReq` now supplies an empty `req.data` object for easier use with code expecting an Express request, Apostrophe-style.
* Bedeviled by case-sensitive sorting? The `sortify: true` property for `string` schema fields is now documented and automatically creates a database migration to ensure it is available for your existing data as well. When used, this flag ensures that any `sort('fieldname')` call for that field in Apostrophe is case-insensitive, ignores punctuation and otherwise behaves as end users expect.

## 2.55.2

Unit tests passing.

Relevant functional tests passing.

* Reverted change to date formatting. `moment` will produce warnings again, but dates will not be a day old in some time zones, which is more important. We are working on a better fix for this problem.

## 2.55.1

Unit tests passing.

Relevant functional tests passing.

* `apos.migrations.eachArea` no longer crashes the stack when iterating over a large number of documents without areas.

## 2.55.0

Unit tests passing.

Regression tests passing.

* Security fix: uploaded images "in the trash" were still accessible at the same URL in most sizes. This has been corrected. As documented, the only size that now remains accessible is the `one-sixth` size, and this choice can be changed or eliminated entirely. **This bug did not affect other file attachments, such as PDFs.**

As always, be sure to run the `apostrophe-migrations:migrate` task. This will make sure the permissions of your files are correct. Harmless warnings may appear for those that were already correct.

* The `apostrophe-attachments:migrate-to-disabled-file-key` and `apostrophe-attachments:migrate-from-disabled-file-key` have been added for the convenience of those using the `disabledFileKey` option to `uploadfs` to rename disabled files in a cryptographically sound way rather than changing their permissions. These are relevant only with the `local` storage option of `uploadfs`, since since the option is neither available nor necessary for S3, and is mandatory for Azure from the beginning.

* Although technically part of UploadFS 1.9.0, we'd like to note that the `azure` storage backend is now available and can be part of your `uploadfs` configuration for the `apostrophe-attachments` module.

* Server-side modules can now extend the buttons available in the "manage" modal of pieces without overriding templates, similar to the way they are extensible in the "edit" modal.

* UX fixes.

* Cropping an image through Apostrophe now works when attachments are stored in S3, Azure, etc.

* Date parsing does not generate `momentjs` warnings.

* Overrideable block in the outerLayout for the context menu.

* The `apostrophe-soft-redirects` module now accepts a `statusCode` option, which you may change to `301` to use hard redirects. Thanks to Leo Melzer. 

## 2.54.3

Unit tests passing.

Regression tests passing.

* Contextual editing of pieces found in a `widget.html` template saves properly, as does contextual editing of a nested area added to the page for the first time.

* Previously executed migrations are remembered in a collection that persists, not just in a cache, avoiding extra work which could be extensive in a large database. Migrations are still required to be idempotent (they should detect whether they have any work to do, and do no harm if they are not needed again for a particular document).

* `apos.migrations.eachWidget` now delivers an accurate `dotPath`, which is crucial for the use of `apos.docs.db.update` with `$set`. No standard migrations in Apostrophe were using the feature until now.

## 2.54.2

Unit tests passing.

Regression tests passing.

* A bug in the recently introduced `apostrophe-soft-redirects` module caused crashes in cases where the context page or piece had no `_url` property... which is an unusual situation (how did you get there exactly? Overrides are clearly involved), but it can happen in customized projects. Fixed.

## 2.54.1

Unit tests passing.

Regression tests passing.

* A bug in Chrome 66 causes problems when selecting images in Apostrophe's media library. This bug did not appear before Chrome 66 and does not appear in other browsers. We resolved it by migrating to the use of the CSS grid feature in compatible browsers.

## 2.54.0

Unit tests passing.

Regression tests passing.

* Several performance improvements. In situations where Apostrophe formerly made expensive "matching nothing" queries, Apostrophe now either skips the entire query or uses an efficient query for a nonexistent `_id`, depending on whether the method in question has the right to cancel the entire operation.
* Resources released more completely by `apos.destroy`, which can now satisfy the expectations of `mocha` 5.x (no timeouts left active, etc). This was done by adding a `destroy` method to `uploadfs`.
* `range` schema fields behave better when there is no existing value.
* Save operation of a modal now triggers the global busy state to prevent race conditions and other unwanted behavior.
* Global busy state can now be pushed and popped, and modals utilize this, so that a modal can be used to gather information during the `saveContent` method of another modal.

## 2.53.0

Unit tests passing.

Regression tests passing.

* Do not send X-XSRF-TOKEN headers in an OPTIONS request. This change was mistakenly left out of the 2.52.0 release.
* The named anchor `main` can now be overridden via the `mainAnchor` nunjucks block.
* The `npmRootDir` option can be used to cause Apostrophe's module loading mechanism to seek npm modules in a location other than that specified by `rootDir` (or the project root). The new `localesDir` option of `apostrophe-i18n` does the same for localization. This makes it possible to use `rootDir` to specify an alternate location for everything else, i.e. the parent of `public`, `data`, `lib/modules`, etc. A necessary accommodation for the evolving `apostrophe-multisite` module.
* Raw HTML widgets now offer help text out of the box.
* The `express.static` middleware now runs before the `apostrophe-global` middleware and other "standard" Apostrophe middleware. 
* Your own module-level `expressMiddleware` object can specify `{ when: 'beforeRequired', middleware: function(req, res, next) { ... })` to run before the required middleware as well. Note that this means no sessions, no users and no body parser. Most of the time you'll want those things.
* CSS adjustment to tabs in modals so they don't scroll in Firefox.
* Dropzones for empty areas are easier to drop onto.

## 2.52.0

Unit tests passing.

Regression tests passing.

* No more 404's when slugs change for pages and pieces. Apostrophe now automatically implements "soft redirects" to the new URL of a page or piece. This is a major SEO improvement, with good support for any page or piece with a `._url` property. Note that this feature "learns" URLs over time as the pages and pieces are actually accessed, so if you decide to test it, remember that you must access the old URL at least once before you change it for the test. This feature can be disabled, if you really want to, by setting the `enable` option of the `apostrophe-soft-redirects` module to `false`.
* Indexed queries on the `parkedId` and `advisoryLock._id` properties. The lack of indexes for these properties could lead to full collection scans, so this is a significant performance boost on large databases.
* Apostrophe's anti-CSRF forgery X-XSRF-TOKEN header is no longer sent as part of an OPTIONS request, or as part of a cross-domain request. In the first case, cookies cannot be set by the server anyway, and in the second, we are communicating with a server that cannot see our session to verify it. In both cases, sending the headers was causing configuration headaches for developers. Thanks to Priyansh Gupta.
* A UI bug fix: the recently added "clone" button for widgets is no longer displayed for singletons, or for areas whose `limit` has been reached. Also, the `cloneable: false` option can be used to disable this feature for a particular area.
* UI bug fix: no more conflicts between the "Add Content" menu and the up/down/remove/etc. buttons for widgets.
* Clearer warnings and error messages.

## 2.51.1

Unit tests passing.

Regression tests passing.

* Do not crash when updating a doc if widgets exist but `_originalWidget` does not. This can happen in workflow scenarios where Apostrophe's `find` is bypassed.
* Accommodations for the forthcoming `apostrophe-optimizer` module.

## 2.51.0

Unit tests passing.

Regression tests passing.

* Widget fields may now have a `permission` property. If present, the user must have the named permission (such as `admin`), or they will not see that particular field in the editing dialog box. This is useful when a widget should be authorable by most users but has a sensitive field that should be restricted to a smaller group of users. Note that this feature already existed for schema fields of pieces and pages.
* Apostrophe again allows a named pipe to be specified via the `PORT` environment variable, for compatibility with Windows. Thanks to Jørgen M. Skogås for this fix.
* Apostrophe's default settings for the `bodyParser` option are now generous enough, in the case of JSON request bodies, to cover all reasonable editing scenarios in Apostrophe. This change also benefits the `apostrophe-headless` module.
* When Apostrophe must generate a `path` for a new page, it will look at the provided `slug` before it looks at the provided `title`. This is useful when titles in an import are of poor quality but slugs are unique. Prevents unnecessary numbered suffixes after both slugs and paths.
* The dropdown menu to add a widget no longer has a conflict with the hover menu offering widget controls such as "up," "down," etc. The hover menu does not appear while the dropdown menu is open.

## 2.50.0

Unit tests passing.

Regression tests passing.

* Clone button for widgets in areas, to save time when editing.
* New features for displaying the titles of array items when editing fields of type `array`. `titleField` may now use dot notation. In addition, if that isn't enough, you may use `listItemTemplate` to point to an alternative to the standard `arrayListItem.html` template, which you may use as a reference. In addition, both `titleField` dot notation and the custom `listItemTemplate` have full access to joins. Be sure to use cross-module include syntax if you don't want to put the template in `lib/modules/apostrophe-schemas/views`. For instance, you may write `listItemTemplate: 'my-module-name:listItemTemplate.html'`.
* Bug fix: modals are the right height when jQuery 3 is in use.
* CSS class added to the `h4` that displays the title in an `apostrophe-images` widget, for your CSS styling convenience. Thanks to Gareth Cooper.

## 2.49.0

Unit tests passing.

Regression tests passing.

* New password reset feature. You will need to configure `apostrophe-email` and opt into this feature. See the new [Apostrophe password reset HOWTO](https://apostrophecms.org/docs/tutorials/howtos/password-reset.html).
* Significant performance boost to the "reorganize" modal in situations where numerous pages are in the trash when using the `apostrophe-workflow` module.
* If widget ids are not provided when inserting new documents they are automatically generated. This makes [apostrophe-headless](https://npmjs.org/package/apostrophe-headless) easier to use.

## 2.48.0

Unit tests passing.

Regression tests passing.

* New `color` and `range` schema field types. `color` provides a color picker field allowing values compatible with CSS, etc. `range` provides an `<input type="range">` element and respects `min` and `max` options.
* New `apos.utils.log`, `apos.utils.info`, `apos.utils.debug`, `apos.utils.warn` and `apos.utils.error` methods. These are now used consistently throughout Apostrophe core, both in the server and in the browser. On the server, these methods wrap the corresponding methods of a `logger` object and you can inject your own via the `logger` option of the `apostrophe-utils` module. By default a logger object that wraps the `console` object is created. For convenience, if your logger has no `log` method, `apos.utils.log` will call `logger.info`. This allows many popular loggers like `winston` to be used without modification "out of the box."
* `modulesSubdir` option to specify subdir where local modules come from, overriding `lib/modules`. Useful when more than one `apos` object exists in a project.
* Major speedup to parked pages. Also eliminates spurious warnings about inefficient joins at startup.
* Refactored autocollapse behavior of admin bar into its own method for easier overrides.
* CSS fixes for improved usability.

## 2.47.0

Unit tests passing.

Regression tests passing.

* Developers now have the option to use jQuery 3. To enable jQuery 3, set the `jQuery` option of the `apostrophe-assets` module to the number `3`. We have packaged specific versions of jQuery 3 and jQuery UI which are known to be compatible with and tested with Apostrophe's UI, and we plan to use these in our own projects going forward. We will be making this change in the apostrophe boilerplate project. Of course Apostrophe's UI remains compatible with the older version of jQuery that loads by default. There is no bc break.

* When you join with pages, by using the virtual doc type `apostrophe-page`, the user is now invited to choose a page via a version of the reorganize dialog box, which has been made more user-friendly for this purpose. Autocomplete is still supported too.

* The reorganize dialog box is more pleasant to use. This dialog will continue to evolve to offer more of the functionality found in the "manage" dialog boxes for piece types.

* The page parking mechanism has been overhauled and improved. From now on, it is our recommendation that you set a unique `parkedId` for each parked page you configure for `apostrophe-pages`. This ensures that even if you change the slug in the configuration of the parked page, Apostrophe will still be able to understand that the page already exists and a new one should not be inserted. This is especially critical if using `apostrophe-workflow`, since you might decide to add or change locale prefixes at some point.

* The database connection keepalive mechanism now uses a query against an empty collection, rather than a server status call that the database user might not have permission to make.

* The `apos.utils.cssName` helper now preserves double dashes, as they are a common feature in modern CSS frameworks.

* There is now an `apostrophe-areas:widgetBase.html` file which can be extended block by block in a project-level `lib/modules/apostrophe-areas/views/widget.html` file. New overrideable methods have also been added to simplify adding custom classes programmatically to the wrapper and the widget itself without overriding any templates.

* It is now possible to configure select elements (we do not recommend more than one) to be displayed inline with the other widget controls, i.e. up, down, delete, etc. The back end of this is left to the developer, however you can check out the still-evolving [apostrophe-personas](https://github.com/apostrophecms/apostrophe-personas) module for an example. This feature is primarily meant for modules like `apostrophe-personas` that impact all widgets in a general way.

## 2.46.1

Unit tests passing.

Regression tests passing.

* Attachment fields now save properly when directly part of the schema of a widget. A bug was introduced in version 2.42.0 when the `length` property was added to attachments. A fix made long ago to `apos.utils.clonePermanent` on the server side was also needed on the browser side.

## 2.46.0

Unit tests passing.

Regression tests passing.

* The "Copy" button of pieces now copies areas that do not explicitly appear in the schema, and works correctly when an `apostrophe-pieces` module is set `contextual: true`. Overrideable methods are provided for those who need to copy more than schema fields and top-level areas. We do not copy every property by default because this could have unforeseen consequences; we copy only what is in the schema, plus top-level areas because these have always been supported without an explicit schema in templates.

* It is now possible to secure widget properties so that they are not visible to end users if you do not choose to output them in the markup. To do that, set the `playerData` option of your widget module to `false`, or to an array of properties that **should** be visible in the `data` JSON attribute so that they are passed to the `play()` method. Normally widget properties are public information, intended for display, but this technique is useful if you have a `username` and `password` for use in fetching an external feed in a server-side `load` method, for instance. **Note that to allow widget editing to function, everything is still passed in `data` if the user has editing privileges for the widget.** So if you seek to verify this feature, be sure to check as a logged-out user, or a user without editing permissions for that content.

* It is now easy to override the `fieldset` markup for Apostrophe schemas. Just copy `lib/modules/apostrophe-schemas/views/fieldset.html` to your project-level version of that path and edit it. However, please note that you must continue to have an outer wrapper element with the given attributes.

* Apostrophe's codebase now passes `eslint`. In the process many cases of callback errors being ignored were fixed, as well as global variable leaks.

* Apostrophe's `apos.locks.lock` and `apos.locks.unlock` methods now support promises.

## 2.45.0

Unit tests passing.

Regression tests passing.

* The `apostrophe-caches` module has better, clearer documentation and it now supports promises.
* All modules can now conveniently send email using [Nodemailer](https://nodemailer.com/about/). The new `email` method of all modules renders a template in that module's `views` folder, exactly as you would hope it would, and also automatically generates a plaintext version for the occasional user who does not view HTML email. The automatically generated versions include links properly.
* Extending `apostrophe-images-widgets` and other pieces widgets is easier. If your widget name doesn't correspond to the kind of piece you are displaying, a helpful error appears explaining that you need to set `piecesModuleName`. Adding fields to these widgets now behaves reasonably. Also, if you add fields to `apostrophe-images` or `apostrophe-files` at project level, this now behaves as expected too.
* A locking mechanism has been added during the movement of pages in the page tree. This prevents rare race conditions that could previously have resulted in duplicate page ranks, although the design of the page tree is such that more serious consequences were always avoided.
* Text justification options for ckeditor are now standard in our build of ckeditor. Of course you still need to configure `sanitize-html` properly when using them.
* Any widgets module may now specify a `wrapperTemplate` option. That template is rendered instead of the standard `apostrophe-areas:widget.html` template, and can use `extends` and override blocks found in that template. This is useful if you need to set attributes of the outer wrapper element of the widget.
* The migration added in 2.43.0 to address file permissions for existing attachments in the trash has been greatly accelerated, helpful on large sites.
* Better error messages for `min` and `max` options of some schema field types; provisions for expanded error messages in general.
* For those using the `testModule` option to test their own npm modules in the context of Apostrophe, a default shortname is automatically provided.
* Fixed missing space in admin bar markup, thanks to arlecchino.

## 2.44.0

Unit tests passing.

Regression tests passing.

* Apostrophe's AJAX filter features for `apostrophe-pieces-pages` now support "Load More" buttons and infinite scroll.

To add a "Load More" button:

1. Wrap a new element inside your data-apos-ajax-context element around the content that makes up the current "page" of results. This should not wrap around filter links or the "Load More" button itself.
2. Give that new element the `data-apos-ajax-append` attribute.
3. Add `append=1` to the query string of your Load More button. Example:

```
{% if data.currentPage < data.totalPages %}
  <a href="{{ data.url }} | build({ page: data.currentPage + 1, append: 1 })">Load More...</a>
{% endif %}
```

To progressively enhance this for infinite scroll, add a `data-apos-ajax-infinite-scroll` attribute to the button.

Note that we do this via progressive enhancement of a "Load More" button so that Google can still reach and index all of the pages (SEO).

* Attachment schema fields now respect the new `fileGroup` and `fileGroups` properties. If `fileGroup` is set to `images`, then only image types (GIF, JPEG, PNG) are accepted; if it is set to `office` only typical business file types are accepted. Note that we have always rejected files that didn't appear on the list for either type. You can also specify `fileGroups` as an array.
* `fileGroup: 'image'` is now configured by default for `apostrophe-images`, as was always intended but incorrectly implemented in the past.
* Attachment schema fields now respect the new `extension` and `extensions` properties. The former is handy if you only want to allow one extension, the latter if you want to allow more than one. The extensions must be those specified for `fileGroups` in the default configuration of `apostrophe-attachments` or your override of it (all lower case; JPEG is `jpg`; no period).
* The `addDocReferences` migration has been parallelized, as this one-time migration can be time-consuming on a large site.
* Broken `less` calculation fixed, thanks to Antoine COMBES.

## 2.43.0

Unit tests passing.

Regression tests passing.

* When a "file" or "image" is moved to the trash, the attachment in question now becomes inaccessible. This is particularly important to stop access to obsolete PDFs, which Google loves to access. If the file or image is removed from the trash, the attachment becomes available again. In the case of images, the 1/6th size remains available by default to provide preview when viewing the trash. If the same attachment is referenced by more than one doc, which can happen due to "Copy" operations or `apostrophe-workflow`, it remains available until all such docs are in the trash.

* Parked properties are no longer editable in page settings. Since every site restart always wiped them out anyway, this is a bug fix, not a truly new behavior. With this change, you can finally set `type: 'home'` when `park`ing the home page, and remove `home` from your page types dropdown.

* The `apostrophe-jobs` module now offers a `runNonBatch` method, which is useful for long-running operations that don't involve iterating over many instances of the same type of object.

* Improvements to background image positioning for images widgets.

* A block has been added to override the `lang` attribute easily. Thanks to Ayho.

* The `imgAlt` block can now be used to conveniently override the `alt` attribute of images when overriding `widget.html` for `apostrophe-images-widgets`. Thanks to Raphaël DiRago.

* The `required` option now works properly for fields of type `array` (there must be at least one item in the array).

* Improved error messages for unblessed widget schemas. These are usually related to a widget that is no longer in the page template but appears in the database.

* A UI bug that caused tabs to become invisible when returning from nested dialog boxes has been fixed.

* Filters for "select" fields now default to "no opinion," rather than the default choice. This is the normal behavior for other field types.

* Even more promise support! `apos.attachments.insert`, `pieces.trash` and `pieces.rescue` all return promises if no callback is given.

* A YouTube embed unit test was removed to ensure consistent results in Travis CI, which is once again in routine use.

## 2.42.1

Unit tests passing.

* Use of a capitalized filename that should have been lowercase in a `require` briefly broke Apostrophe's initialization on Linux. We are correcting this by reinstating CI in a Linux environment.

## 2.42.0

Unit tests passing.

Regression tests passing.

* Promises have landed in Apostrophe. Calling `toArray`, `toObject`, `toDistinct` or `toMongo` on an Apostrophe cursor *without a callback* will return a promise. That promise will resolve to the expected result.

In addition, `docs.insert`, `docs.update`, `pieces.insert`, `pieces.update`, and `pages.insert` will all return a promise if invoked without a callback.

These are the most frequently invoked functions in Apostrophe that formerly required callbacks.

**As always with promises, be sure to catch errors with `.catch()`** at some level.

Note that **the `await` keyword can now be used with these methods**, as long as you're running Node.js 8.x or newer or using Babel to provide that language feature.

* Apostrophe's custom `Split` CKEditor toolbar control now works correctly in 2.x. You can give your users the `Split` control to allow them to break up a large rich text widget in order to insert other types of widget "in the middle." Note that the control name is now capitalized to match the way other CKEditor toolbar buttons are named.

* You may now specify `_url: 1` or `_nameOfJoin: 1` in a projection when using Apostrophe's `find()` methods. Native MongoDB projections naturally can't see these "computed properties" because they don't live in the database — they are computed "on the fly" after documents are fetched. However, Apostrophe now automatically adds the right underlying fields to the projection.

Only `_url` and the names of `joinByOne` or `joinByArray` fields are supported. It does not make sense to use a projection on `people` to locate IDs that are actually attached to `products` via `joinByOneReverse` or `joinByArrayReverse`.

*This feature does not conflict with legitimate uses of MongoDB projections because Apostrophe discards all properties beginning with `_` when writing to the database, except for `_id`.*

* The `length` property of an Apostrophe `attachment` object is now correctly populated with the original file size. Thanks to David Keita. Note that images are also made available in many scaled sizes. Also the original may be replaced with a correctly rotated version, in which case `length` will not match. So the most useful scenario for this property is likely to be in working with office formats, especially PDF which can sometimes be very large.

* Fixed bug in the `isEmpty` methods for areas and singletons. Thanks to David Keita.

## 2.41.0

Unit tests passing.

Regression tests passing.

* The new `apostrophe-jobs` module, part of the core of Apostrophe, provides a progress meter mechanism and the ability to stop long-running user-initiated operations, such as batch operations on pieces. See the [jobs module documentation](http://apostrophecms.org/docs/modules/apostrophe-jobs/index.html). You can also refer to the pieces module for examples if you wish to use this for your own long-running user-initiated operations.
* Batch operations now have more robust support for "select everything." A number of bugs related to multiple selection of pieces have been fixed in a refactoring that made this code much more maintainable and predictable.
* The option of pushing an asset of type `template`, which never worked in 2.x and was never used by Apostrophe, has been removed for clarity. Our preference is for rendering assets on the server side dynamically when needed, rather than pushing many templates into the DOM on every page load.
* An `.editorconfig` file has been added. Thanks to Fredrik Ekelund.
* Parking a page only pushes permanent properties. `_defaults` and `_children` should never have been in the database; they are of course still interpreted to decide what should happen, but the properties *themselves* did not belong in the database. (You may need to write a migration if they are already there and this is causing issues for you.)
* Scrolling UI behavior of pieces improved; various other UI touch-ups. Thanks to Fredrik Ekelund.
* `newBrowserCalls` helper for `push` module can be used when you want JavaScript calls queued up with `req.browserCall` to be executed in an AJAX update of just part of a page.
* Fixed bugs affecting access to the published/unpublished batch operations and similar.

## 2.40.0

Unit tests passing.

Regression tests passing.

* Support for "select everything" when managing pieces. Once you check the box to select everything on the current page, you are given a secondary option to select everything that matches your current criteria. This works both when choosing pieces for widgets and when working with batch operations like "trash" or "rescue."
* Fixed various bugs affecting combinations of "select all on page", the chooser and working with images.
* Improvements to batch operations on pieces. The `requiredField` property is checked correctly, and the new `onlyIf` property allows for passing a function that accepts the doc type name and decides whether the button should appear. Multiword action names are properly camelcased. New "success" and "dataSource" options to `batchSimple` allow for carrying out additional operations afterward as well as gathering input independently at the start. And batch operations are composed late so that other modules can add them.
* The `self.api` and `self.html` methods of `apostrophe-context` and `apostrophe-modal` now support a syntax for making cross-module API calls, just like templates.
* Addressed moog versioning issue with latest npm that caused errors about "synth.instanceOf" not being found depending on the state of your npm cache.

## 2.39.2

Unit tests passing.

Startup-related regression tests passing.

* The `APOS_MONGODB_LOG_LEVEL` environment variable can now be set to `debug`, `info` or anything else supported by the MongoDB driver's `Logger.setLevel` method. This is helpful for debugging database issues at the lowest level.

## 2.39.1

Unit tests passing.

Regression tests passing.

* Factored out a `getBaseUrl` method for `apostrophe-pages`, allowing
overrides of this that pay attention to `req`.
* Report `pageBeforeSend` errors and failures to load the global doc properly, don't silently tolerate them.
* Documentation corrections. Thanks to Frederik Ekelund.
 

## 2.39.0

Unit tests passing.

Regression tests passing.

* Easier access to options. Introduced the `getOption` method to all modules. Calling `self.getOption(req, 'sizes.large')` from your module's server-side JavaScript code, or just `module.getOption('sizes.large')` from Nunjucks, will return the value of `self.options.sizes.large` for that module. You may also pass an array of keys, i.e. `module.getOption([ 'sizes', 'large' ])`. This method is tolerant, it returns undefined if any part of the path does not exist. See also the new [apostrophe-override-options](https://npmjs.org/package/apostrophe-override-options) which extends this feature to support customizing the returned value for any option based on the current page type, page settings, piece settings and locale. * Helpful warning when maximum area/widget loader recursion level is reached. Always use projections when adding joins to your schema to avoid a performance hit due to runaway recursion.
* New `disabledTypes` option to `apostrophe-pages`, primarily for use with `apostrophe-override-options`.
* Fixed UI bug relating to area menus at the bottom of the page.
* Fixed bug that caused a crash when invalid usernames attempted to log in. Thanks to Arthur.

## 2.38.0

Unit tests passing.

Regression tests passing.

* Various schema field validators for required fields no longer crash on the browser side if a property is nonexistent, as opposed to being the expected empty string.
* Buttons for editing pieces widgets now use less confusing language.
* Accommodations for the `apostrophe-headless` module (arriving later today), including factoring out certain login-related and piece-related functionality to separate methods in order to make it easier to introduce RESTful APIs for the same features.
* Unit tests no longer drop the entire test database between suites; instead they drop the collections. Also the unit test timeout can be set via an environment variable. This accommodates testing against various cloud databases with security that precludes dropping entire databases.
* Lots of new content in the README to get folks who haven't been to the documentation site yet a little more excited.

## 2.37.2

Unit tests passing.

Conflict resolution and template extension-related regression tests passing.

* The conflict resolution feature, which helps users avoid conflicts in which neither is successfully able to save content reliably by explaining that two users are editing the same doc and offering the option of taking control, can now be disabled by setting the `conflictResolution` option of the `apostrophe-docs` module explicitly to `false`. **We do not recommend** the use of this option in normal practice, however it has valid applications in automated testing.

* Recently a bug was introduced in which extensions other than `.html` or `.njk` did not work in `include` statements, etc. in Nunjucks templates unless the file in question existed in the project-level version of the module including it. The full cascade of template folder paths is now supported for these explicit extensions, including searching `viewsFolderFallback`.

## 2.37.1

Unit tests passing.

Piece- and schema-related regression tests passing.

* Filters are now available for schema fields of type `integer`. You can configure these for the manage view, or for pieces-pages, exactly as you would for other field types. Previously this feature existed but did not function properly, so this is a patchlevel release rather than a minor version bump.
* Previously, when viewing pieces in the trash, the batch operation button initially read "Trash Items" rather than "Rescue Items." It did not match the selected operation in the select element, and did not perform the needed operation of rescuing items unless you switched operations and switched back again. This has been fixed.

## 2.37.0

Unit tests passing.

Regression tests passing.

* New feature: you may now use the `.njk` file extension in addition to `.html` for your Nunjucks templates. In order to maximize the usefulness of this feature in the context of existing Apostrophe code, `.njk` is still checked for even if `.html` was specified when calling the `render` method. `.njk` is a convention adopted by the Nunjucks community and is supported by some syntax highlighters.
* Bug fix: drag-and-drop reordering and movement of widgets is once again functional. (The arrows worked all along.)
* Bug fix: drag-and-drop targets for widgets residing in areas nested in other widgets now appear and function properly.


## 2.36.3

Unit tests passing.

Regression tests passing.

* If an oembed provider responds with an HTTP error and a response that is not parseable as XML or JSON, Apostrophe no longer crashes (this fix is actually in the oembetter npm module). This fixes crashes on non-embeddable YouTube videos.
* If the oembed provider issues a 401 or 404 error, a relevant error message is given. Otherwise the generic error icon is still given.

## 2.36.2

Unit tests passing.

Regression tests passing.

* Dragging and dropping will now automatically scroll the "reorganize" dialog box.
* Attempts to drag a page above or below the "Home" page in "reorganize" no longer cause a restart. Also, the interface rejects them gracefully.
* Attempts to drag a page below the trashcan are rejected gracefully.
* When `trashInSchema` is active, the "traditional" trash can sorts below "in-context" trash, and the traditional trash can receives the special label "Legacy Trash" to reduce confusion.
* When on page two (or higher) in the "manage" view of pieces, performing a text search now correctly resets to page one.
* Throw an error at startup if a forbidden schema field name is used in `addFields` configuration. For instance, `type` is forbidden for widget schemas, while `docPermissions` is forbidden for doc type schemas, and `_id` is forbidden for both. Note that field names like `title` that are already in the schema are *not* forbidden because re-adding a schema field replaces it, which is often done to change the label, etc. So we'll be adding more documentation about these to help developers avoid surprises if their intention was an entirely new field.

## 2.36.1

Unit tests passing.

Regression tests passing.

* Spurious conflict resolution warnings for pieces fixed.
* Notifications are spaced properly, and in the upper right corner as intended, on all screens.
* Reorganize feature: upgraded to jqtree 1.4.2. Regression testing found no bc breaks.
* A debugging convenience: the `log(true)` cursor filter logs MongoDB criteria objects resulting from the cursor in question to the console.

## 2.36.0

Unit tests passing.

Regression tests passing.

* You may now set the `skipInitialModal` option for any widget module to `true` in order to avoid displaying the editing dialog box when the widget is first added. This makes sense if the widget has a useful default behavior, or consists of a contextually editable rich text sub-widget with a "style" select element you might or might not need to set every time.
* Fields in Apostrophe's schema-driven forms now receive globally unique `id` attributes, and the `for` attributes of `label` elements now reference them properly.

## 2.35.1

Unit tests passing.

Regression tests passing.

* Intermittent "not blessed" errors when editing joins in widget schemas have been corrected by blessing all widget schemas at page serve time, just as we already bless all doc type schemas at page serve time. Blessing them when the individual routes fire is problematic because of probable race conditions with sessions.

## 2.35.0

Unit tests passing.

Regression tests passing.

* `apos.areas.isEmpty(data.page, 'body')` will now tell you if that area is considered empty (it contains no widgets, or the widgets consider themselves empty).

* The new `controls` option may be passed to any widget, via `apos.singleton` or via the configuration for that specific widget type in an `apos.area` call. In this example, the widget cannot be removed, cannot be moved, and has its controls positioned at the upper right instead of the upper left:

```
{{
  apos.singleton(data.page, 'footer', 'apostrophe-rich-text', {
    controls: {
      removable: false,
      movable: false,
      position: 'top-right'
      }
    }
  })
}}
```

The `position` suboption may be set to `top-left`, `top-right`, `bottom-left` or `bottom-right`. 

The `removable` and `movable` suboptions are primarily intended for singletons.

* By popular demand, the `insert` and `update` methods of pieces now pass the piece to their callback as the second argument.

* Better CSS reset for Apostrophe's admin UI.

* `callOne` added for convenience when you want to invoke a method normally invoked by `callAll` in the same way, but for only one module. Thanks to Arthur.

* If an attachment does not exist, `apos.attachments.url` no longer results in a template error page. Instead a fallback icon is displayed and an error message is logged. Developers should still always check whether attachments and joined objects still exist in their templates. Thanks to Raphaël DiRago.

* Notifications within modals move to lower right corner of modal for readability.

* Cleaned up font paths.

* Accommodations for the latest release of the separately published apostrophe-workflow module.

## 2.34.3

Unit tests passing.

Regression tests passing.

A bug was fixed that prevented nested area editing. The bug appeared in version 2.34.0.

Note that editing an area on the page has never been possible when it is part of the schema of an array field. That is not a new issue. It is being tracked and discussed. Today's fix was for a regression that impacted all nested areas.

## 2.34.2

All tests passing.

Fixed a bug that generated an error message regarding conflict resolution when attempting to edit an area inside a piece editor dialog box.

## 2.34.1

All tests passing.

Fixed an issue impacting unit test harness only. It didn't come up initially because it had to do with automatically creating `test/node_modules`, which existed our dev environment.

No code changes outside of tests.

## 2.34.0

All tests passing.

* Conflict resolution has been added to Apostrophe. When two users attempt to edit the same document, whether "in context" on the page or via a dialog box, Apostrophe now makes the latecomer aware of the issue and gives them the option to take control of the document after warning that the first party could lose work.

Since the first user may have simply abandoned their work, Apostrophe also indicates how long it has been since the first user last made a change.

If the same user attempts to edit a document in two tabs or windows, something very similar happens, although the message is different.

* In a related change, Apostrophe does not begin attempting to save an area on the page until the user interacts with it for the first time. This fixes many commonly reported frustrating situations in which one user is editing and the other is logged in but merely looking at the page, creating a ping-pong exchange of save requests.

* Apostrophe's unit tests have been restructured so that a single test file can be run conveniently, via `mocha test/docs.js`, for instance, and there is no longer a need for us to update `test/test.js` every time a test is added. Also, the unit tests use the same `apos.tasks.getReq` and `apos.tasks.getAnonReq` methods that are used by real-life command line tasks, which provide a more faithful simulation of an Express request object and one we anticipate extending as needed.

## 2.33.1

All tests passing.

* Fixed potential crash in version pruning mechanism.

## 2.33.0

All tests passing.

* The login page can be disabled via the new `localLogin` option of the `apostrophe-login` module. Set it explicitly to `false` to disable the login URL completely.
* Refactoring: the `apostrophe-login` module now has an `afterLogin` method which takes care of invoking the `loginAfterLogin` callAll method on all modules that have one, and then redirecting appropriately. This code was factored out to make it easier to use in the new [apostrophe-passport](https://npmjs.org/package/apostrophe-passport) module, which allows the use of almost any [Passport](http://passportjs.org)-based strategy, such as Facebook login, Google login, Github login, etc.
* `apos.users.ensureGroup` now delivers the group to its callback as the second argument.

Thanks to Michelin for their support of this work.

## 2.32.0

All tests passing.

* Fixed an S3 asset bundle generation bug that caused `.less` files to be imported with the wrong file extension if the `public` folder did not yet exist at the time `--create-bundle` was used. Thanks to Michelin for their support of this work.

* Also added an `apostrophe-caches:clear` task to aid in testing various functionality. You must specify the cache name since caches may or may not even be known to Apostrophe at task startup time based on whether and when code calls `.get` for each cache name.

## 2.31.0

All tests passing.

* The new `testModule: true` option causes Apostrophe to supply much of the boilerplate for a published npm apostrophe module that wants to test itself as part of an apostrophe instance, i.e. apostrophe-workflow, apostrophe-caches-redis, etc. See those modules for examples of usage. This is a feature for those writing their own npm modules that wish to unit test by initializing Apostrophe and loading the module in question.

* Fixed caching bugs, notably the oembed cache, which is now operating properly. Oembed responses, such as YouTube iframe markup, are now cached for an hour as originally intended which improves frontend loading time.

* Page type changes only refreshed the schema fields on the first change — now they do it properly after every change.

* Page type changes use the "busy" mechanism while refreshing the schema fields to prevent user interface race conditions and avoid user confusion.

* `trash` is never offered as a schema field of the `global` doc (mainly a concern with `apostrophe-workflow`).

## 2.30.0

All tests passing.

It is now easier to set up Redis or another alternative session store:

```
'apostrophe-express': {
  session: {
    secret: 'your-secret-here',
    store: {
      name: 'connect-redis',
      options: {
        // redis-specific options here
      }
    }
  }
}
```

For bc, you can still pass a live instance of a store as the `store` option, but this way is easier; all you have to do is `npm install --save` your connect-compatible session store of choice and configure it.

Thanks to Michelin for their support of this work.

## 2.29.2

All tests passing.

* Overrideable widgetControlGroups method takes (req, widget, options) allowing for better control when customizing these buttons.
* The `createControls` option of the `apostrophe-pages` module is now respewcted properly.

## 2.29.1

All tests passing.

* Fixed a short-lived issue with the reorganize feature.

## 2.29.0

All tests passing.

This is a significant update containing various accommodations required by the shortly forthcoming Apostrophe 2.x version of the `apostrophe-workflow` module, as well as other recent enhancements in our queue.

* Editing an area "in context" on the page when it is part of a widget or piece will always work, even if `contextual: true` was not set. That property is optional and prevents the area from also appearing in the dialog box for editing the content type.

* Multiple select filters are now available for the "manage" view of any piece type. Just like configuring single-select filters, except that you'll add `multiple: true` to the relevant object in your `addFilters` configuration for the module. Thanks to Michelin for their support of this work.

* When editing a previous selection of pieces for a join or widget, you can also easily edit them without locating them again in the manage view.

* "Next" and "previous" links can now be easily added to your `show.html` pages for pieces. Just set the `next` and `previous` options for your `apostrophe-pieces-pages` subclass to `true`, or to an object with a `projection` property for best performance. This will populate `data.previous` and `data.next` in your `show.html` template. *For blogs they may seem backwards; they refer to relative position on the index page, and blogs are reverse-chronological. Just switch the terms on the front end in your template in cases where they appear confusing.*

* There is now a "pages" option on the admin bar, for cases where "reorganize" is not visible because "Page Settings" is not accessible to the user for the current page.

* If the `trashInSchema` option is set to `true` when configuring `apostrophe-docs`, pages that are in the trash retain their position in the page tree rather than moving to a separate "trash" subtree. In the "reorganize" interface, they are grouped into trash cans displayed beneath each parent page, rather than a single global trash can. This is necessary for the new workflow module and also helpful in any situation where trying to find pages in the trash is more troublesome than explaining this alternative approach.

When `trashInSchema` is `true`, users can also change the trash status of a piece or page via "Page Settings" or the "Edit" dialog box of the piece, and it is possible to access "Page Settings" for any page via "Reorganize."

* The buttons displayed for each widget in an Apostrophe area can be adjusted via the `addWidgetControlGroups` option of the `apostrophe-areas` module, which can be used to introduce additional buttons.

* Empty `beforeMove` and `afterMove` methods have been added to the `apostrophe-pages` module for the convenience of modules using `improve` to enhance it.

* The `apostrophe-doc-type-manager` module now has `getEditPermissionName` and `getAdminPermissionName` methods. These can be overridden by subclasses. For instance, all page subtypes return `edit-apostrophe-page` for the former because page types can be changed.

* `apos.destroy(function() { ... })` may be called to shut down a running Apostrophe instance. This does **not** delete any data. It simply releases the database connection, HTTP server port, etc. This mechanism is extensible by implementing an `apostropheDestroy` method in your own module.

* `before` option for `expressMiddleware`. As before any module can provide middleware via an `expressMiddleware` property which may be a function or array of functions. In addition, if that property is an object, it may also have a `before` subproperty specifying a module whose middleware should run after it. In this case the actual middleware function or functions must be in a `middleware` subproperty.

* `apos.instancesOf(name)` returns an array of modules that extend `name` or a subclass of it. `apos.instanceOf(object, name)` returns true if the given `object` is a moog instance of `name` or a subclass of it.

* `apos.permissions.criteria` can now supply MongoDB criteria restricted to the types the user can edit when a general permission name like `edit` or `edit-doc` is asked for. *This was never a security bug because permissions for actual editing were checked when individual edits occurred. The change makes it easier to display lists of editable content of mixed types.*

* Extending the indexes of Apostrophe's `aposDocs` collection is easier to achieve in modules that use `improve` to extend `apostrophe-docs`.

* Removed tests for obsolete, unsupported Node.js 0.10.x. Node.js 4.x is now the minimum version. *We do not intend to break ES5 compliance in 2.x, however testing old versions of Node that are not maintained with security patches in any freely available repository is not practical.*

* `insert` method for `apos.attachments`, mirroring the other modules better. Thanks to Arthur Agombart.

## 2.28.0

All tests passing.

* Notifications are available, replacing the use of `alert`. This feature is primarily for Apostrophe's own administrative features; you can use it when extending the editing UI. Call `apos.notify('message')` to display a simple message. You can specify several `type` options such as `error` and `info`, and you can also use `%s` wildcards. Everything is localized on the server side. [See the documentation for more information](http://apostrophecms.org/docs/modules/apostrophe-notifications/browser-apostrophe-notifications.html#trigger). Thanks to Michelin for their support of this work.
* The `apostrophe-images` widget now provides a focal point editor. See the new [responsive images HOWTO](http://apostrophecms.org/docs/tutorials/howtos/responsive-images.html). Thanks to Michelin for their support of this work.
* UX: clicking "edit" on an image you have already selected no longer deselects the image. Thanks to Michelin for their support of this work.
* Bug fix: corrected issue that sometimes prevented joins with pages from editing properly.
* Bug fix: added sort index on `level` and `rank`, preventing MongoDB errors on very large page trees.
* UX: a complete URL is suggested at startup when testing locally. Thanks to Alex Gleason.

## 2.27.1

All tests passing.

* Fixed recently introduced bug preventing page type switching.

## 2.27.0

All tests passing.

* Lazy schema field configuration, in general and especially for joins. No more need to specify `idField`, `idsField`, `relationshipsField` or even `label` for your schema fields. `withType` can be inferred too in many cases, depending on the name of the join field. You can still specify all of the details by hand.

Also, for reverse joins, there is a new `reverseOf` option, allowing you to just specify the name of the join you are reversing. This is much easier to understand than specifying the `idField` of the other join. However that is still permitted.

Lazy configuration is in place for doc types (like pages and pieces) and widget types. It can be extended to other uses of schemas by calling the new validation methods.

* ckeditor 4.6.2. Resolves #896: you can now create links properly in Microsoft Edge. Our policy is now to check in periodically with new ckeditor releases and just make sure they are compatible with our editor skin before releasing them.

* `apos.areas.fromRichText` can be used to create an area with a single rich text widget from a trusted string of HTML. Not intended for mixed media, just rich text. Related: both `fromRichText` and `fromPlaintext` now correctly give their widgets an `_id` property.

## 2.26.1

All tests passing.

* Fixed short-lived bug introduced in 2.26.0 re: detecting missing widget types.

## 2.26.0

All tests passing.

* Do not crash on missing widget types, print good warning messages.

* Complete implementation of the [explicitOrder](http://apostrophecms.org/docs/modules/apostrophe-docs/server-apostrophe-cursor.html#explicit-order) cursor filter, replacing a nonfunctional implementation.

* If the mongodb connection is lost, the default behavior is now to retry it forever, so when MongoDB does get restarted Apostrophe will find it. In addition, a `connect` object may be passed to the `apostrophe-db` module to be passed on to the MongoDB connect call.

* Spaces added between DOM attributes for better HTML5 compliance.

* `required` subfields are now enforced when editing fields of type `array`.

Thanks to Michelin for their support of much of the work in this release.

## 2.25.0

All tests passing.

* There is now a `readOnly` option for the standard schema field types. Thanks to Michelin for contributing this feature.

* Apostrophe now displays useful warnings and, in some cases, errors at startup when schemas are improperly configured. This is particularly useful if you have found it frustrating to configure joins correctly. We are continuing to deepen the coverage here.

* In the manage view, the "published" and "trash" filters now always offer both "yes" and "no," regardless of whether anything is available in those categories. This is necessary because these are the respective defaults, and these are also unusual cases in which it is actually interesting to know nothing is available.

## 2.24.0

All tests passing.

There is now an `object` schema field type. It works much like the `array` schema field type, however there is just one object, represented as an object property of the doc in the database. Thanks to Michelin's development team for contributing this feature.

## 2.23.2

All tests passing.

The options object of `enhanceDate` is now passed on to `pikaday`. Considered a bug fix since the options object was erroneously ignored.

* 2.23.1

All tests passing.

cleanCss needs to know that the output CSS files are going to live in apos-minified in order to correctly parse `@import` statements that pull in plain .css files. Also, the mechanism for prefixing URLs in CSS code was not applied at the correct stage of the bundling process (the minify stage), which broke the ability to reference fonts, images, etc. via URLs beginning with /modules when using an S3 asset bundle.

## 2.23.0

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

## 2.22.0

All tests passing.

* Apostrophe now supports publishing CSS and JS assets via S3 rather than serving them directly.

Apostrophe already had an option to build asset "bundles" and deploy them at startup, as described in our [cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html). However this serves the assets from the cloud webserver, such as a Heroku dyno or EC2 instance. It is now possible to serve the assets from Amazon S3.

See the [updated cloud HOWTO](http://apostrophecms.org/docs/tutorials/howtos/deploying-apostrophe-in-the-cloud.html) for details.

Thanks to Michelin for their support of this work.

* Enforce string field `min` and `max` properties on server side.

* When validation of a form with tabs fails, such as a pieces edit modal, activate the correct tab and scroll to the first error in that tab.

* thanks to Ludovic Bret for fixing a bug in the admin bar markup.

## 2.21.0

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

## 2.20.3

All tests passing.

* The search filter is once again available when choosing images. This involved a deeper fix to modals: filters for sliding modals were not being properly captured and hoisted into the shared part of the outer div. This is now being done exactly as it is done for the controls (buttons) and the instructions.

To avoid incompatibility with existing uses of `self.$filters`, such as in the manage modal, they are captured to `self.$modalFilters`. A small change to the manage modal was needed to take advantage of this.

* Moved a warning message from `console.log` to `console.error`. `stdout` should never be used for warnings and errors. Moving toward clean output so that command line tasks can be safely used in pipelines.

## 2.20.2

All tests passing.

Improved UI for editing widgets. The edit button is no longer separate from the area-related controls such as up, down, etc. This reduces clutter and reduces difficulty in accessing widgets while editing.

## 2.20.1

All tests passing.

When autocompleting doc titles to add them to a join, Apostrophe again utilizes search result quality to display the best results first.

## 2.20.0

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

## 2.19.1

All tests passing.

* When saving any doc with a schema, if an attachment field does not match a valid attachment that has actually been uploaded, that field is correctly nulled out. In addition, if the attachment's file extension is not in a valid fileGroup as configured via the attachments module, the field is nulled out. Finally, the `crop: true` option for attachments is saved successfully. This option allows for attachments to have a crop that is inherent to them, useful when there is no widget standing between the doc and the attachment.

All of these changes correct bugs in intended behavior. Certain checks were present in the code but not completely functional. If you need to update your configuration to add file extensions, [apostrophe-attachments](http://apostrophecms.org/docs/modules/apostrophe-attachments/).

## 2.19.0

All tests passing.

* As always, Apostrophe always populates `req.data.home`; when `req.data.page._ancestors[0]` exists that is used, otherwise Apostrophe carries out a separate query. However as a performance enhancement, you may now disable this additional query by passing the `home: false` option to the `apostrophe-pages` module. Note that `req.data.home` is not guaranteed to exist if you do this.

As for children of the home page, for performance you may now pass `home: { children: false }` option to the `apostrophe-pages` module. This option only comes into play when using `filters: { ancestors: false }`.

Thanks to Michelin for their support of this work.

## 2.18.2

All tests passing.

* Performance enhancement: when fetching `req.data.home` directly in the absence of `req.data.page._ancestors[0]`, such as on the home page itself or a non-page route like `/login`, we must apply the same default filters before applying the filter options, namely `.areas(false).joins(false)`, otherwise duplicate queries are made.

* Fixed bug in as-yet-unused `schemas.export` method caught by babel's linter.

Thanks to Michelin for their support of this work.

## 2.18.0

All tests passing.

* New batch editing features for pieces! You can now use the checkboxes to select many items and then carry out the following operations in one step: trash, rescue from trash, publish, unpublish, tag and untag.

In addition there is a clearly documented procedure for creating new batch editing features with a minimum of new code.

* Several bugs in the array editor were fixed. Up, down and remove buttons work properly again, an aesthetic glitch was resolved and redundant ordinal numbers do not creep in when managing the order of an array without the `titleField` option.

* Logging out completely destroys the session. While the standard behavior of `req.logout` in the Passport module is only to break the relationship between the `user` object and the session, users expect a clean break.

## 2.17.2

All tests passing.

* Members of a group that has the admin permission for a specific piece type can now move pieces of that type to and from the trash. (This was always intended, so this is a bug fix.)
* For better out-of-the-box SEO, an `alt` attribute with the title of the image is now part of the `img` markup of `apostrophe-images` widgets.

## 2.17.1

All tests passing.

* Fixed XSS (cross-site scripting) vulnerability in `req.browserCall` and `apos.push.browserCall`.

* Removed confusing strikethrough of "Apply to Subpages" subform when the permission is being removed rather than added.

* Improved UX of area widget controls.

* Improved modal array tab UI and CSS.

* The `oembedReady` Apostrophe event is now emitted correctly after `apostrophe-oembed` renders an oembed-based player, such as a YouTube video player for the `apostrophe-video` widget. This event can be listened for via `apos.on('apostrophe-oembed', fn)` and receives a jQuery object referring to the relevant element.

## 2.17.0

All tests passing.

* `array` schema fields now accept a `limit` option. They also support the `def` property to set defaults for individual fields. The array editor code has been refactored for better reliability and performance and documentation for the methods has been written.

* Relative `@import` statements now work when you push plain `.css` files as Apostrophe assets. There is no change in behavior for LESS files. Thanks to Fredrik Ekelund.

* Controls such as the "Finished" button of the reorganize modal were floating off the screen. This has been fixed.

## 2.16.1

All tests passing.

* If you have tried using `piecesFilters` with a `tags` field type, you may have noticed that when the query string parameter is present but empty, you get no results. This is suboptimal because that's a common result if you use an HTML form to drive the query. An empty string for a `tags` filter now correctly does nothing.

* In `apostrophe-rich-text-widgets`, initialize CKEditor on `instanceReady`, rather than via a dodgy timeout. Thanks to Frederik Ekelund for finding a better way!

## 2.16.0

All tests passing.

* Reintroduced the reorganize feature for editors who have permissions for some pages but not others. You are able to see the pages you can edit and also their ancestors, in order to navigate the tree. However you are able to drag pages only to parents you can edit.

* Introduced the new `deleteFromTrash` option to the `apostrophe-pages` module. If this option is enabled, a new icon appears in "reorganize" when looking at pages in the trash. This icon allows you to permanently delete a page and its descendants from the site.

The use of this option can lead to unhappy customers if they do not clearly understand it is a permanent action. For that reason, it is disabled by default. However it can be quite useful when transitioning from the initial site build to long-term support. We recommend enabling it during that period and disabling it again after cleanup.

* "Reorganize" no longer displays nonfunctional "view" and "trash" icons for the trash and pages inside it.

* The tests for the `apostrophe-locks` module are now deterministic and should always pass.

## 2.15.2

All tests passing.

Fixed a bug which could cause a crash if the `sort` filter was explicitly set to `search` and no search was actually present. Conditions existed in which this could happen with the autocomplete route.

## 2.15.1

Due to a miscommunication the version number 2.15.0 had been previously used. The description below was originally intended for 2.15.0 and has been published as 2.15.1 purely to address the version numbering conflict.

All tests passing.

* `apos.permissions.addPublic` accepts multiple arguments and array arguments,
adding all of the permission names given including any listed in the arrays.
* Permissions checks for pieces admin routes longer check for req.user, checking for the appropriate `edit-` permission is sufficient and makes addPublic more useful.
* Updated the `i18n` module to address a problem where labels that happened to be numbers rather than strings would crash the template if passed to `__()`.
* Documentation improvements.

## 2.14.3

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
