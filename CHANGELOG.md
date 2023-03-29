# Changelog

## 3.43.0 (2023-03-29)

### Adds

* Add the possibility to override the default "Add Item" button label by setting the `itemLabel` option of an `array` field.
* Adds `touch` task for every piece type. This task invokes `update` on each piece, which will execute all of the same event handlers that normally execute when a piece of that type is updated. Example usage: `node app article:touch`.

### Fixes

* Hide the suggestion help from the relationship input list when the user starts typing a search term.
* Hide the suggestion hint from the relationship input list when the user starts typing a search term except when there are no matches to display.
* Disable context menu for related items when their `relationship` field has no sub-[`fields`](https://v3.docs.apostrophecms.org/guide/relationships.html#providing-context-with-fields) configured.

## 3.42.0 (2023-03-16)

### Adds

* You can now set `style: table` on inline arrays. It will display the array as a regular HTML table instead of an accordion.
See the [array field documentation](https://v3.docs.apostrophecms.org/reference/field-types/array.html#settings) for more information.
* You can now set `draggable: false` on inline arrays. It will disable the drag and drop feature. Useful when the order is not significant.
See the [array field documentation](https://v3.docs.apostrophecms.org/reference/field-types/array.html#settings) for more information.
* You can now set the label and icon to display on inline arrays when they are empty.
See the [array field documentation](https://v3.docs.apostrophecms.org/reference/field-types/array.html#whenEmpty) for more information.
* We have added a new and improved suggestion UI to relationship fields.
* The `utilityOperations` feature of piece types now supports additional properties:
`relationship: true` (show the operation only when editing a relationship), `relationship: false` (never show
the operation when editing a relationship), `button: true`, `icon` and `iconOnly: true`.
When `button: true` is specified, the operation appears as a standalone button rather than
being tucked away in the "more" menu.
* In addition, `utilityOperations` can now specify `eventOptions` with an `event` subproperty
instead of `modalOptions`. This is useful with the new `edit` event (see below).
* Those extending our admin UI on the front end can now open a modal to create or edit a page or piece by calling
`await apos.doc.edit({ type: 'article' })` (the type here is an example). To edit an existing document add an
`_id` property. To copy an existing document (like our "duplicate" feature) add a `copyOf`
property. When creating new pages, `type` can be sent to `@apostrophecms/page` for convenience
(note that the `type` property does not override the default or current page type in the editor).
* The `edit` Apostrophe event is now available and takes an object with the same properties
as above. This is useful when configuring `utilityOperations`.
* The `content-changed` Apostrophe event can now be emitted with a `select: true` property. If a
document manager for the relevant content type is open, it will attempt to add the document to the
current selection. Currently this works best with newly inserted documents.
* Localized strings in the admin UI can now use `$t(key)` to localize a string inside
an interpolated variable. This was accomplished by setting `skipOnVariables` to false
for i18next, solely on the front end for admin UI purposes.
* The syntax of the method defined for dynamic `choices` now accepts a module prefix to get the method from, and the `()` suffix.
This has been done for consistency with the external conditions syntax shipped in the previous release. See the documentation for more information.
* Added the `viewPermission` property of schema fields, and renamed `permission` to `editPermission` (with backwards
compatibility) for clarity. You can now decide if a schema field requires permissions to be visible or editable.
See the documentation for more information.
* Display the right environment label on login page. By default, based on `NODE_ENV`, overriden by `environmentLabel` option in `@apostrophecms/login` module. The environment variable `APOS_ENV_LABEL` will override this. Note that `NODE_ENV` should generally only be set to `development` (the default) or `production` as many Node.js modules opt into optimizations suitable for all deployed environments when it is set to `production`. This is why we offer the separate `APOS_ENV_LABEL` variable.

### Fixes

* Do not log unnecessary "required" errors for hidden fields.
* Fixed a bug that prevented "Text Align" from working properly in the rich text editor in certain cases.
* Fix typo in `@apostrophecms/doc-type` and `@apostrophecms/submitted-drafts` where we were using `canCreate` instead of `showCreate` to display the `Create New` button or showing the `Copy` button in `Manager` modals.
* Send external condition results in an object so that numbers are supported as returned values.

## 3.41.1 (2023-03-07)

No changes. Publishing to make sure 3.x is tagged `latest` in npm, rather than 2.x.

## 3.41.0 (2023-03-06)

### Adds

* Handle external conditions to display fields according to the result of a module method, or multiple methods from different modules.
This can be useful for displaying fields according to the result of an external API or any business logic run on the server. See the documentation for more information.

### Fixes

* Replace `deep-get-set` dependency with `lodash`'s `get` and `set` functions to fix the [Prototype Pollution in deep-get-set](https://github.com/advisories/GHSA-mjjj-6p43-vhhv) vulnerability. There was no actual vulnerability in Apostrophe due to the way the module was actually used, and this was done to address vulnerability scan reports.
* The "soft redirects" for former URLs of documents now work better with localization. Thanks to [Waldemar Pankratz](https://github.com/waldemar-p).
* Destroy `AreaEditor` Vue apps when the page content is refreshed in edit mode. This avoids a leak of Vue apps components being recreated while instances of old ones are still alive.

### Security

* Upgrades passport to the latest version in order to ensure session regeneration when logging in or out. This adds additional security to logins by mitigating any risks due to XSS attacks. Apostrophe is already robust against XSS attacks. For passport methods that are internally used by Apostrophe everything is still working. For projects that are accessing the passport instance directly through `self.apos.login.passport`, some verifications may be necessary to avoid any compatibility issue. The internally used methods are `authenticate`, `use`, `serializeUser`, `deserializeUser`, `initialize`, `session`.

## 3.40.1 (2023-02-18)

* No code change. Patch level bump for package update.

## 3.40.0 (2023-02-17)

### Adds

* For devops purposes, the `APOS_BASE_URL` environment variable is now respected as an override of the `baseUrl` option.

### Fixes

* Do not display shortcut conflicts at startup if there are none.
* Range field correctly handles the `def` attribute set to `0` now. The `def` property will be used when the field has no value provided; a value going over the max or below the min threshold still returns `null`.
* `select` fields now work properly when the `value` of a choice is a boolean rather than a string or a number.

## 3.39.2 (2023-02-03)

### Fixes
* Hotfix for a backwards compatibility break in webpack that triggered a tiptap bug. The admin UI build will now succeed as expected.

## 3.39.1 (2023-02-02)

### Fixes

* Rescaling cropped images with the `@apostrophecms/attachment:rescale` task now works correctly. Thanks to [Waldemar Pankratz](https://github.com/waldemar-p) for this contribution.

## 3.39.0 (2023-02-01)

### Adds

* Basic support for editing tables by adding `table` to the rich text toolbar. Enabling `table` allows you to create tables, including `td` and `th` tags, with the ability to merge and split cells. For now the table editing UI is basic, all of the functionality is there but we plan to add more conveniences for easy table editing soon. See the "Table" dropdown for actions that are permitted based on the current selection.
* `superscript` and `subscript` may now be added to the rich text widget's `toolbar` option.
* Early beta-quality support for adding inline images to rich text, by adding `image` to the rich text toolbar. This feature works reliably, however the UI is not mature yet. In particular you must search for images by typing part of the title. We will support a proper "browse" experience here soon. For good results you should also configure the `imageStyles` option. You will also want to style the `figure` tags produced. See the documentation for more information.
* Support for `div` tags in the rich text toolbar, if you choose to include them in `styles`. This is often necessary for A2 content migration and can potentially be useful in new work when combined with a `class` if there is no suitable semantic block tag.
* The new `@apostrophecms/attachment:download-all --to=folder` command line task is useful to download all of your attachments from an uploadfs backend other than local storage, especially if you do not have a more powerful "sync" utility for that particular storage backend.
* A new `loadingType` option can now be set for `image-widget` when configuring an `area` field. This sets the `loading` attribute of the `img` tag, which can be used to enable lazy loading in most browsers. Thanks to [Waldemar Pankratz](https://github.com/waldemar-p) for this contribution.
* Two new module-level options have been added to the `image-widget` module: `loadingType` and `size`. These act as fallbacks for the same options at the area level. Thanks to [Waldemar Pankratz](https://github.com/waldemar-p) for this contribution.

### Fixes

* Adding missing require (`bluebird`) and fallback (`file.crops || []`) to `@apostrophecms/attachment:rescale`-task

## 3.38.1 (2023-01-23)

### Fixes

* Version 3.38.0 introduced a regression that temporarily broke support for user-edited content in locales with names like `de-de` (note the lowercase country name). This was inadvertently introduced in an effort to improve support for locale fallback when generating static translations of the admin interface. Version 3.38.1 brings back the content that temporarily appeared to be missing for these locales (it was never removed from the database), and also achieves the original goal. **However, if you created content for such locales using `3.38.0` (released five days ago) and wish to keep that content,** rather than reverting to the content from before `3.38.0`, see below.

### Adds

* The new `i18n:rename-locale` task can be used to move all content from one locale name to another, using the `--old` and `--new` options. By default, any duplicate keys for content existing in both locales will stop the process. However you can specify which content to keep in the event of a duplicate key error using the `--keep=localename` option. Note that the value of `--new` should match the a locale name that is currently configured for the `@apostrophecms/i18n` module.

Example:

```
# If you always had de-de configured as a locale, but created
# a lot of content with Apostrophe 3.38.0 which incorrectly stored
# it under de-DE, you can copy that content. In this case we opt
# to keep de-de content in the event of any conflicts
node app @apostrophecms/i18n:rename-locale --old=de-DE --new=de-de --keep=de-de
```

## 3.38.0 (2023-01-18)

### Adds

* Emit a `beforeSave` event from the `@apostrophecms:notification` module, with `req` and the `notification` as arguments, in order to give the possibility to override the notification.
* Emit a `beforeInsert` event from the `@apostrophecms:attachment` module, with `req` and the `doc` as arguments, in order to give the possibility to override the attachment.
* Emit a `beforeSaveSafe` event from the `@apostrophecms:user` module, with `req`, `safeUser` and `user` as arguments, in order to give the possibility to override properties of the `safeUser` object which contains password hashes and other information too sensitive to be stored in the aposDocs collection.
* Automatically convert failed uppercase URLs to their lowercase version - can be disabled with `redirectFailedUpperCaseUrls: false` in `@apostrophecms/page/index.js` options. This only comes into play if a 404 is about to happen.
* Automatically convert country codes in locales like `xx-yy` to `xx-YY` before passing them to `i18next`, which is strict about uppercase country codes.
* Keyboard shortcuts conflicts are detected and logged on to the terminal.

### Fixes

* Invalid locales passed to the i18n locale switching middleware are politely mapped to 400 errors.
* Any other exceptions thrown in the i18n locale switching middleware can no longer crash the process.
* Documents kept as the `previous` version for undo purposes were not properly marked as such, breaking the public language switcher in some cases. This was fixed and a migration was added for existing data.
* Uploading an image in an apostrophe area with `minSize` requirements will not trigger an unexpected error anymore. If the image is too small, a notification will be displayed with the minimum size requirements. The `Edit Image` modal will now display the minimum size requirements, if any, above the `Browse Images` field.
* Some browsers saw the empty `POST` response for new notifications as invalid XML. It will now return an empty JSON object with the `Content-Type` set to `application/json`.

## 3.37.0 (2023-01-06)

### Adds

* Dynamic choice functions in schemas now also receive a data object with their original doc id for further inspection by your function.
* Use `mergeWithCustomize` when merging extended source Webpack configuration. Introduce overideable asset module methods `srcCustomizeArray` and `srcCustomizeObject`, with reasonable default behavior, for fine tuning Webpack config arrays and objects merging. More info - [the Webpack mergeWithCustomize docs](https://github.com/survivejs/webpack-merge#mergewithcustomize-customizearray-customizeobject-configuration--configuration)
* The image widget now accepts a `placeholderImage` option that works like `previewImage` (just specify a file extension, like `placeholderImage: 'jpg'`, and provide the file `public/placeholder.jpg` in the module). The `placeholderUrl` option is still available for backwards compatibility.

### Fixes

* `docId` is now properly passed through array and object fields and into their child schemas.
* Remove module `@apostrophecms/polymorphic-type` name alias `@apostrophecms/polymorphic`. It was causing warnings
    e.g. `A permission.can() call was made with a type that has no manager: @apostrophecms/polymorphic-type`.
* The module `webpack.extensions` configuration is not applied to the core Admin UI build anymore. This is the correct and intended behavior as explained in the [relevant documentation](https://v3.docs.apostrophecms.org/guide/webpack.html#extending-webpack-configuration).
* The `previewImage` option now works properly for widget modules loaded from npm and those that subclass them. Specifically, the preview image may be provided in the `public/` subdirectory of the original module, the project-level configuration of it, or a subclass.

## 3.36.0 (2022-12-22)

### Adds

* `shortcut` option for piece modules, allowing easy re-mapping of the manager command shortcut per module.

### Fixes

* Ensure there are no conflicting command shortcuts for the core modules.

## 3.35.0 (2022-12-21)

### Adds

* Introduced support for linking directly to other Apostrophe documents in a rich text widget. The user can choose to link to a URL, or to a page. Linking to various piece types can also be enabled with the `linkWithType` option. This is equivalent to the old `apostrophe-rich-text-permalinks` module but is included in the core in A3. See the [documentation](https://v3.docs.apostrophecms.org/guide/core-widgets.html#rich-text-widget) for details.
* Introduced support for the `anchor` toolbar control in the rich text editor. This allows named anchors to be inserted. These are rendered as `span` tags with the given `id` and can then be linked to via `#id`, providing basic support for internal links. HTML 4-style named anchors in legacy content (`name` on `a` tags) are automatically migrated upon first edit.
* German translation i18n file created for the Apostrophe Admin-UI. Thanks to [Noah Gysin](https://github.com/NoahGysin) for this contribution.
* Introduced support for keyboard shortcuts in admin UI. Hitting `?` will display the list of available shortcuts. Developpers can define their own shortcuts by using the new `@apostrophecms/command-menu` module and the `commands` property. Please check the [keyboard shortcut documentation](https://v3.docs.apostrophecms.org/guide/command-menu.html) for more details.

### Fixes

* The `bulletList` and `orderedList` TipTap toolbar items now work as expected.
* When using the autocomplete/typeahead feature of relationship fields, typing a space at the start no longer results in an error.
* Replace [`credential`](https://www.npmjs.com/package/credential) package with [`credentials`](https://www.npmjs.com/package/credentials) to fix the [`mout` Prototype Pollution vulnerability](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-7792). There was no actual vulnerability in Apostrophe or credential due to the way the module was actually used, and this was done to address vulnerability scan reports.
* Added a basic implementation of the missing "Paste from Clipboard" option to Expanded Widget Previews.


## 3.34.0 (2022-12-12)

### Fixes

* Nested areas work properly in widgets that have the `initialModal: false` property.
* Apostrophe's search index now properly incorporates most string field types as in A2.

### Adds

* Relationships load more quickly.
* Parked page checks at startup are faster.
* Tasks to localize and unlocalize piece type content (see `node app help [yourModuleName]:localize` and `node app help [yourModuleName]:unlocalize`).
## 3.33.0 (2022-11-28)

### Adds

* You can now set `inline: true` on schema fields of type `array`. This displays a simple editing interface in the context of the main dialog box for the document in question, avoiding the need to open an additional dialog box. Usually best for cases with just one field or just a few. If your array field has a large number of subfields the default behavior (`inline: false`) is more suitable for your needs. See the [array field](https://v3.docs.apostrophecms.org/reference/field-types/array.html) documentation for more information.
* Batch feature for publishing pieces.
* Add extensibility for `rich-text-widget` `defaultOptions`. Every key will now be used in the `AposRichTextWidgetEditor`.

### Fixes

* Prior to this release, widget templates that contained areas pulled in from related documents would break the ability to add another widget beneath.
* Validation of object fields now works properly on the browser side, in addition to server-side validation, resolving UX issues.
* Provisions were added to prevent any possibility of a discrepancy in relationship loading results under high load. It is not clear whether this A2 bug was actually possible in A3.

## 3.32.0 (2022-11-09)

### Adds

* Adds Reset Password feature to the login page. Note that the feature must be enabled and email delivery must be properly configured. See the [documentation](https://v3.docs.apostrophecms.org/reference/modules/login.html) for more details.
* Allow project-level developer to override bundling decisions by configuring the `@apostrophecms/asset` module. Check the [module documentation](https://v3.docs.apostrophecms.org/reference/modules/asset.html#options) for more information.

### Fixes

* Query builders for regular select fields have always accepted null to mean "do not filter on this property." Now this also works for dynamic select fields.
* The i18n UI state management now doesn't allow actions while it's busy.
* Fixed various localization bugs in the text of the "Update" dropdown menu.
* The `singleton: true` option for piece types now automatically implies `showCreate: false`.
* Remove browser console warnings by handling Tiptap Editor's breaking changes and duplicated plugins.
* The editor modal now allocates more space to area fields when possible, resolving common concerns about editing large widgets inside the modal.

## 3.31.0 (2022-10-27)

### Adds

* Adds `placeholder: true` and `initialModal: false` features to improve the user experience of adding widgets to the page. Checkout the [Widget Placeholders documentation](https://v3.docs.apostrophecms.org/guide/areas-and-widgets.html#adding-placeholder-content-to-widgets) for more detail.

### Fixes

* When another user is editing the document, the other user's name is now displayed correctly.

## 3.30.0 (2022-10-12)

### Adds

* New `APOS_LOG_ALL_ROUTES` environment variable. If set, Apostrophe logs information about all middleware functions and routes that are executed on behalf of a particular URL.
* Adds the `addFileGroups` option to the `attachment` module. Additionally it exposes a new method, `addFileGroup(group)`. These allow easier addition of new file groups or extension of the existing groups.

### Fixes

* Vue 3 may now be used in a separate webpack build at project level without causing problems for the admin UI Vue 2 build.
* Fixes `cache` module `clear-cache` CLI task message
* Fixes help message for `express` module `list-routes` CLI task

## 3.29.1 (2022-10-03)

### Fixes

* Hotfix to restore Node 14 support. Of course Node 16 is also supported.


## 3.29.0 (2022-10-03)

### Adds

* Areas now support an `expanded: true` option to display previews for widgets. The Expanded Widget Preview Menu also supports grouping and display columns for each group.
* Add "showQuery" in piece-page-type in order to override the query for the "show" page as "indexQuery" does it for the index page

### Fixes

* Resolved a bug in which users making a password error in the presence of pre-login checks such as a CAPTCHA were unable to try again until they refreshed the page.

## 3.28.1 (2022-09-15)

### Fixes

* `AposInputBoolean` can now be `required` and have the value `false`.
* Schema fields containing boolean filters can now list both `yes` and `no` choices according to available values in the database.
* Fix attachment `getHeight()` and `getWidth()` template helpers by changing the assignment of the `attachment._crop` property.
* Change assignment of `attachment._focalPoint` for consistency.

## 3.28.0 (2022-08-31)

### Fixes

* Fix UI bug when creating a document via a relationship.

### Adds

* Support for uploading `webp` files for display as images. This is supported by all current browsers now that Microsoft has removed IE11. For best results, you should run `npm update` on your project to make sure you are receiving the latest release of `uploadfs` which uses `sharp` for image processing. Thanks to [Isaac Preston](https://github.com/ixc7) for this addition.
* Clicking outside a modal now closes it, the same way the `Escape` key does when pressed.
* `checkboxes` fields now support `min` and `max` properties. Thanks to [Gabe Flores](https://github.com/gabeflores-appstem).

## 3.27.0 (2022-08-18)

### Adds

* Add `/grid` `POST` route in permission module, in addition to the existing `GET` one.
* New utility script to help find excessively heavy npm dependencies of apostrophe core.

### Changes

* Extract permission grid into `AposPermissionGrid` vue component.
* Moved `stylelint` from `dependencies` to `devDependencies`. The benefit may be small because many projects will depend on `stylelint` at project level, but every little bit helps install speed, and it may make a bigger difference if different major versions are in use.

## 3.26.1 (2022-08-06)

### Fixes

Hotfix: always waits for the DOM to be ready before initializing the Apostrophe Admin UI. `setTimeout` alone might not guarantee that every time. This issue has apparently become more frequent in the latest versions of Chrome.
* Modifies the `login` module to return an empty object in the API session cookie response body to avoid potential invalid JSON error if `response.json()` is retrieved.

## 3.26.0 (2022-08-03)

### Adds

* Tasks can now be registered with the `afterModuleReady` flag, which is more useful than `afterModuleInit` because it waits for the module to be more fully initialized, including all "improvements" loaded via npm. The original `afterModuleInit` flag is still supported in case someone was counting on its behavior.
* Add `/grid` `POST` route in permission module, in addition to the existing `GET` one, to improve extensibility.
* `@apostrophecms/express:list-routes` command line task added, to facilitate debugging.

### Changes

* Since Microsoft has ended support for IE11 and support for ES5 builds is responsible for a significant chunk of Apostrophe's installation time, the `es5: true` option no longer produces an IE11 build. For backwards compatibility, developers will receive a warning, but their build will proceed without IE11 support. IE11 ES5 builds can be brought back by installing the optional [@apostrophecms/asset-es5](https://github.com/apostrophecms/asset-es5) module.

### Fixes

* `testModule: true` works in unit tests of external Apostrophe modules again even with modern versions of `mocha`, thanks to [Amin Shazrin](https://github.com/ammein).
* `getObjectManager` is now implemented for `Object` field types, fixing a bug that prevented the use of areas found in `object` schema fields within templates. Thanks to [James R T](https://github.com/jamestiotio).

## 3.25.0 (2022-07-20)

### Adds

* `radio` and `checkboxes` input field types now support a server side `choices` function for supplying their `choices` array dynamically, just like `select` fields do. Future custom field types can opt into this functionality with the field type flag `dynamicChoices: true`.

### Fixes

* `AposSelect` now emits values on `change` event as they were originally given. Their values "just work" so you do not have to think about JSON anymore when you receive it.
* Unpinned tiptap as the tiptap team has made releases that resolve the packaging errors that caused us to pin it in 3.22.1.
* Pinned `vue-loader` to the `15.9.x` minor release series for now. The `15.10.0` release breaks support for using `npm link` to develop the `apostrophe` module itself.
* Minimum version of `sanitize-html` bumped to ensure a potential denial-of-service vector is closed.

## 3.24.0 (2022-07-06)

### Adds

* Handle `private: true` locale option in i18n module, preventing logged out users from accessing the content of a private locale.

### Fixes

* Fix missing title translation in the "Array Editor" component.
* Add `follow: true` flag to `glob` functions (with `**` pattern) to allow registering symlink files and folders for nested modules
* Fix disabled context menu for relationship fields editing ([#3820](https://github.com/apostrophecms/apostrophe/issues/3820))
* In getReq method form the task module, extract the right `role` property from the options object.
* Fix `def:` option in `array` fields, in order to be able to see the default items in the array editor modal

## 3.23.0 (2022-06-22)

### Adds

* Shared Drafts: gives the possibility to share a link which can be used to preview the draft version of page, or a piece `show` page.
* Add `Localize` option to `@apostrophecms/image`. In Edit mode the context bar menu includes a "Localize" option to start cloning this image into other locales.

### Fixes

* Update `sass` to [`1.52.3`+](https://github.com/sass/dart-sass/pull/1713) to prevent the error `RangeError: Invalid value: Not in inclusive range 0..145: -1`. You can now fix that by upgrading with `npm update`. If it does not immediately clear up the issue in development, try `node app @apostrophecms/asset:clear-cache`.
* Fix a potential issue when URLs have a query string, in the `'@apostrophecms/page:notFound'` handler of the `soft-redirect` module.

## 3.22.1 (2022-06-17)

* Hotfix: temporarily pin versions of tiptap modules to work around packaging error that breaks import of the most recent releases. We will unpin as soon as this is fixed upstream. Fixes a bug where `npm update` would fail for A3 projects.

## 3.22.0 (2022-06-08)

### Adds

* Possibility to pass options to webpack extensions from any module.

### Fixes

* Fix a Webpack cache issue leading to modules symlinked in `node_modules` not being rebuilt.
* Fixes login maximum attempts error message that wasn't showing the plural when lockoutMinutes is more than 1.
* Fixes the text color of the current array item's slat label in the array editor modal.
* Fixes the maximum width of an array item's slat label so as to not obscure the Remove button in narrow viewports.
* If an array field's titleField option is set to a select field, use the selected option's label as the slat label rather its value.
* Disable the slat controls of the attachment component while uploading.
* Fixes bug when re-attaching the same file won't trigger an upload.
* AposSlat now fully respects the disabled state.

## 3.21.1 (2022-06-04)

### Fixes

* Work around backwards compatibility break in `sass` module by pinning to `sass` `1.50.x` while we investigate. If you saw the error `RangeError: Invalid value: Not in inclusive range 0..145: -1` you can now fix that by upgrading with `npm update`. If it does not immediately clear up the issue in development, try `node app @apostrophecms/asset:clear-cache`.

## 3.21.0 (2022-05-25)

### Adds

* Trigger only the relevant build when in a watch mode (development). The build paths should not contain comma (`,`).
* Adds an `unpublish` method, available for any doc-type.
An _Unpublish_ option has also been added to the context menu of the modal when editing a piece or a page.
* Allows developers to group fields in relationships the same way it's done for normal schemas.

### Fixes

* Vue files not being parsed when running eslint through command line, fixes all lint errors in vue files.
* Fix a bug where some Apostrophe modules symlinked in `node_modules` are not being watched.
* Recover after webpack build error in watch mode (development only).
* Fixes an edge case when failing (throw) task invoked via `task.invoke` will result in `apos.isTask()` to always return true due to `apos.argv` not reverted properly.

## 3.20.1 (2022-05-17)

### Fixes

* Minor corrections to French translation.

## 3.20.0

### Adds

* Adds French translation of the admin UI (use the `fr` locale).

## 3.19.0

### Adds

* New schema field type `dateAndTime` added. This schema field type saves in ISO8601 format, as UTC (Universal Coordinated Time), but is edited in a user-friendly way in the user's current time zone and locale.
* Webpack disk cache for better build performance in development and, if appropriately configured, production as well.
* In development, Webpack rebuilds the front end without the need to restart the Node.js process, yielding an additional speedup. To get this speedup for existing projects, see the `nodemonConfig` section of the latest `package.json` in [a3-boilerplate](https://github.com/apostrophecms/a3-boilerplate) for the new "ignore" rules you'll need to prevent nodemon from stopping the process and restarting.
* Added the new command line task `apostrophecms/asset:clear-cache` for clearing the webpack disk cache. This should be necessary only in rare cases where the configuration has changed in ways Apostrophe can't automatically detect.
* A separate `publishedLabel` field can be set for any schema field of a page or piece. If present it is displayed instead of `label` if the document has already been published.

### 3.18.1

### Fixes

* The admin UI now rebuilds properly in a development environment when new npm modules are installed in a multisite project (`apos.rootDir` differs from `apos.npmRootDir`).

## 3.18.0 (2022-05-03)

### Adds

* Images may now be cropped to suit a particular placement after selecting them. SVG files may not be cropped as it is not possible in the general case.
* Editors may also select a "focal point" for the image after selecting it. This ensures that this particular point remains visible even if CSS would otherwise crop it, which is a common issue in responsive design. See the `@apostrophecms/image` widget for a sample implementation of the necessary styles.
* Adds the `aspectRatio` option for image widgets. When set to `[ w, h ]` (a ratio of width to height), images are automatically cropped to this aspect ratio when chosen for that particular widget. If the user does not crop manually, then cropping happens automatically.
* Adds the `minSize` option for image widgets. This ensures that the images chosen are at least the given size `[ width, height ]`, and also ensures the user cannot choose something smaller than that when cropping.
* Implements OpenTelemetry instrumentation.
* Developers may now specify an alternate Vue component to be used for editing the subfields of relationships, either at the field level or as a default for all relationships with a particular piece type.
* The widget type base module now always passes on the `components` option as browser data, so that individual widget type modules that support contextual editing can be implemented more conveniently.
* In-context widget editor components now receive a `focused` prop which is helpful in deciding when to display additional UI.
* Adds new configuration option - `beforeExit` async handler.
* Handlers listening for the `apostrophe:run` event are now able to send an exit code to the Apostrophe bootstrap routine.
* Support for Node.js 17 and 18. MongoDB connections to `localhost` will now successfully find a typical dev MongoDB server bound only to `127.0.0.1`, Apostrophe can generate valid ipv6 URLs pointing back to itself, and `webpack` and `vue-loader` have been updated to address incompatibilities.
* Adds support for custom context menus provided by any module (see `apos.doc.addContextOperation()`).
* The `AposSchema` component now supports an optional `generation` prop which may be used to force a refresh when the value of the object changes externally. This is a compromise to avoid the performance hit of checking numerous subfields for possible changes every time the `value` prop changes in response to an `input` event.
* Adds new event `@apostrophecms/doc:afterAllModesDeleted` fired after all modes of a given document are purged.

### Fixes

* Documentation of obsolete options has been removed.
* Dead code relating to activating in-context widget editors have been removed. They are always active and have been for some time. In the future they might be swapped in on scroll, but there will never be a need to swap them in "on click."
* The `self.email` method of modules now correctly accepts a default `from` address configured for a specific module via the `from` subproperty of the `email` option to that module. Thanks to `chmdebeer` for pointing out the issue and the fix.
* Fixes `_urls` not added on attachment fields when pieces API index is requested (#3643)
* Fixes float field UI bug that transforms the value to integer when there is no field error and the first number after the decimal is `0`.
* The `nestedModuleSubdirs` feature no longer throws an error and interrupts startup if a project contains both `@apostrophecms/asset` and `asset`, which should be considered separate module names.

## 3.17.0 (2022-03-31)

### Adds

* Full support for the [`object` field type](https://v3.docs.apostrophecms.org/reference/field-types/object.html), which works just like `array` but stores just one sub-object as a property, rather than an array of objects.
* To help find documents that reference related ones via `relationship` fields, implement backlinks of related documents by adding a `relatedReverseIds` field to them and keeping it up to date. There is no UI based on this feature yet but it will permit various useful features in the near future.
* Adds possibility for modules to [extend the webpack configuration](https://v3.docs.apostrophecms.org/guide/webpack.html).
* Adds possibility for modules to [add extra frontend bundles for scss and js](https://v3.docs.apostrophecms.org/guide/webpack.html). This is useful when the `ui/src` build would otherwise be very large due to code used on rarely accessed pages.
* Loads the right bundles on the right pages depending on the page template and the loaded widgets. Logged-in users have all the bundles on every page, because they might introduce widgets at any time.
* Fixes deprecation warnings displayed after running `npm install`, for dependencies that are directly included by this package.
* Implement custom ETags emission when `etags` cache option is enabled. [See the documentation for more information](https://v3.docs.apostrophecms.org/guide/caching.html).
It allows caching of pages and pieces, using a cache invalidation mechanism that takes into account related (and reverse related) document updates, thanks to backlinks mentioned above.
Note that for now, only single pages and pieces benefit from the ETags caching system (pages' and pieces' `getOne` REST API route, and regular served pages).
The cache of an index page corresponding to the type of a piece that was just saved will automatically be invalidated. However, please consider that it won't be effective when a related piece is saved, therefore the cache will automatically be invalidated _after_ the cache lifetime set in `maxAge` cache option.

### Fixes

* Apostrophe's webpack build now works properly when developing code that imports module-specific npm dependencies from `ui/src` or `ui/apos` when using `npm link` to develop the module in question.
* The `es5: true` option to `@apostrophecms/asset` works again.

## 3.16.1 (2022-03-21)

### Fixes

* Fixes a bug in the new `Cache-Control` support introduced by 3.16.0 in which we get the logged-out homepage right after logging in. This issue only came into play if the new caching options were enabled.

## 3.16.0 (2022-03-18)

### Adds

* Offers a simple way to set a Cache-Control max-age for Apostrophe page and GET REST API responses for pieces and pages. [See the documentation for more information](https://v3.docs.apostrophecms.org/guide/caching.html).
* API keys and bearer tokens "win" over session cookies when both are present. Since API keys and bearer tokens are explicitly added to the request at hand, it never makes sense to ignore them in favor of a cookie, which is implicit. This also simplifies automated testing.
* `data-apos-test=""` selectors for certain elements frequently selected in QA tests, such as `data-apos-test="adminBar"`.
* Offer a simple way to set a Cache-Control max-age for Apostrophe page and GET REST API responses for pieces and pages.
* To speed up functional tests, an `insecurePasswords` option has been added to the login module. This option is deliberately named to discourage use for any purpose other than functional tests in which repeated password hashing would unduly limit performance. Normally password hashing is intentionally difficult to slow down brute force attacks, especially if a database is compromised.

### Fixes

* `POST`ing a new child page with `_targetId: '_home'` now works properly in combination with `_position: 'lastChild'`.

## 3.15.0 (2022-03-02)

### Adds

* Adds throttle system based on username (even when not existing), on initial login route. Also added for each late login requirement, e.g. for 2FA attempts.

## 3.14.2 (2022-02-27)

* Hotfix: fixed a bug introduced by 3.14.1 in which non-parked pages could throw an error during the migration to fix replication issues.

## 3.14.1 (2022-02-25)

* Hotfix: fixed a bug in which replication across locales did not work properly for parked pages configured via the `_children` feature. A one-time migration is included to reconnect improperly replicated versions of the same parked pages. This runs automatically, no manual action is required. Thanks to [justyna1](https://github.com/justyna13) for identifying the issue.

## 3.14.0 (2022-02-22)

### Adds

* To reduce complications for those implementing caching strategies, the CSRF protection cookie now contains a simple constant string, and is not recorded in `req.session`. This is acceptable because the real purpose of the CSRF check is simply to verify that the browser has sent the cookie at all, which it will not allow a cross-origin script to do.
* As a result of the above, a session cookie is not generated and sent at all unless `req.session` is actually used or a user logs in. Again, this reduces complications for those implementing caching strategies.
* When logging out, the session cookie is now cleared in the browser. Formerly the session was destroyed on the server side only, which was sufficient for security purposes but could create caching issues.
* Uses `express-cache-on-demand` lib to make similar and concurrent requests on pieces and pages faster.
* Frontend build errors now stop app startup in development, and SCSS and JS/Vue build warnings are visible on the terminal console for the first time.

### Fixes

* Fixed a bug when editing a page more than once if the page has a relationship to itself, whether directly or indirectly. Widget ids were unnecessarily regenerated in this situation, causing in-context edits after the first to fail to save.
* Pages no longer emit double `beforeUpdate` and `beforeSave` events.
* When the home page extends `@apostrophecms/piece-page-type`, the "show page" URLs for individual pieces should not contain two slashes before the piece slug. Thanks to [Martí Bravo](https://github.com/martibravo) for the fix.
* Fixes transitions between login page and `afterPasswordVerified` login steps.
* Frontend build errors now stop the `@apostrophecms/asset:build` task properly in production.
* `start` replaced with `flex-start` to address SCSS warnings.
* Dead code removal, as a result of following up on JS/Vue build warnings.

## 3.13.0 - 2022-02-04

### Adds

* Additional requirements and related UI may be imposed on native ApostropheCMS logins using the new `requirements` feature, which can be extended in modules that `improve` the `@apostrophecms/login` module. These requirements are not imposed for single sign-on logins via `@apostrophecms/passport-bridge`. See the documentation for more information.
* Adds latest Slovak translation strings to SK.json in `i18n/` folder. Thanks to [Michael Huna](https://github.com/Miselrkba) for the contribution.
* Verifies `afterPasswordVerified` requirements one by one when emitting done event, allows to manage errors ans success before to go to the next requirement. Stores and validate each requirement in the token. Checks the new `askForConfirmation` requirement option to go to the next step when emitting done event or waiting for the confirm event (in order to manage success messages). Removes support for `afterSubmit` for now.

### Fixes

* Decodes the testReq `param` property in `serveNotFound`. This fixes a problem where page titles using diacritics triggered false 404 errors.
* Registers the default namespace in the Vue instance of i18n, fixing a lack of support for un-namespaced l10n keys in the UI.

## 3.12.0 - 2022-01-21

### Adds

* It is now best practice to deliver namespaced i18n strings as JSON files in module-level subdirectories of `i18n/` named to match the namespace, e.g. `i18n/ourTeam` if the namespace is `ourTeam`. This allows base class modules to deliver phrases to any namespace without conflicting with those introduced at project level. The `i18n` option is now deprecated in favor of the new `i18n` module format section, which is only needed if `browser: true` must be specified for a namespace.
* Brought back the `nestedModuleSubdirs` feature from A2, which allows modules to be nested in subdirectories if `nestedModuleSubdirs: true` is set in `app.js`. As in A2, module configuration (including activation) can also be grouped in a `modules.js` file in such subdirectories.

### Fixes

* Fixes minor inline documentation comments.
* UI strings that are not registered localization keys will now display properly when they contain a colon (`:`). These were previously interpreted as i18next namespace/key pairs and the "namespace" portion was left out.
* Fixes a bug where changing the page type immediately after clicking "New Page" would produce a console error. In general, areas and checkboxes now correctly handle their value being changed to `null` by the parent schema after initial startup of the `AposInputArea` or `AposInputCheckboxes` component.
* It is now best practice to deliver namespaced i18n strings as JSON files in module-level subdirectories of `i18n/` named to match the namespace, e.g. `i18n/ourTeam` if the namespace is `ourTeam`. This allows base class modules to deliver phrases to any namespace without conflicting with those introduced at project level. The `i18n` option is now deprecated in favor of the new `i18n` module format section, which is only needed if `browser: true` must be specified for a namespace.
* Removes the `@apostrophecms/util` module template helper `indexBy`, which was using a lodash method not included in lodash v4.
* Removes an unimplemented `csrfExceptions` module section cascade. Use the `csrfExceptions` *option* of any module to set an array of URLs excluded from CSRF protection. More information is forthcoming in the documentation.
* Fix `[Object Object]` in the console when warning `A permission.can() call was made with a type that has no manager` is printed.

### Changes

* Temporarily removes `npm audit` from our automated tests because of a sub-dependency of vue-loader that doesn't actually cause a security vulnerability for apostrophe.

## 3.11.0 - 2022-01-06

### Adds

* Apostrophe now extends Passport's `req.login` to emit an `afterSessionLogin` event from the `@apostrophecms:login` module, with `req` as an argument. Note that this does not occur at all for login API calls that return a bearer token rather than establishing an Express session.

### Fixes

* Apostrophe's extension of `req.login` now accounts for the `req.logIn` alias and the skippable `options` parameter, which is relied upon in some `passport` strategies.
* Apostrophe now warns if a nonexistent widget type is configured for an area field, with special attention to when `-widget` has been erroneously included in the name. For backwards compatibility this is a startup warning rather than a fatal error, as sites generally did operate successfully otherwise with this type of bug present.

### Changes

* Unpins `vue-click-outside-element` the packaging of which has been fixed upstream.
* Adds deprecation note to `__testDefaults` option. It is not in use, but removing would be a minor BC break we don't need to make.
* Allows test modules to use a custom port as an option on the `@apostrophecms/express` module.
* Removes the code base pull request template to instead inherit the organization-level template.
* Adds `npm audit` back to the test scripts.

## 3.10.0 - 2021-12-22

### Fixes

* `slug` type fields can now have an empty string or `null` as their `def` value without the string `'none'` populating automatically.
* The `underline` feature works properly in tiptap toolbar configuration.
* Required checkbox fields now properly prevent editor submission when empty.
* Pins `vue-click-outside-element` to a version that does not attempt to use `eval` in its distribution build, which is incompatible with a strict Content Security Policy.

### Adds

* Adds a `last` option to fields. Setting `last: true` on a field puts that field at the end of the field's widget order. If more than one field has that option active the true last item will depend on general field registration order. If the field is ordered with the `fields.order` array or field group ordering, those specified orders will take precedence.

### Changes

* Adds deprecation notes to the widget class methods `getWidgetWrapperClasses` and `getWidgetClasses` from A2.
* Adds a deprecation note to the `reorganize` query builder for the next major version.
* Uses the runtime build of Vue. This has major performance and bundle size benefits, however it does require changes to Apostrophe admin UI apps that use a `template` property (components should require no changes, just apps require an update). These apps must now use a `render` function instead. Since custom admin UI apps are not yet a documented feature we do not regard this as a bc break.
* Compatible with the `@apostrophecms/security-headers` module, which supports a strict `Content-Security-Policy`.
* Adds a deprecation note to the `addLateCriteria` query builder.
* Updates the `toCount` doc type query method to use Math.ceil rather than Math.floor plus an additional step.

## 3.9.0 - 2021-12-08

### Adds

* Developers can now override any Vue component of the ApostropheCMS admin UI by providing a component of the same name in the `ui/apos/components` folder of their own module. This is not always the best approach, see the documentation for details.
* When running a job, we now trigger the notification before to run the job, this way the progress notification ID is available from the job and the notification can be dismissed if needed.
* Adds `maxUi`, `maxLabel`, `minUi`, and `minLabel` localization strings for array input and other UI.

### Fixes

* Fully removes references to the A2 `self.partial` module method. It appeared only once outside of comments, but was not actually used by the UI. The `self.render` method should be used for simple template rendering.
* Fixes string interpolation for the confirmation modal when publishing a page that has an unpublished parent page.
* No more "cannot set headers after they are sent to the client" and "req.res.redirect not defined" messages when handling URLs with extra trailing slashes.
* The `apos.util.runPlayers` method is not called until all of the widgets in a particular tree of areas and sub-areas have been added to the DOM. This means a parent area widget player will see the expected markup for any sub-widgets when the "Edit" button is clicked.
* Properly activates the `apostropheI18nDebugPlugin` i18next debugging plugin when using the `APOS_SHOW_I18N` environment variable. The full set of l10n emoji indicators previously available for the UI is now available for template and server-side strings.
* Actually registers piece types for site search unless the `searchable` option is `false`.
* Fixes the methods required for the search `index` task.

### Changes

* Adds localization keys for the password field component's min and max error messages.

## 3.8.1 - 2021-11-23

### Fixes

* The search field of the pieces manager modal works properly. Thanks to [Miro Yovchev](https://github.com/myovchev) for pointing out the issue and providing a solution.
* Fixes a bug in `AposRichTextWidgetEditor.vue` when a rich text widget was specifically configured with an empty array as the `styles` option. In that case a new empty rich text widget will initiate with an empty paragraph tag.
* The`fieldsPresent` method that is used with the `presentFieldsOnly` option in doc-type was broken, looking for properties in strings and wasn't returning anything.

## 3.8.0 - 2021-11-15

### Adds

* Checkboxes for pieces are back, a main checkbox allows to select all page items. When all pieces on a page are checked, a banner where the user can select all pieces appears. A launder for mongo projections has been added.
* Registered `batchOperations` on a piece-type will now become buttons in the manager batch operations "more menu" (styled as a kebab icon). Batch operations should include a label, `messages` object, and `modalOptions` for the confirmation modal.
* `batchOperations` can be grouped into a single button with a menu using the `group` cascade subproperty.
* `batchOperations` can be conditional with an `if` conditional object. This allows developers to pass a single value or an array of values.
* Piece types can have `utilityOperations` configured as a top-level cascade property. These operations are made available in the piece manager as new buttons.
* Notifications may now include an `event` property, which the AposNotification component will emit on mount. The `event` property should be set to an object with `name` (the event name) and optionally `data` (data included with the event emission).
* Adds support for using the attachments query builder in REST API calls via the query string.
* Adds contextual menu for pieces, any module extending the piece-type one can add actions in this contextual menu.
* When clicking on a batch operation, it opens a confirmation modal using modal options from the batch operation, it also works for operations in grouped ones. operations name property has been renamed in action to work with AposContextMenu component.
* Beginning with this release, a module-specific static asset in your project such as `modules/mymodulename/public/images/bg.png` can always be referenced in your `.scss` and `.css` files as `/modules/mymodulename/images/bg.png`, even if assets are actually being deployed to S3, CDNs, etc. Note that `public` and `ui/public` module subdirectories have separate functions. See the documentation for more information.
* Adds AposFile.vue component to abstract file dropzone UI, uses it in AposInputAttachment, and uses it in the confirmation modal for pieces import.
* Optionally add `dimensionAttrs` option to image widget, which sets width & height attributes to optimize for Cumulative Layout Shift. Thank you to [Qiao Lin](https://github.com/qclin) for the contribution.

### Fixes

* The `apos.util.attachmentUrl` method now works correctly. To facilitate that, `apos.uploadsUrl` is now populated browser-side at all times as the frontend logic originally expected. For backwards compatibility `apos.attachment.uploadsUrl` is still populated when logged in.
* Widget players are now prevented from being played twice by the implementing vue component.

### Changes
* Removes Apostrophe 2 documentation and UI configuration from the `@apostrophecms/job` module. These options were not yet in use for A3.
* Renames methods and removes unsupported routes in the `@apostrophecms/job` module that were not yet in use. This was not done lightly, but specifically because of the minimal likelihood that they were in use in project code given the lack of UI support.
  * The deprecated `cancel` route was removed and will likely be replaced at a later date.
  * `run` was renamed `runBatch` as its purpose is specifically to run processes on a "batch selected" array of pieces or pages.
  * `runNonBatch` was renamed to `run` as it is the more generic job-running method. It is likely that `runBatch` will eventually be refactored to use this method.
  * The `good` and `bad` methods are renamed `success` and `failure`, respectively. The expected methods used in the `run` method were similarly renamed. They still increment job document properties called `good` and `bad`.
* Comments out the unused `batchSimpleRoute` methods in the page and piece-type modules to avoid usage before they are fully implemented.
* Optionally add `dimensionAttrs` option to image widget, which sets width & height attributes to optimize for Cumulative Layout Shift.
* Temporarily removes `npm audit` from our automated tests because of a sub-dependency of uploadfs that doesn't actually cause a security vulnerability for apostrophe.

## 3.7.0 - 2021-10-28

### Adds

* Schema select field choices can now be populated by a server side function, like an API call. Set the `choices` property to a method name of the calling module. That function should take a single argument of `req`, and return an array of objects with `label` and `value` properties. The function can be async and will be awaited.
* Apostrophe now has built-in support for the Node.js cluster module. If the `APOS_CLUSTER_PROCESSES` environment variable is set to a number, that number of child processes are forked, sharing the same listening port. If the variable is set to `0`, one process is forked for each CPU core, with a minimum of `2` to provide availability during restarts. If the variable is set to a negative number, that number is added to the number of CPU cores, e.g. `-1` is a good way to reserve one core for MongoDB if it is running on the same server. This is for production use only (`NODE_ENV=production`). If a child process fails it is restarted automatically.

### Fixes

* Prevents double-escaping interpolated localization strings in the UI.
* Rich text editor style labels are now run through a localization method to get the translated strings from their l10n keys.
* Fixes README Node version requirement (Node 12+).
* The text alignment buttons now work immediately in a new rich text widget. Previously they worked only after manually setting a style or refreshing the page. Thanks to Michelin for their support of this fix.
* Users can now activate the built-in date and time editing popups of modern browsers when using the `date` and `time` schema field types.
* Developers can now `require` their project `app.js` file in the Node.js REPL for debugging and inspection. Thanks to [Matthew Francis Brunetti](https://github.com/zenflow).
* If a static text phrase is unavailable in both the current locale and the default locale, Apostrophe will always fall back to the `en` locale as a last resort, which ensures the admin UI works if it has not been translated.
* Developers can now `require` their project `app.js` in the Node.js REPL for debugging and inspection
* Ensure array field items have valid _id prop before storing. Thanks to Thanks to [Matthew Francis Brunetti](https://github.com/zenflow).

### Changes

* In 3.x, `relationship` fields have an optional `builders` property, which replaces `filters` from 2.x, and within that an optional `project` property, which replaces `projection` from 2.x (to match MongoDB's `cursor.project`). Prior to this release leaving the old syntax in place could lead to severe performance problems due to a lack of projections. Starting with this release the 2.x syntax results in an error at startup to help the developer correct their code.
* The `className` option from the widget options in a rich text area field is now also applied to the rich text editor itself, for a consistently WYSIWYG appearance when editing and when viewing. Thanks to [Max Mulatz](https://github.com/klappradla) for this contribution.
* Adds deprecation notes to doc module `afterLoad` events, which are deprecated.
* Removes unused `afterLogin` method in the login module.

## 3.6.0 - 2021-10-13

### Adds

* The `context-editing` apostrophe admin UI bus event can now take a boolean parameter, explicitly indicating whether the user is actively typing or performing a similar active manipulation of controls right now. If a boolean parameter is not passed, the existing 1100-millisecond debounced timeout is used.
* Adds 'no-search' modifier to relationship fields as a UI simplification option.
* Fields can now have their own `modifiers` array. This is combined with the schema modifiers, allowing for finer grained control of field rendering.
* Adds a Slovak localization file. Activate the `sk` locale to use this. Many thanks to [Michael Huna](https://github.com/Miselrkba) for the contribution.
* Adds a Spanish localization file. Activate the `es` locale to use this. Many thanks to [Eugenio Gonzalez](https://github.com/egonzalezg9) for the contribution.
* Adds a Brazilian Portuguese localization file. Activate the `pt-BR` locale to use this. Many thanks to [Pietro Rutzen](https://github.com/pietro-rutzen) for the contribution.

### Fixes

* Fixed missing translation for "New Piece" option on the "more" menu of the piece manager, seen when using it as a chooser.
* Piece types with relationships to multiple other piece types may now be configured in any order, relative to the other piece types. This sometimes appeared to be a bug in reverse relationships.
* Code at the project level now overrides code found in modules that use `improve` for the same module name. For example, options set by the `@apostrophecms/seo-global` improvement that ships with `@apostrophecms/seo` can now be overridden at project level by `/modules/@apostrophecms/global/index.js` in the way one would expect.
* Array input component edit button label is now propertly localized.
* A memory leak on each request has been fixed, and performance improved, by avoiding the use of new Nunjucks environments for each request. Thanks to Miro Yovchev for pointing out the leak.
* Fragments now have access to `__t()`, `getOptions` and other features passed to regular templates.
* Fixes field group cascade merging, using the original group label if none is given in the new field group configuration.
* If a field is conditional (using an `if` option), is required, but the condition has not been met, it no longer throws a validation error.
* Passing `busy: true` to `apos.http.post` and related methods no longer produces an error if invoked when logged out, however note that there will likely never be a UI for this when logged out, so indicate busy state in your own way.
* Bugs in document modification detection have been fixed. These bugs caused edge cases where modifications were not detected and the "Update" button did not appear, and could cause false positives as well.

### Changes

* No longer logs a warning about no users if `testModule` is true on the app.

## 3.5.0 - 2021-09-23

* Pinned dependency on `vue-material-design-icons` to fix `apos-build.js` build error in production.
* The file size of uploaded media is visible again when selected in the editor, and media information such as upload date, dimensions and file size is now properly localized.
* Fixes moog error messages to reflect the recommended pattern of customization functions only taking `self` as an argument.
* Rich Text widgets now instantiate with a valid element from the `styles` option rather than always starting with an unclassed `<p>` tag.
* Since version 3.2.0, apostrophe modules to be loaded via npm must appear as explicit npm dependencies of the project. This is a necessary security and stability improvement, but it was slightly too strict. Starting with this release, if the project has no `package.json` in its root directory, the `package.json` in the closest ancestor directory is consulted.
* Fixes a bug where having no project modules directory would throw an error. This is primarily a concern for module unit tests where there are no additional modules involved.
* `css-loader` now ignores `url()` in css files inside `assets` so that paths are left intact, i.e. `url(/images/file.svg)` will now find a static file at `/public/images/file.svg` (static assets in `/public` are served by `express.static`). Thanks to Matic Tersek.
* Restored support for clicking on a "foreign" area, i.e. an area displayed on the page whose content comes from a piece, in order to edit it in an appropriate way.
* Apostrophe module aliases and the data attached to them are now visible immediately to `ui/src/index.js` JavaScript code, i.e. you can write `apos.alias` where `alias` matches the `alias` option configured for that module. Previously one had to write `apos.modules['module-name']` or wait until next tick. However, note that most modules do not push any data to the browser when a user is not logged in. You can do so in a custom module by calling `self.enableBrowserData('public')` from `init` and implementing or extending the `getBrowserData(req)` method (note that page, piece and widget types already have one, so it is important to extend in those cases).
* `options.testModule` works properly when implementing unit tests for an npm module that is namespaced.

### Changes

* Cascade grouping (e.g., grouping fields) will now concatenate a group's field name array with the field name array of an existing group of the same name. Put simply, if a new piece module adds their custom fields to a `basics` group, that field will be added to the default `basics` group fields. Previously the new group would have replaced the old, leaving inherited fields in the "Ungrouped" section.
* AposButton's `block` modifier now less login-specific

### Adds

* Rich Text widget's styles support a `def` property for specifying the default style the editor should instantiate with.
* A more helpful error message if a field of type `area` is missing its `options` property.

## 3.4.1 - 2021-09-13

No changes. Publishing to correctly mark the latest 3.x release as "latest" in npm.

## 3.4.0 - 2021-09-13

### Security

* Changing a user's password or marking their account as disabled now immediately terminates any active sessions or bearer tokens for that user. Thanks to Daniel Elkabes for pointing out the issue. To ensure all sessions have the necessary data for this, all users logged in via sessions at the time of this upgrade will need to log in again.
* Users with permission to upload SVG files were previously able to do so even if they contained XSS attacks. In Apostrophe 3.x, the general public so far never has access to upload SVG files, so the risk is minor but could be used to phish access from an admin user by encouraging them to upload a specially crafted SVG file. While Apostrophe typically displays SVG files using the `img` tag, which ignores XSS vectors, an XSS attack might still be possible if the image were opened directly via the Apostrophe media library's convenience link for doing so. All SVG uploads are now sanitized via DOMPurify to remove XSS attack vectors. In addition, all existing SVG attachments not already validated are passed through DOMPurify during a one-time migration.

### Fixes

* The `apos.attachment.each` method, intended for migrations, now respects its `criteria` argument. This was necessary to the above security fix.
* Removes a lodash wrapper around `@apostrophecms/express` `bodyParser.json` options that prevented adding custom options to the body parser.
* Uses `req.clone` consistently when creating a new `req` object with a different mode or locale for localization purposes, etc.
* Fixes bug in the "select all" relationship chooser UI where it selected unpublished items.
* Fixes bug in "next" and "previous" query builders.
* Cutting and pasting widgets now works between locales that do not share a hostname, provided that you switch locales after cutting (it does not work between tabs that are already open on separate hostnames).
* The `req.session` object now exists in task `req` objects, for better compatibility. It has no actual persistence.
* Unlocalized piece types, such as users, may now be selected as part of a relationship when browsing.
* Unpublished localized piece types may not be selected via the autocomplete feature of the relationship input field, which formerly ignored this requirement, although the browse button enforced it.
* The server-side JavaScript and REST APIs to delete pieces now work properly for pieces that are not subject to either localization or draft/published workflow at all the (`localize: false` option). UI for this is under discussion, this is just a bug fix for the back end feature which already existed.
* Starting in version 3.3.1, a newly added image widget did not display its image until the page was refreshed. This has been fixed.
* A bug that prevented Undo operations from working properly and resulted in duplicate widget _id properties has been fixed.
* A bug that caused problems for Undo operations in nested widgets, i.e. layout or multicolumn widgets, has been fixed.
* Duplicate widget _id properties within the same document are now prevented on the server side at save time.
* Existing duplicate widget _id properties are corrected by a one-time migration.

### Adds

* Adds a linter to warn in dev mode when a module name include a period.
* Lints module names for `apostrophe-` prefixes even if they don't have a module directory (e.g., only in `app.js`).
* Starts all `warnDev` messages with a line break and warning symbol (⚠️) to stand out in the console.
* `apos.util.onReady` aliases `apos.util.onReadyAndRefresh` for brevity. The `apos.util.onReadyAndRefresh` method name will be deprecated in the next major version.
* Adds a developer setting that applies a margin between parent and child areas, allowing developers to change the default spacing in nested areas.

### Changes

* Removes the temporary `trace` method from the `@apostrophecms/db` module.
* Beginning with this release, the `apostrophe:modulesReady` event has been renamed `apostrophe:modulesRegistered`, and the `apostrophe:afterInit` event has been renamed `apostrophe:ready`. This better reflects their actual roles. The old event names are accepted for backwards compatibility. See the documentation for more information.
* Only autofocuses rich text editors when they are empty.
* Nested areas now have a vertical margin applied when editing, allowing easier access to the parent area's controls.

## 3.3.1 - 2021-09-01

### Fixes

* In some situations it was possible for a relationship with just one selected document to list that document several times in the returned result, resulting in very large responses.
* Permissions roles UI localized correctly.
* Do not crash on startup if users have a relationship to another type. This was caused by the code that checks whether any users exist to present a warning to developers. That code was running too early for relationships to work due to event timing issues.

## 3.3.0 - 2021-08-30

### Fixes

* Addresses the page jump when using the in-context undo/redo feature. The page will immediately return users to their origin scroll position after the content refreshes.
* Resolves slug-related bug when switching between images in the archived view of the media manager. The slug field was not taking into account the double slug prefix case.
* Fixes migration task crash when parking new page. Thanks to [Miro Yovchev](https://www.corllete.com/) for this fix.
* Fixes incorrect month name in `AposCellDate`, which can be optionally used in manage views of pieces. Thanks to [Miro Yovchev](https://www.corllete.com/) for this fix.

### Adds

* This version achieves localization (l10n) through a rich set of internationalization (i18n) features. For more information, [see the documentation](https://v3.docs.apostrophecms.org/).
* There is support for both static string localization and dynamic content localization.
* The home page, other parked pages, and the global document are automatically replicated to all configured locales at startup. Parked properties are refreshed if needed. Other pages and pieces are replicated if and when an editor chooses to do so.
* An API route has been added for voluntary replication, i.e. when deciding a document should exist in a second locale, or desiring to overwrite the current draft contents in locale `B` with the draft contents of locale `A`.
* Locales can specify `prefix` and `hostname` options, which are automatically recognized by middleware that removes the prefix dynamically where appropriate and sets `req.locale`. In 3.x this works more like the global site `prefix` option. This is a departure from 2.x which stored the prefix directly in the slug, creating maintenance issues.
* Locales are stateless: they are never recorded in the session. This eliminates many avenues for bugs and bad SEO. However, this also means the developer must fully distinguish them from the beginning via either `prefix` or `hostname`. A helpful error message is displayed if this is not the case.
* Switching locales preserves the user's editing session even if on separate hostnames. To enable this, if any locales have hostnames, all configured locales must have hostnames and/or baseUrl must be set for those that don't.
* An API route has been added to discover the locales in which a document exists. This provides basic information only for performance (it does not report `title` or `_url`).
* Editors can "localize" documents, copying draft content from one locale to another to create a corresponding document in a different locale. For convenience related documents, such as images and other pieces directly referenced by the document's structure, can be localized at the same time. Developers can opt out of this mechanism for a piece type entirely, check the box by default for that type, or leave it as an "opt-in" choice.
* The `@apostrophecms/i18n` module now uses `i18next` to implement static localization. All phrases in the Vue-based admin UI are passed through `i18next` via `this.$t`, and `i18next` is also available via `req.t()` in routes and `__t()` in templates. Apostrophe's own admin UI phrases are in the `apostrophe` namespace for a clean separation. An array of locale codes, such as `en` or `fr` or `en-au`, can be specified using the `locales` option to the `@apostrophecms/i18n` module. The first locale is the default, unless the `defaultLocale` option is set. If no locales are set, the locale defaults to `en`. The `i18next-http-middleware` locale guesser is installed and will select an available locale if possible, otherwise it will fall back to the default.
* In the admin UI, `v-tooltip` has been extended as `v-apos-tooltip`, which passes phrases through `i18next`.
* Developers can link to alternate locales by iterating over `data.localizations` in any page template. Each element always has `locale`, `label` and `homePageUrl` properties. Each element also has an `available` property (if true, the current context document is available in that locale), `title` and a small number of other document properties are populated, and `_url` redirects to the context document in that locale. The current locale is marked with `current: true`.
* To facilitate adding interpolated values to phrases that are passed as a single value through many layers of code, the `this.$t` helper provided in Vue also accepts an object argument with a `key` property. Additional properties may be used for interpolation.
* `i18next` localization JSON files can be added to the `i18n` subdirectory of *any* module, as long as its `i18n` option is set. The `i18n` object may specify `ns` to give an `i18next` namespace, otherwise phrases are in the default namespace, used when no namespace is specified with a `:` in an `i18next` call. The default namespace is yours for use at project level. Multiple modules may contribute to the same namespace.
* If `APOS_DEBUG_I18N=1` is set in the environment, the `i18next` debug flag is activated. For server-side translations, i.e. `req.t()` and `__t()`, debugging output will appear on the server console. For browser-side translations in the Vue admin UI, debugging output will appear in the browser console.
* If `APOS_SHOW_I18N=1` is set in the environment, all phrases passed through `i18next` are visually marked, to make it easier to find those that didn't go through `i18next`. This does not mean translations actually exist in the JSON files. For that, review the output of `APOS_DEBUG_I18N=1`.
* There is a locale switcher for editors.
* There is a backend route to accept a new locale on switch.
* A `req.clone(properties)` method is now available. This creates a clone of the `req` object, optionally passing in an object of properties to be set. The use of `req.clone` ensures the new object supports `req.get` and other methods of a true `req` object. This technique is mainly used to obtain a new request object with the same privileges but a different mode or locale, i.e. `mode: 'published'`.
* Fallback wrappers are provided for the `req.__()`, `res.__()` and `__()` localization helpers, which were never official or documented in 3.x but may be in use in projects ported from 2.x. These wrappers do not localize but do output the input they are given along with a developer warning. You should migrate them to use `req.t()` (in server-side javascript) or `__t()` (Nunjucks templates).

### Changes

* Bolsters the CSS that backs Apostrophe UI's typography to help prevent unintended style leaks at project-level code.
* Removes the 2.x series changelog entries. They can be found in the 2.0 branch in Github.

## 3.2.0 - 2021-08-13

### Fixes

* `req.hostname` now works as expected when `trustProxy: true` is passed to the `@apostrophecms/express` module.
* Apostrophe loads modules from npm if they exist there and are configured in the `modules` section of `app.js`. This was always intended only as a way to load direct, intentional dependencies of your project. However, since npm "flattens" the dependency tree, dependencies of dependencies that happen to have the same name as a project-level Apostrophe module could be loaded by default, crashing the site or causing unexpected behavior. So beginning with this release, Apostrophe scans `package.json` to verify an npm module is actually a dependency of the project itself before attempting to load it as an Apostrophe module.
* Fixes the reference to sanitize-html defaults in the rich text widget.
* Fixes the `toolbarToAllowedStyles` method in the rich text widget, which was not returning any configuration.
* Fixes the broken text alignment in rich text widgets.
* Adds a missing npm dependency on `chokidar`, which Apostrophe and Nunjucks use for template refreshes. In most environments this worked anyway due to an indirect dependency via the `sass` module, but for stability Apostrophe should depend directly on any npm module it uses.
* Fixes the display of inline range inputs, notably broken when using Palette
* Fixes occasional unique key errors from migrations when attempting to start up again with a site that experienced a startup failure before inserting its first document.
* Requires that locale names begin with a letter character to ensure order when looping over the object entries.
* Unit tests pass in MongoDB 5.x.

### Adds
* Adds Cut and Paste to area controls. You can now Cut a widget to a virtual clipboard and paste it in suitable areas. If an area
can include the widget on the clipboard, a special Clipboard widget will appear in area's Add UI. This works across pages as well.

### Changes
* Apostrophe's Global's UI (the @apostrophecms/global singleton has moved from the admin bar's content controls to the admin utility tray under a cog icon.
* The context bar's document Edit button, which was a cog icon, has been rolled into the doc's context menu.

## 3.1.3 - 2021-07-16

### Fixes

* Hotfix for an incompatibility between `vue-loader` and `webpack` 5.45.0 which causes a crash at startup in development, or asset build time in production. We have temporarily pinned our dependency to `webpack` 5.44.x. We are [contributing to the discussion around the best long-term fix for vue-loader](https://github.com/vuejs/vue-loader/issues/1854).

## 3.1.2 - 2021-07-14

### Changes

* Removes an unused method, `mapMongoIdToJqtreeId`, that was used in A2 but is no longer relevant.
* Removes deprecated and non-functional steps from the `edit` method in the `AposDocsManager.vue` component.
* Legacy migrations to update 3.0 alpha and 3.0 beta sites to 3.0 stable are still in place, with no functional changes, but have been relocated to separate source files for ease of maintenance. Note that this is not a migration path for 2.x databases. Tools for that are forthcoming.

## 3.1.1 - 2021-07-08

### Fixes

* Two distinct modules may each have their own `ui/src/index.scss` file, similar to the fix already applied to allow multiple `ui/src/index.js` files.

## 3.1.0 - 2021-06-30

### Fixes

* Corrects a bug that caused Apostrophe to rebuild the admin UI on every nodemon restart, which led to excessive wait times to test new code. Now this happens only when `package-lock.json` has been modified (i.e. you installed a new module that might contain new Apostrophe admin UI code). If you are actively developing Apostrophe admin UI code, you can opt into rebuilding all the time with the `APOS_DEV=1` environment variable. In any case, `ui/src` is always rebuilt in a dev environment.
* Updates `cheerio`, `deep-get-set`, and `oembetter` versions to resolve vulnerability warnings.
* Modules with a `ui/src` folder, but no other content, are no longer considered "empty" and do not generate a warning.
* Pushing a secondary context document now always results in entry to draft mode, as intended.
* Pushing a secondary context document works reliably, correcting a race condition that could cause the primary document to remain in context in some cases if the user was not already in edit mode.

### Changes

* Deprecates `self.renderPage` method for removal in next major version.
* Since `ui/src/index.js` files must export a function to avoid a browser error in production which breaks the website experience, we now detect this at startup and throw a more helpful error to prevent a last-minute discovery in production.

## 3.0.1 - 2021-06-17

### Fixes

* Fixes an error observed in the browser console when using more than one `ui/src/index.js` file in the same project. Using more than one is a good practice as it allows you to group frontend code with an appropriate module, or ship frontend code in an npm module that extends Apostrophe.
* Migrates all of our own frontend players and utilities from `ui/public` to `ui/src`, which provides a robust functional test of the above.
* Executes `ui/src` imports without waiting for next tick, which is appropriate as we have positioned it as an alternative to `ui/public` which is run without delay.

## 3.0.0 - 2021-06-16

### Breaks

* Previously our `a3-boilerplate` project came with a webpack build that pushed code to the `ui/public` folder of an `asset` module. Now the webpack build is not needed because Apostrophe takes care of compiling `ui/src` for us. This is good! However, **if you are transitioning your project to this new strategy, you will need to remove the `modules/asset/ui/public` folder from your project manually** to ensure that webpack-generated code originally intended for webpack-dev-server does not fail with a `publicPath` error in the console.
* The `CORE_DEV=1` environment setting has been changed to `APOS_DEV=1` because it is appropriate for anyone who is actively developing custom Apostrophe admin UI using `ui/apos` folders in their own modules.
* Apostrophe now uses Dart Sass, aka the `sass` npm module. The `node-sass` npm module has been deprecated by its authors for some time now. Most existing projects will be unaffected, but those writing their own Apostrophe UI components will need to change any `/deep/` selectors to `::v-deep` and consider making other Dart Sass updates as well. For more information see the [Dart Sass documentation](https://sass-lang.com/dart-sass). Those embracing the new `ui/src` feature should also bear in mind that Dart Sass is being used.

### Changes

* Relationship ids are now stored as aposDocIds (without the locale and mode part). The appropriate locale and mode are known from the request. This allows easy comparison and copying of these properties across locales and fixes a bug with reverse relationships when publishing documents. A migration has been added to take care of this conversion on first startup.
- The `attachment` field type now correctly limits file uploads by file type when using the `fileGroup` field option.
- Uploading SVG files is permitted in the Media Library by default.

### Adds

- Apostrophe now enables you to ship frontend JavaScript and Sass (using the SCSS syntax) without your own webpack configuration.
- Any module may contain modern JavaScript in a `ui/src/index.js` file, which may use `import` to bring in other files in the standard way. Note that **`ui/src/index.js must export a function`**. These functions are called for you in the order modules are initialized.
- Any module may contain a Sass (SCSS) stylesheet in a `ui/src/index.scss` file, which may also import other Sass (SCSS) files.
- Any project that requires IE11 support for `ui/src` JavaScript code can enable it by setting the `es5: true` option to the `@apostrophecms/asset` module. Apostrophe produces separate builds for IE11 and modern browsers, so there is no loss of performance in modern browsers. Code is automatically compiled for IE11 using `babel` and missing language features are polyfilled using `core-js` so you can use promises, `async/await` and other standard modern JavaScript features.
- `ui/public` is still available for raw JavaScript and CSS files that should be pushed *as-is* to the browser. The best use of this feature is to deliver the output of your own custom webpack build, if you have one.
- Adds browser-side `editMode` flag that tracks the state of the current view (edit or preview), located at `window.apos.adminBar.editMode`.
- Support for automatic inline style attribute sanitization for Rich Text widgets.
- Adds text align controls for Rich Text widgets. The following tools are now supported as part of a rich text widget's `toolbar` property:
-- `alignLeft`
-- `alignRight`
-- `alignCenter`
-- `alignJustify`
- `@apostrophecms/express` module now supports the `trustProxy: true` option, allowing your reverse proxy server (such as nginx) to pass on the original hostname, protocol and client IP address.

### Fixes

* Unit tests passing again. Temporarily disabled npm audit checks as a source of critical failures owing to upstream issues with third-party packages which are not actually a concern in our use case.
* Fixed issues with the query builder code for relationships. These issues were introduced in beta 3 but did not break typical applications, except for displaying distinct choices for existing values of a relationship field.
* Checkbox field types can now be used as conditional fields.
* Tracks references to attachments correctly, and introduces a migration to address any attachments previously tracked as part of documents that merely have a relationship to the proper document, i.e. pages containing widgets that reference an image piece.
* Tracks the "previously published" version of a document as a legitimate reference to any attachments, so that they are not discarded and can be brought back as expected if "Undo Publish" is clicked.
* Reverse relationships work properly for published documents.
* Relationship subfields are now loaded properly when `reverseOf` is used.
* "Discard Draft" is available when appropriate in "Manage Pages" and "Manage Pieces."
* "Discard Draft" disables the "Submit Updates" button when working as a contributor.
* Relationship subfields can now be edited when selecting in the full "manage view" browser, as well as in the compact relationship field view which worked previously.
* Relationship subfields now respect the `def` property.
* Relationship subfields are restored if you deselect a document and then reselect it within a single editing experience, i.e. accidentally deselect and immediately reselect, for instance.
* A console warning when editing subfields for a new relationship was fixed.
* Field type `color`'s `format` option moved out of the UI options and into the general options object. Supported formats are "rgb", "prgb", "hex6", "hex3", "hex8", "name", "hsl", "hsv". Pass the `format` string like:
```js
myColorField: {
  type: 'color',
  label: 'My Color',
  options: {
    format: 'hsl'
  }
}
```
* Restored Vue dependency to using semantic versioning now that Vue 2.6.14 has been released with a fix for the bug that required us to pin 2.6.12.
* Nunjucks template loader is fully compatible with Linux in a development environment.
* Improved template performance by reusing template loaders.
* `min` and `max` work properly for both string-like and number-like fields.
* Negative numbers, leading minus and plus signs, and trailing periods are accepted in the right ways by appropriate field types.
* If a user is inadvertently inserted with no password, set a random password on the backend for safety. In tests it appears that login with a blank password was already forbidden, but this provides an additional level of certainty.
* `data.page` and `data.contextOptions` are now available in `widget.html` templates in most cases. Specifically, they are available when loading the page, (2) when a widget has just been inserted on the page, and (3) when a widget has just been edited and saved back to the page. However, bear in mind that these parameters are never available when a widget is being edited "out of context" via "Page Settings", via the "Edit Piece" dialog box, via a dialog box for a parent widget, etc. Your templates should be written to tolerate the absence of these parameters.
* Double slashes in the slug cannot be used to trick Apostrophe into serving as an open redirect (fix ported to 3.x from 2.92.0).
* The global doc respects the `def` property of schema fields when first inserted at site creation time.
* Fixed fragment keyword arguments being available when not a part of the fragment signature.

## 3.0.0-beta.3.1 - 2021-06-07

### Breaks
- This backwards compatibility break actually occurred in 3.0.0-beta.3 and was not documented at that time, but it is important to know that the following Rich Text tool names have been updated to match Tiptap2's convention:
-- `bullet_list` -> `bulletList`
-- `ordered_list` -> `orderedList`
-- `code_block` -> `codeBlock`
-- `horizontal_rule` -> `horizontalRule`

### Fixes

- Rich Text default tool names updated, no longer broken. Bug introduced in 3.0.0-beta.3.
- Fixed Rich Text's tool cascade to properly account for core defaults, project level defaults, and area-specific options.

## 3.0.0-beta.3 - 2021-06-03

### Security Fixes

The `nlbr` and `nlp` Nunjucks filters marked their output as safe to preserve the tags that they added, without first escaping their input, creating a CSRF risk. These filters have been updated to escape their input unless it has already been marked safe. No code changes are required to templates whose input to the filter is intended as plaintext, however if you were intentionally leveraging this bug to output unescaped HTML markup you will need to make sure your input is free of CSRF risks and then use the `| safe` filter before the `| nlbr` or `| nlp` filter.

### Adds

- Added the `ignoreUnusedFolderWarning` option for modules that intentionally might not be activated or inherited from in a particular startup.
- Better explanation of how to replace macros with fragments, in particular how to call the fragments with `{% render fragmentName(args) %}`.

### Fixes

- Temporarily pinned to Vue 2.6.12 to fix an issue where the "New" button in the piece manager modals disappeared. We think this is a bug in the newly released Vue 2.6.13 but we are continuing to research it.
- Updated dependencies on `sanitize-html` and `nodemailer` to new major versions, causing no bc breaks at the ApostropheCMS level. This resolved two critical vulnerabilities according to `npm audit`.
- Removed many unused dependencies.
- The data retained for "Undo Publish" no longer causes slug conflicts in certain situations.
- Custom piece types using `localized: false` or `autopublish: true,` as well as singleton types, now display the correct options on the "Save" dropdown.
- The "Save and View," "Publish and View" and/or "Save Draft and Preview" options now appear only if an appropriate piece page actually exists for the piece type.
- Duplicating a widget now properly assigns new IDs to all copied sub-widgets, sub-areas and array items as well.

- Added the `ignoreUnusedFolderWarning` option for modules that intentionally might not be activated or inherited from in a particular startup.
- If you refresh the page while previewing or editing, you will be returned to that same state.

### Notices

- Numerous `npm audit` vulnerability warnings relating to `postcss` 7.x were examined, however it was determined that these are based on the idea of a malicious SASS coder attempting to cause a denial of service. Apostrophe developers would in any case be able to contribute JavaScript as well and so are already expected to be trusted parties. This issue must be resolved upstream in packages including both `stylelint` and `vue-loader` which have considerable work to do before supporting `postcss` 8.x, and in any case public access to write SASS is not part of the attack surface of Apostrophe.

### Changes

- When logging out on a page that only exists in draft form, or a page with access controls, you are redirected to the home page rather than seeing a 404 message.

- Rich text editor upgraded to [tiptap 2.x beta](https://www.tiptap.dev) :tada:. On the surface not a lot has changed with the upgrade, but tiptap 2 has big improvements in terms of speed, composability, and extension support. [See the technical differences of tiptap 1 and 2 here](https://www.tiptap.dev/overview/upgrade-guide#reasons-to-upgrade-to-tiptap-2x)

## 3.0.0-beta.2 - 2021-05-21

### **Breaks**

- The `updateModified: false` option, formerly supported only by `apos.doc.update`, has been renamed to `setModified: false` and is now supported by `apos.doc.insert` as well. If explicitly set to false, the insert and update methods will leave the `modified` property alone, rather than trying to detect or infer whether a change has been made to the draft relative to the published version.
- The `permission` module no longer takes an `interestingTypes` option. Instead, doc type managers may set their `showPermissions` option to `true` to always be broken out separately in the permissions explorer, or explicitly set it to `false` to never be mentioned at all, even on a list of typical piece types that have the same permissions. This allows module creators to ship the right options with their modules rather than requiring the developer to hand-configure `interestingTypes`.
- When editing users, the permissions explorer no longer lists "submitted draft" as a piece type.
- Removed `apos.adminBar.group` method, which is unlikely to be needed in 3.x. One can group admin bar items into dropdowns via the `groups` option.
- Raw HTML is no longer permitted in an `apos.notify` message parameter. Instead, `options.buttons` is available. If present, it must be an array of objects with `type` and `label` properties. If `type` is `'event'` then that button object must have `name` and `data` properties, and when clicked the button will trigger an apos bus event of the given `name` with the provided `data` object. Currently `'event'` is the only supported value for `type`.

### Adds

- The name `@apostrophecms/any-page-type` is now accepted for relationships that should match any page. With this change, the doc type manager module name and the type name are now identical for all types in 3.x. However, for backwards compatibility `@apostrophecms/page` is still accepted. `apos.doc.getManager` will accept either name.
- Sets the project root-level `views` directory as the default fallback views directory. This is no longer a necessary configuration in projects unless they want to change it on the `@apostrophecms/template` option `viewsFolderFallback`.
- The new `afterAposScripts` nunjucks block allows for pushing markup after Apostrophe's asset bundle script tag, at the end of the body. This is a useful way to add a script tag for Webpack's hot reload capabilities in development while still ensuring that Apostrophe's utility methods are available first, like they are in production.
- An `uploadfs` option may be passed to the `@apostrophecms/asset` module, in order to pass options configuring a separate instance of `uploadfs` specifically for the static assets. The `@apostrophecms/uploadfs` module now exports a method to instantiate an uploadfs instance. The default behavior, in which user-uploaded attachments and static assets share a single instance of uploadfs, is unchanged. Note that asset builds never use uploadfs unless `APOS_UPLOADFS_ASSETS=1` is set in the environment.
- `AposButtonSplit` is a new UI component that combines a button with a context menu. Users can act on a primary action or change the button's function via menu button to the right of the button itself.
- Developers can now pass options to the `color` schema field by passing a `pickerOptions` object through your field. This allows for modifying/removing the default color palette, changing the resulting color format, and disabling various UI. For full set of options [see this example](https://github.com/xiaokaike/vue-color/blob/master/src/components/Sketch.vue)
- `AposModal` now emits a `ready` event when it is fully painted and can be interacted with by users or code.
- The video widget is now compatible with vimeo private videos when the domain is on the allowlist in vimeo.

### Changes

- You can now override the parked page definition for the home page without copying the entirety of `minimumPark` from the source code. Specifically, you will not lose the root archive page if you park the home page without explicitly parking the archive page as well. This makes it easier to choose your own type for the home page, in lieu of `@apostrophecms/home-page`.

### Fixes

- Piece types like users that have a slug prefix no longer trigger a false positive as being "modified" when you first click the "New" button.
- The `name` option to widget modules, which never worked in 3.x, has been officially removed. The name of the widget type is always the name of the module, with the `-widget` suffix removed.
- The home page and other parked pages should not immediately show as "pending changes."
- In-context editing works properly when the current browser URL has a hash (portion beginning with `#`), enabling the use of the hash for project-specific work. Thanks to [https://stepanjakl.com/](Štěpán Jákl) for reporting the issue.
- When present, the `apos.http.addQueryToUrl` method preserves the hash of the URL intact.
- The home page and other parked pages should not immediately show as "pending changes."
- The browser-side `apos.http.parseQuery` function now handles objects and arrays properly again.
- The in-context menu for documents has been refactored as a smart component that carries out actions on its own, eliminating a great deal of redundant code, props and events.
- Added additional retries when binding to the port in a dev environment.
- The "Submit" button in the admin bar updates properly to "Submitted" if the submission happens in the page settings modal.
- Skipping positional arguments in fragments now works as expected.
- The rich text editor now supports specifying a `styles` array with no `p` tags properly. A newly added rich text widget initially contains an element with the first style, rather than always a paragraph. If no styles are configured, a `p` tag is assumed. Thanks to Stepan Jakl for reporting the issue.

### Changes
- Editor modal's Save button (publish / save draft / submit) now updated to use the `AposSplitButton` component. Editors can choose from several follow-up actions that occur after save, including creating another piece of content of the same type, being taken to the in-context version of the document, or being returned to the manager. Editor's selection is saved in localstorage, creating a remembered preference per content type.

## 3.0.0-beta.1.1 - 2021-05-07

### Fixes

- A hotfix for an issue spotted in beta 1 in our demo: all previously published pages of sites migrated from early alpha releases had a "Draft" label until published again.

## 3.0.0-beta.1 - 2021-05-06

### **Breaks**

- Removes the `firstName` and `lastName` fields in user pieces.
- The query parameters `apos-refresh`, `apos-edit`, `apos-mode` and `apos-locale` are now `aposRefresh`, `aposEdit`, `aposMode`and `aposLocale`. Going forward all query parameters will be camelCase for consistency with query builders.

### Changes

- Archiving a page or piece deletes any outstanding draft in favor of archiving the last published version. Previously the behavior was effectively the opposite.
- "Publish Changes" button label has been changes to "Update".
- Draft mode is no longer the default view for published documents.
- The page and piece manager views now display the title, etc. of the published version of a document, unless that document only exists in draft form. However a label is also provided indicating if a newer draft is in progress.
- Notifications have been updated with a new visual display and animation style.

### **Adds**

- Four permissions roles are supported and enforced: guest, contributor, editor and admin. See the documentation for details. Pre-existing alpha users are automatically migrated to the admin role.
- Documents in managers now have context sensitive action menus that allow actions like edit, discard draft, archive, restore, etc.
- A fragment call may now have a body using `rendercall`, just like a macro call can have a body using `call`. In addition, fragments can now have named arguments, just like macros. Many thanks to Miro Yovchev for contributing this implementation.
- Major performance improvement to the `nestedModuleSubdirs` option.
- Updates URL fields and oEmbed URL requests to use the `httpsFix` option in launder's `url()` method.
- Documents receive a state label based on their document state (draft, pending, pending updates)
- Contributors can submit drafts for review ("Submit" versus "Submit Updates").
- Editors and admins can manage submitted drafts.
- Editors and admins can easily see the number of proposed changes awaiting their attention.
- Support for virtual piece types, such as submitted drafts, which in actuality manage more than one type of doc.
- Confirm modals now support a schema which can be assessed after confirmation.
- When archiving and restoring pages, editors can chose whether the action affects only this document or this document + children
- Routes support the `before` syntax, allowing routes that are added to Express prior to the routes or middleware of another module. The syntax `before: 'middleware:moduleName'` must be used to add the route prior to the middleware of `moduleName`. If `middleware:` is not used, the route is added before the routes of `moduleName`. Note that normally all middleware is added before all routes.
- A `url` property can now optionally be specified when adding middleware. By default all middleware is global.
- The pieces REST GET API now supports returning only a count of all matching pieces, using the `?count=1` query parameter.
- Admin bar menu items can now specify a custom Vue component to be used in place of `AposButton`.
- Sets `username` fields to follow the user `title` field to remove an extra step in user creation.
- Adds default data to the `outerLayoutBase.html` `<title>` tag: `data.piece.title or data.page.title`.
- Moves the core UI build task into the start up process. The UI build runs automatically when `NODE_ENV` is *not* 'production' and when:
    1. The build folder does not yet exist.
    2. The package.json file is newer than the existing UI build.
    3. You explicitly tell it to by setting the environment variable `CORE_DEV=1`
- The new `._ids(_idOrArrayOfIds)` query builder replaces `explicitOrder` and accepts an array of document `_id`s or a single one. `_id` can be used as a multivalued query parameter. Documents are returned in the order you specify, and just like with single-document REST GET requests, the locale of the `_id`s is overridden by the `aposMode` query parameter if present.
- The `.withPublished(true)` query builder adds a `_publishedDoc` property to each returned draft document that has a published equivalent. `withPublished=1` can be used as a query parameter. Note this is not the way to fetch only published documents. For that, use `.locale('en:published')` or similar.
- The server-side implementation of `apos.http.post` now supports passing a `FormData` object created with the `[form-data](https://www.npmjs.com/package/form-data)` npm module. This keeps the API parallel with the browser-side implementation and allows for unit testing the attachments feature, as well as uploading files to internal and external APIs from the server.
- `manuallyPublished` computed property moved to the `AposPublishMixin` for the use cases where that mixin is otherwise warranted.
- `columns` specified for a piece type's manage view can have a name that uses "dot notation" to access a subproperty. Also, for types that are localized, the column name can begin with `draft:` or `published:` to specifically display a property of the draft or published version of the document rather than the best available. When a prefix is not used, the property comes from the published version of the document if available, otherwise from the draft.
- For page queries, the `children` query builder is now supported in query strings, including the `depth` subproperty. For instance you could fetch `/api/v1/@apostrophecms/page/id-of-page?children=1` or `/api/v1/@apostrophecms/page/id-of-page?children[depth]=3`.
- Setting `APOS_LOG_ALL_QUERIES=1` now logs the projection, skip, limit and sort in addition to the criteria, which were previously logged.

### **Fixes**

- Fragments can now call other fragments, both those declared in the same file and those imported, just like macros calling other macros. Thanks to Miro Yovchev for reporting the issue.
- There was a bug that allowed parked properties, such as the slug of the home page, to be edited. Note that if you don't want a property of a parked page to be locked down forever you can use the `_defaults` feature of parked pages.
- A required field error no longer appears immediately when you first start creating a user.
- Vue warning in the pieces manager due to use of value rather than name of column as a Vue key. Thanks to Miro Yovchev for spotting the issue.
- "Save Draft" is not an appropriate operation to offer when editing users.
- Pager links no longer break due to `aposRefresh=1` when in edit mode. Also removed superfluous `append` query parameter from these.
- You may now intentionally clear the username and slug fields in preparation to type a new value. They do not instantly repopulate based on the title field when you clear them.
- Language of buttons, labels, filters, and other UI updated and normalized throughout.
- A contributor who enters the page tree dialog box, opens the editor, and selects "delete draft" from within the editor of an individual page now sees the page tree reflect that change right away.
- The page manager listens for content change events in general and its refresh mechanism is robust in possible situations where both an explicit refresh call and a content change event occur.
- Automatically retries once if unable to bind to the port in a dev environment. This helps with occasional `EADDRINUSE` errors during nodemon restarts.
- Update the current page's context bar properly when appropriate after actions such as "Discard Draft."
- The main archive page cannot be restored, etc. via the context menu in the page tree.
- The context menu and "Preview Draft" are both disabled while errors are present in the editor dialog box.
- "Duplicate" should lead to a "Publish" button, not an "Update" button, "Submit" rather than "Submit Update," etc.
- When you "Duplicate" the home page you should be able to set a slug for the new page (parked properties of parked pages should be editable when making a duplicate).
- When duplicating the home page, the suggested slug should not be `/` as only one page can have that slug at a time.
- Attention is properly called to a slug conflict if it exists immediately when the document is opened (such as making a copy where the suggested slug has already been used for another copy).
- "Preview Draft" never appears for types that do not use drafts.
- The toggle state of admin bar utility items should only be mapped to an `is-active` class if, like palette, they opt in with `toggle: true`
- Fixed unique key errors in the migrate task by moving the parking of parked pages to a new `@apostrophecms/migrate:after` event handler, which runs only after migrations, whether that is at startup (in dev) or at the end of the migration task (in production).
- UI does not offer "Archive" for the home page, or other archived pages.
- Notification checks and other polling requests now occur only when the tab is in the foreground, resolving a number of problems that masqueraded as other bugs when the browser hit its connection limit for multiple tabs on the same site.
- Parked pages are now parked immediately after database migrations are checked and/or run. In dev this still happens at each startup. In production this happens when the database is brand new and when the migration task is manually run.

## 3.0.0-alpha.7 - 2021-04-07

### Breaks

* The `trash` property has been renamed `archived`, and throughout the UI we refer to "archiving" and the "archive" rather than "move to trash" and the "trash can." A database migration is included to address this for existing databases. However, **if you set the minimumPark option, or used a boilerplate in which it is set,** you will need to **change the settings for the `parkedId: 'trash'` page to match those [currently found in the `minimumPark` option setting in the `@apostrophecms/page` source code](https://github.com/apostrophecms/apostrophe/blob/481252f9bd8f42b62648a0695105e6e9250810d3/modules/%40apostrophecms/page/index.js#L25-L32).

### Adds

* General UX and UI improvements to the experience of moving documents to and from the archive, formerly known as the trash.
* Links to each piece are available in the manage view when appropriate.
* Search is implemented in the media library.
* You can now pass core widgets a `className` option when configuring them as part of an area.
* `previewDraft` for pieces, adds a Preview Draft button on creation for quick in-context editing. Defaults to true.

### Changes

* Do not immediately redirect to new pages and pieces.
* Restored pieces now restore as unpublished drafts.
* Refactored the admin bar component for maintainability.
* Notification style updates

### Fixes

* Advisory lock no longer triggers an update to the modification timestamp of a document.
* Attempts to connect Apostrophe 3.x to an Apostrophe 2.x database are blocked to prevent content loss.
* "Save as Draft" is now available as soon as a new document is created.
* Areas nested in array schema fields can now be edited in context.
* When using `apos.image.first`, the alt attribute of the image piece is available on the returned attachment object as `._alt`. In addition, `_credit` and `_creditUrl` are available.
* Fixes relating to the editing of widgets in nested areas, both on the page and in the modal.
* Removed published / draft switch for unpublished drafts.
* "Publish Changes" appears only at appropriate times.
* Notifications moved from the bottom right of the viewport to the bottom center, fixing some cases of UI overlap.

## 3.0.0-alpha.6.1 - 2021-03-26

### Fixes

* Conditional fields (`if`) and the "following values" mechanism now work properly in array item fields.
* When editing "Page Settings" or a piece, the "publish" button should not be clickable if there are errors.

## 3.0.0-alpha.6 - 2021-03-24

### Adds
* You can "copy" a page or a piece via the ⠇ menu.
* When moving the current page or piece to the trash, you are taken to the home page.
* `permissions: false` is supported for piece and page insert operations.
* Adds note to remove deprecated `allowedInChooser` option on piece type filters.
* UX improvement: "Move to Trash" and "Restore" buttons added for pieces, replacing the boolean field. You can open a piece that is in the trash in a read-only way in order to review it and click "Restore."
* Advisory lock support has been completed for all content types, including on-page, in-context editing. This prevents accidental conflicts between editors.
* Image widgets now accept a `size` context option from the template, which can be used to avoid sending a full-width image for a very small placement.
* Additional improvements.

### Fixes
* Fixes error from missing `select` method in `AposPiecesManager` component.
* No more migration messages at startup for brand-new sites.
* `max` is now properly implemented for relationships when using the manager dialog box as a chooser.
* "Trash" filter now displays its state properly in the piece manager dialog box.
* Dragging an image to the media library works reliably.
* Infinite loop warning when editing page titles has been fixed.
* Users can locate the tab that still contains errors when blocked from saving a piece due to schema field errors.
* Calling `insert` works properly in the `init` function of a module.
* Additional fixes.

### Breaks

* Apostrophe's instance of `uploadfs` has moved from `apos.attachment.uploadfs` to `apos.uploadfs`. The `uploadfs` configuration option has similarly moved from the `@apostrophecms/attachment` module to the `@apostrophecms/uploadfs` module. `imageSizes` is still an option to `@apostrophecms/attachment`.

## 3.0.0-alpha.5 - 2021-02-11

* Conditional fields are now supported via the new `if` syntax. The old 2.x `showFields` feature has been replaced with `if: { ... }`.
* Adds the option to pass context options to an area for its widgets following the `with` keyword. Context options for widgets not in that area (or that don't exist) are ignored. Syntax: `{% area data.page, 'areaName' with { '@apostrophecms/image: { size: 'full' } } %}`.
* Advisory locking has been implemented for in-context editing, including nested contexts like the palette module. Advisory locking has also been implemented for the media manager, completing the advisory locking story.
* Detects many common configuration errors at startup.
* Extends `getBrowserData` in `@apostrophecms/doc-type` rather than overwriting the method.
* If a select element has no default, but is required, it should default to the first option. The select elements appeared as if this were the case, but on save you would be told to make a choice, forcing you to change and change back. This has been fixed.
* Removes 2.x piece module option code, including for `contextual`, `manageViews`, `publishMenu`, and `contextMenu`.
* Removes admin bar module options related to 2.x slide-out UI: `openOnLoad`, `openOnHomepageLoad`, `closeDelay`.
* Fixed a bug that allowed users to appear to be in edit mode while looking at published content in certain edge cases.
* The PATCH API for pages can now infer the correct _id in cases where the locale is specified in the query string as an override, just like other methods.
* Check permissions for the delete and publish operations.
* Many bug fixes.

### Breaks
* Changes the `piecesModuleName` option to `pieceModuleName` (no "s") in the `@apostrophecms/piece-page-type` module. This feature is used only when you have two or more piece page types for the same piece type.

## 3.0.0-alpha.4.2 - 2021-01-27

* The `label` option is no longer required for widget type modules. This was already true for piece type and page type modules.
* Ability to namespace asset builds. Do not push asset builds to uploadfs unless specified.

### Breaking changes

* Removes the `browser` module option, which was only used by the rich text widget in core. All browser data should now be added by extending or overriding `getBrowserData` in a module. Also updates `getComponentName` to reference `options.components` instead of `options.browser.components`.

## 3.0.0-alpha.4.1

* Hotfix: the asset module now looks for a `./release-id` file (relative to the project), not a `./data/release-id` file, because `data` is not a deployed folder and the intent of `release-id` is to share a common release identifier between the asset build step and the deployed instances.

## 3.0.0-alpha.4

* **"Fragments" have been added to the Apostrophe template API, as an alternative to Nunjucks' macros, to fully support areas and async components.** [See the A3 alpha documentation](https://a3.docs.apos.dev/guide/widgets-and-templates/fragments.html) for instructions on how to use this feature.
* **CSS files in the `ui/public` subdirectory of any module are now bundled and pushed to the browser.** This allows you to efficiently deliver your CSS assets, just as you can deliver JS assets in `ui/public`. Note that these assets must be browser-ready JS and CSS, so it is customary to use your own webpack build to generate them. See [the a3-boilerplate project](https://github.com/apostrophecms/a3-boilerplate) for an example, especially `webpack.config.js`.
* **More support for rendering HTML in REST API requests.** See the `render-areas` query parameter in [piece and page REST API documentation](https://a3.docs.apos.dev/reference/api/pieces.html#get-api-v1-piece-name).
* **Context bar takeover capability,** for situations where a secondary document should temporarily own the undo/redo/publish UI.
* **Unpublished pages in the tree** are easier to identify
* **Range fields** have been added.
* **Support for npm bundles is back.** It works just like in 2.x, but the property is `bundle`, not `moogBundle`. Thanks to Miro Yovchev.

### Breaking changes

* **A3 now uses webpack 5.** For now, **due to a known issue with vue-loader, your own project must also be updated to use webpack 5.** The a3-boilerplate project has been updated accordingly, so you may refer to [the a3-boilerplate project](https://github.com/apostrophecms/a3-boilerplate) for an example of the changes to be made, notably in `webpack.config.js` and `package.json`. We are in communication with upstream developers to resolve the issue so that projects and apostrophe core can use different major versions of webpack.

## 3.0.0-alpha.3

Third alpha release of 3.x. Introduced draft mode and the "Publish Changes" button.

## 3.0.0-alpha.2

Second alpha release of 3.x. Introduced a distinct "edit" mode.

## 3.0.0-alpha.1

First alpha release of 3.x.
