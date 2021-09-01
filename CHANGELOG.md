# Changelog

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
* Apostrophe's Global's UI (the @apostrophecms/global singleton has moved from the admin bar's content controls to
the admin utility tray under a cog icon.
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
