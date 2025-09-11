# Changelog

## UNRELEASED

### Adds

* Custom operations registered with `addCreateWidgetOperation` can now specify an `ifTypesIntersect` property containing an array of widget type names. If the area in question allows at least one, the operation is offered.
* The login-requirements tests were updated to include tests for the `uponSubmit` filter
* Add `prependNodes` and `appendNodes` calls for `main`.
* Add options for pieces to change the title, message and icon of the empty state block.

### Fixes

* Fixes a bug in the login `uponSubmit` filter where a user could login without meeting the requirement.

### Fixes

* Resolve inline image URLs correctly when in edit mode and not in the default locale.

### Changes

* Redirects to URLs containing accent marks and other non-ascii characters now behave as expected with Astro. Pre-encoding the URLs exactly the way `res.redirect` would before passing them to Astro prevents an error in Astro and allows the redirect to succeed.
* Removes the non-functional `uniqueUsername` route from the `user` module
* Updated dependencies to address deprecation warnings.


## 4.21.0 (2025-09-03)

### Adds

* Modules can now call `apos.area.addCreateWidgetOperation` to register a custom operation that invokes a modal and inserts the widget returned by that modal. These operations are offered as choices in all "add widget" menus, both regular and expanded.
* `AposDocEditor` now accepts a `values` prop, which can be used to pass an object of initial values for some or all fields. Use of this prop is optional. It is not supported when editing existing documents.
* `apos.doc.edit` now accepts an optional `values` object as the final parameter, containing initial values for some or all fields. This is supported only when editing existing documents.
* When specifying a modal name to be executed, developers may now register "transformers" to be invoked first, using pipe syntax. For example, the modal name `aposSectionTemplateLibraryWidgetToDoc|AposDocEditor` will invoke the transformer `aposSectionTemplateLibraryWidgetToDoc` with the original props, and pass the returned result to `AposDocEditor`. Note that transformers are awaited. Transformers are registered in frontend admin UI code by passing a name and a function to `apos.ui.addTransformer`.
* Adds quick image upload UI to `@apostrophecms/image-widget`.
* Makes autocropping work when uploading or selecting images from the new quick image upload UI.

### Fixes

* The `?render-areas=1` API feature now correctly disregards areas in separate documents loaded via relationship fields. Formerly their presence resulted in an error, not a rendering.
* Make conditional fields work in Image Editor.
* Importing a custom icon from an npm module using a `~` path per the admin UI now works per the documentation, as long as the Vue component used for the icon is structured like those found in `@apostrophecms/vue-material-design-icons`.
* The `button: true` flag works again for piece module utility operations. Previously the button appeared but did not trigger the desired operation.
* Fix the fact that area options `minSize` and `aspectRatio` weren't passed to the image cropper when coming directly from the area and the widget controls (without passing through the widget editor).
* Fixes the widget data being cloned to be saved before the `postprocess` method being called, which leads to a loss of data in `AposWidgetEditor` (like the autocrop data).
* In editors like `AposWidgetEditor` relationships are now post processed after they are updated in `AposInputRelationship` only for the relationship that has been updated. 
It allows live preview to work well with it, it also avoids complexity and fixes updated data not being properly synced between the editor and the `AposSchema`.
* Deeply nested widgets can now be edited properly via the editor dialog box. This longstanding issue did not affect on-page editing.

### Changes

* Rolled back a change in 4.16.0 that strictly enforced `required` and `min` for relationship fields. Because the related document can be archived or deleted at any time, it is misleading to offer such enforcement. Also, it greatly complicates adding these constraints to existing schemas, resulting in surprising and unwanted behaviors. Therefore it is better for these constraints to be soft constraints on the front end. `max` is still a hard constraint.
* The `@apostrophecms/login/whoami` route now accepts both `POST` (recommended) and `GET` requests. Previously, it only supported `GET`. This maintains backwards compatibility while aligning with the documentation’s recommendation to use `POST`.

## 4.20.0 (2025-08-06)

### Adds

* Adds any alt text found in an attribute to the media library attachment during import of rich text inline images by API
* Adds `prependNodes` and `appendNodes` methods to every module. These methods allow you to inject HTML to every page using a `node` declaration.

### Changes

* A `clone-widget.js` file has been factored out, providing a universal way to return a clone of an existing widget which is distinct from the original.
* Adds any alt text found in an attribute to the media library attachment during import of rich text inline images by API
* Adds `prependNodes` and `appendNodes` methods to every module. These methods allow you to inject HTML to every page using a `node` declaration.
* Changes handling of `order` and `groups` in the `admin-bar` module to respect, rather that reverse, the order of items
* Interacting with the text inside a rich text widget will hide the widget controls to prevent awkward text selection.

### Fixes

* Let the `@apostrophecms/page:unpark` task unpark all parked pages with the given slug, not just the first one.
* Exclude unknown page types from the page manager.
* Remove multiple calls to render-widget when switch to edit mode.
* Resolved an issue affecting `withRelationships` with two or more steps. This issue could cause a document to appear to be related to the same document more than once.
* You can now use checkboxes as filter `inputType`.
* Fixed a regression that prevented multiple variations of `p` with different classes from being recognized again when reopening the rich text editor, even if they are all on the style menu. This was caused by knock-on effects of upstream changes in tiptap and prosemirror and our previous efforts to mitigate these. Those upstream changes were correct, but they did have certain side effects in ApostropheCMS. By more fully specifying the desired behavior, we have now fully corrected the issue at the ApostropheCMS level.
* Correctly update alt attribute of images in rich text widgets.

### Security

* Clear an npm audit warning by replacing `connect-multiparty` with `multer`. Thanks to [Radhakrishnan Mohan](https://github.com/RadhaKrishnan) for this contribution.
* To be clear, this was never an actual security vulnerability. The CVE in question is disputed, and for good reasons. However, since `connect-multiparty` is no longer maintained, it makes sense to move to `multer`.

## 4.19.0 (2025-07-09)

### Adds

* Implemented GET /api/v1/@apostrophecms/login/whoami route such that it returns the details of the currently logged in user; added the route to the login module.
  Thanks to [sombitganguly](https://github.com/sombitganguly) for this contribution.
* Adds keyboard shortcuts for manipulating widgets in areas. Includes Cut, Copy, Paste, Delete, and Duplicate.
* Automatic translation now supports a disclaimer and an help text for the checkbox. You can now set the disclaimer by setting `automaticTranslationDisclaimer` `i18n` key and the help text by setting `automaticTranslationCheckboxHelp` `i18n` key.
* Adds dynamic choices working with piece manager filters.
* Allow `import.imageTags` (array of image tag IDs) to be passed to the rich text widget when importing (see <https://docs.apostrophecms.org/reference/api/rich-text.html#importing-inline-images>).
* Adds a new way to make `GET` requests with a large query string. It can become a `POST` request containing the key `__aposGetWithQuery` in its body.
A middleware checks for this key and converts the request back to a `GET` request with the right `req.query` property.
* Adds a new batch operation to tag images.

### Changes

### Fixes

* Add missing Pages manager shortcuts list helper.
* Improve the `isEmpty` method of the rich text widget to take into account the HTML blocks (`<figure>` and `<table>`) that are not empty but do not contain any plain text.
* Fixed admin bar item ordering to correctly respect the precedence hierarchy: groups (when leader is positioned) > explicit order array > groups (when leader has positioning options) > individual `last`/`after` options.
* (Backward compatibility break) Conditional field that depends on already hidden field is also hidden, again.

## 4.18.0 (2025-06-11)

### Adds

* Adds MongoDB-style support (comparison operators) for conditional fields and all systems that use conditions. Conditional fields now have access to the `following` values from the parent schema fields.
* Add `followingIgnore` option to the `string` field schema. A boolean `true` results in all `following` values being ignored (not attempted to be used as a value for the field). When array of strings, the UI will ignore every item that matches a `following` field name.
* Adds link configuration to the `@apostrophecms/image-widget` UI and a new option `linkWithType` to control what document types can be linked to. Opt-out of the widget inline styles (reset) by setting `inlineStyles: false` in the widget configuration or contextual options (area).
* Use the link configuration of the Rich Text widget for image links too. It respects the existing `linkWithType` Rich Text option and uses the same schema (`linkFields`) used for text links. The fields from that schema can opt-in for specific tiptap extension now via a field property `extensions` (array) with possible array values `Link` and/or `Image`. You still need to specify the `htmlAttribute` property (the name of the attribute to be added to the link tag) in the schema when adding more fields. If the `extensions` property is not set, the field will be applied for both tiptap extensions.
* Adds body style support for breakpoint preview mode. Created new `[data-apos-refreshable-body]` div inside the container during breapoint preview.
Switch body attributes to this new div to keep supporting body styles in breakpoint preview mode.

### Changes

* Set the `Cache-Control` header to `no-store` for error pages in order to prevent the risk of serving stale error pages to users.
* Updates rich-text default configuration.

### Fixes

* The Download links in the media library now immediately download the file as expected, rather than navigating to the image in the current tab. `AposButton` now supports the `:download="true"` prop as expected.
* Using an API key with the editor, contributor or guest role now have a `req` object with the corresponding rights. The old behavior gave non-admin API keys less access than expected.

## 4.17.1 (2025-05-16)

### Fixes

* Pinned to tiptap 2.11.0 and specific prosemirror releases compatible with it, to work around a bug that broke the behavior of lists in the editor when re-opening an existing list. We are working with upstream projects to resolve this so we can continue to track updates in tiptap and prosemirror.

## 4.17.0 (2025-05-14)

### Adds

* Support for `fetchRelationships: false` in `applyPatch` and related methods. This is intended for the use of the `@apostrophecms/import-export` module, so the functionality is not exposed in a way that can be accessed simply by making a web request.

### Fixes

* Errors thrown on the server side by subfields of widgets are now reported in a useful form at the document level. Previously a different error occurred in the error handling logic itself, confusing the issue.

## 4.16.0 (2025-05-14)

### Adds

* Uses new `widgetOperations` to add the `adjustImage` operation to the image widget.
* Adds a server validation before adding a widget to an area. Introduces a new POST route `@apostrophecms/area/validate-widget`.
* The new `widgetOperations` cascade config property can be used to display custom operations for widgets. An `if` condition can be used to test properties of the widget before displaying an operation.

### Changes

* Enable widget live preview by default.

### Fixes

* Fixes `range` field type default value not being set properly.
* Fixes autocomplete and search sorting and as a consequence, fixes potential duplicates during pagination.
* Fixes all eslint warnings.
* When pasting a widget from the clipboard, the correct widget type is always offered on the "Add Content" menu.
* Widget live preview is now attempting to auto-position the Widget Editor modal only if no explicit widget configuration (`options.origin`) is provided.
* `required` is now implemented on the server side as well for `relationship` fields. It behaves like `min: 1`. It was always implemented on the front end. However, note that a relationship can still become empty if the related document is archived or deleted.
* Image widgets, and others with a placeholder when empty, now restore their placeholder view when canceling the widget editor in live preview mode.
* Fixes `z-index` of widget controls, going above the controls add button.

### Changes

* Updates the default fields for the `getMangageApiProjection()` to include a more sensible base configuration and adds a `true` option to return the minimal default values.

## 4.15.2 (2025-04-28)

### Security

* Fixes a potential XSS attack vector, [CVE-2025-26791](https://github.com/advisories/GHSA-vhxf-7vqr-mrjg). While the risk was low, it was possible for one user with login and editing privileges to carry out an XSS attack on another by uploading a specially crafted SVG file. Normally this would not work because ApostropheCMS typically renders uploaded SVGs via an `img` tag, however if the second user downloaded the SVG file from the media library the exploit could work.

## 4.15.1 (2025-04-22)

### Fixes

* Fixes a RT bug where including `table` in `toolbar` but omitting an `insert` array crashed the rich text editor.

## 4.15.0 (2025-04-16)

### Adds

* To display a live preview on the page as changes are made to widgets, set the `preview: true` option on any widget module. To turn it on for all widgets, you can set it on the `@apostrophecms/widget-type` module, the base class of all widget modules. This works especially well when `range` fields are used to achieve visual effects.
* Adds separate control bar for editing tables in rich text
* Adds ability to drag-resize rich text table columns

### Changes

* Improve the Page Manager experience when dragging and dropping pages - the updates happen in background and the UI is not blocked anymore.
* Allow scrolling while dragging a page in the Page Manager.
* Change user's email field type to `email`.
* Improve media manager experience after uploading images. No additional server requests are made, no broken UI on error.
* Change reset password form button label to `Reset Password`.
* Removed overly verbose logging of schema errors in the schema module itself. These are already logged appropriately if they become the actual result of an API call. With this change it becomes possible to catch and discard or mitigate these in some situations without excessive log output.
* Bumps eslint-config-apostrophe, fix errors and a bunch of warnings.
* Gets back checkboxes in the media manager.

### Fixes

* Adds missing notifications and error handling in media manager and save notification for auto-published pieces.
* Update `uploadfs` to `1.24.3`.
* Fixes an edge case where reordering a page in the Page Manager might affect another locale.
* Fixes chrome bug when pages manager checkboxes need a double click when coming from the rich text editor (because some text is selected).
* Fixes the rich text insert menu image menu not being properly closed.
* Fixes the rich text toolbar not closing sometimes when unfocusing the editor.
* Fixes missing wording on images batch operations.
* Fixes rich text toolbar width being limited to parent width.
* Fixes rich text insert menu focused item text color easily overridable.
* Fixes long overlapping text in the header of the Report modal.
* Fixes clipped text in the pager and in the relationship filters of piece manager.
* Fixes an error when pressing Enter in a relationship input without a focused suggestion.
* Fixes locale switcher not allowing to switch the page of an article when its parent page is draft only.

## 4.14.2 (2025-04-02)

### Fixes

* Hotfix: the `choices` query parameter of the REST API no longer results in a 500 error if an invalid filter name is part of the list. Such filters are now properly ignored in `choices`. This issue could also have resulted in invocation of query methods that are not builders, however since all such methods are read-only operations, no arguments could be passed and no information was returned, there are no security implications.

## 4.14.1 (2025-03-31)

### Fixes

* Hotfix: fixes a bug in which the same on-demand cache was used across multiple sites in the presence of `@apostrophecms/multisite`. In rare cases, this bug could cause the home page of site "A" to be displayed on a request for site "B," but only if requests were simultaneous. This bug did not impact single-site projects.

## 4.14.0 (2025-03-19)

### Adds

* Add a label for the `@apostrophecms/attachment` module (error reporting reasons).
* Add `translate` boolean option for report modal header configuration to force translation of the relevant items value (table cells).
* Adds feature to generate a table from an imported CSV file inside the rich-text-widget.
* Add data-test attributes to the login page.
* Adds AI-generated missing translations
* Adds the missing "Tags" filter to the chooser/manager view of files.
* Adds batch operations to the media manager.
* Passes `moduleName` to the event `content-changed` for batch operations, to know if data should be refreshed or not.

### Changes

* Bumps the `perPage` option for piece-types from 10 to 50
* Reworks rich text popovers to use `AposContextMenu`, for toolbar components as well as insert menu items.

### Fixes

* The `lang` attribute of the `<html>` tag now respects localization.
* Fixes the focus styling on AposTable headers.
* Proper errors when widgets are badly configured in expanded mode.
* More reliable Media Manager infinite scroll pagination.
* Fixes margin collapse in nested areas by switching to `padding` instead of `margin`
* Fixes Edit in Media Manager when the image is not in the currently loaded images. This may happen when the the Media Manager is in a relationship mode.
* Removes `publish` batch operation for `autopublished` pieces.
* Fixes `restore` batch operation having the action `update`.
* Fixes `localize` batch operation having no `action` and no `docIds`.

### Removes

* Table controls from the default rich text control bar

## 4.13.0 (2025-02-19)

### Adds

* Supports progress notification type, can be used when no job are involved. Manage progress state into the new `processes` entity.
* Moves global notification logic into Pinia store as well as job polling that updates processes.

### Fixes

* Field inputs inside an array modal can now be focused/tabbed via keyboard
* Fixes admin bar overlapping widget area add menu.
* Fixed the checkered background for gauging color transparency.
* Fixes `group.operations` (batch configuration) merging between modules in the same way that `group.fields` are merged.
* The i18n manager detects the current locale correctly in some edge cases, like when the locale is changed per document (Editor Modal) and the localization manager is opened from a relationship manager via a document context menu.

### Adds

* Add support for batch localization of pieces and pages.
* Adds type for each file uploaded by big-upload. Moves big-upload-client to `apos/ui` folder and makes it esm.
* When present, projections for reverse relationships now automatically include the special id and field storage properties for the relationship in question, allowing the related documents to be successfully returned.
* Introduce `AposModalReport` component for displaying table reports. It's accessible via `apos.report(content, options)` method and it's now used in the `@apostrophecms/i18n` module for detailed reporting after a batch localization operation.

### Changes

* The array editor's `isModified` method is now a computed property for consistency.
* The `modal` configuration property for batch operations without a group is now accepted and works as expected in the same way as for grouped operations.
* Explicitly enable document versions for `@apostrophecms/file-tag`, `@apostrophecms/file`, `@apostrophecms/image-tag` and `@apostrophecms/image` piece types.

### Adds

* If `error.cause` is prevent, log the property.

## 4.12.0 (2025-01-27)

### Fixes

* Fixes ability to change color hue by clicking the color hue bar rather than dragging the indicator.
* Prevents the rich text control bar from closing while using certain UI within the color picker.
* Saving a document via the dialog box properly refreshes the main content area when on a "show page" (when the context document is a piece rather than a page)
* Fixes the `AposButtonSplit` markup to follow the HTML5 specification, optimizes the component performance, visuals and testability.
* Fixes a case where releationship button overlaps a context menu.

### Adds

* Ability to disable the color spectrum UI of a color picker
* Accessibility improvement for the rich text editor Typography toolbar item.
* Adds `moduleLabels` prop to `AposDocContextMenu` to pass it to opened modals from custom operations (used by templates to define labels to display on the export modal).

### Changes

* Range style updates.
* The `pickerOptions` sub property of a color field's configuration has been merged with it's parent `options` object.
* Reworks `inline` and `micro` UI of some fields (color, range, select). Improve global inline style.
* Makes the range input being a number all the time instead of a string that we convert manually.
* Command line tasks can run before the first frontend asset build without error messages.

## 4.11.2 (2024-12-29)

### Fixes

* Fixes a bug where images in Media manager are not selectable (click on an image does nothing) in both default and relationship mode.
* Eliminated superfluous error messages. The convert method now waits for all recursive invocations to complete before attempting to determine if fields are visible.

### Adds

* Possibility to set a field not ready when performing async operations, when a field isn't ready, the validation and emit won't occur.

## 4.11.1 (2024-12-18)

### Fixes

* Corrected a unit test that relies on the sitemap module, as it now makes explicit that the project level `baseUrl` must be set for a successful experience, and the module level `baseUrl` was set earlier. No other changes.

## 4.11.0 (2024-12-18)

### Adds

* When validating an `area` field, warn the developer if `widgets` is not nested in `options`.
* Adds support for supplying CSS variable names to a color field's `presetColors` array as selectable values.
* Adds support for dynamic focus trap in Context menus (prop `dynamicFocus`). When set to `true`, the focusable elements are recalculated on each cycle step.
* Adds option to disable `tabindex` on `AposToggle` component. A new prop `disableFocus` can be set to `false` to disable the focus on the toggle button. It's enabled by default.
* Adds support for event on `addContextOperation`, an option `type` can now be passed and can be `modal` (default) or `event`, in this case it does not try to open a modal but emit a bus event using the action as name.

### Fixes

* Focus properly Widget Editor modals when opened. Keep the previous active focus on the modal when closing the widget editor.
* a11y improvements for context menus.
* Fixes broken widget preview URL when the image is overridden (module improve) and external build module is registered.
* Inject dynamic custom bundle CSS when using external build module with no CSS entry point.
* Range field now correctly takes 0 into account.
* Apos style does not go through `postcss-viewport-to-container-toggle` plugin anymore to avoid UI bugs.

## 4.10.0 (2024-11-20)

### Fixes

* Extra bundle detection when using external build module works properly now.
* Widget players are now properly invoked when they arrive later in the page load process.
* Fix permission grid tooltip display.
* Fixes a bug that crashes external frontend applications.
* Fixes a false positive warning for module not in use for project level submodules (e.g. `widges/module.js`) and dot-folders (e.g. `.DS_Store`).
* Bumped `express-bearer-token` dependency to address a low-severity `npm audit` warning regarding noncompliant cookie names and values. Apostrophe
did not actually use any noncompliant cookie names or values, so there was no vulnerability in Apostrophe.
* Rich text "Styles" toolbar now has visually focused state.
* The `renderPermalinks` and `renderImages` methods of the `@apostrophecms/rich-text` module now correctly resolve the final URLs of page links and inline images in rich text widgets, even when the user has editing privileges. Formerly this was mistakenly prevented by logic intended to preserve the editing experience. The editing experience never actually relied on the
rendered output.
* Search bar will perform the search even if the bar is empty allowing to reset a search.
* Fixes Color picker being hidden in an inline array schema field, also fixes rgba inputs going off the modal.

### Adds

* It's possible now to target the HMR build when registering via `template.append` and `template.prepend`. Use `when: 'hmr:public'` or `when: 'hmr:apos'` that will be evaluated against the current asset `options.hmr` configuration.
* Adds asset module option `options.modulePreloadPolyfill` (default `true`) to allow disabling the polyfill preload for e.g. external front-ends.
* Adds `bundleMarkup` to the data sent to the external front-end, containing all markup for injecting Apostrophe UI in the front-end.
* Warns users when two page types have the same field name, but a different field type. This may cause errors or other problems when an editor switches page types.
* The piece and page `GET` REST APIs now support `?render-areas=inline`. When this parameter is used, an HTML rendering of each widget is added to that specific widget in each area's `items` array as a new `_rendered` property. The existing `?render-areas=1` parameter is still supported to render the entire area as a single `_rendered` property. Note that this older option also causes `items` to be omitted from the response.

### Changes

* Removes postcss plugin and webpack loader used for breakpoint preview mode. Uses instead the new `postcss-viewport-to-container-toggle` plugin in the webpack config.
* Implement `vue-color` directly in Apostrophe rather than as a dependency
* Switch color handling library from `tinycolor2` to `@ctrl/tinycolor`
* Removes error messages in server console for hidden fields. These messages should not have been printed out in the server console in the first place.
* Removes invalid error messages on select fields appearing while opening an existing valid document.

## 4.9.0 (2024-10-31)

### Adds

* Relationship inputs have aria accessibility tags and autocomplete suggestions can be controlled by keyboard.
* Elements inside modals can have a `data-apos-focus-priority` attribute that prioritizes them inside the focusable elements list.
* Modals will continute trying to find focusable elements until an element marked `data-apos-focus-priority` appears or the max retry threshold is reached.
* Takes care of an edge case where Media Manager would duplicate search results.
* Add support for ESM projects.
* Modules can now have a `before: "module-name"` property in their configuration to initialize them before another module, bypassing the normal
order implied by `defaults.js` and `app.js`.
* `select` and `checkboxes` fields that implement dynamic choices can now take into account the value of other fields on the fly, by specifying
a `following` property with an array of other field names. Array and object subfields can access properties of the parent document
by adding a `<` prefix (or more than one) to field names in `following` to look upwards a level. Your custom method on the server side will
now receive a `following` object as an additional argument. One limitation: for now, a field with dynamic choices cannot depend on another field
with dynamic choices in this way.
* Adds AI-generated missing translations
* Adds the mobile preview dropdown for non visibles breakpoints. Uses the new `shortcut` property to display breakpoints out of the dropdown.
* Adds possibility to have two icons in a button.
* Breakpoint preview only targets `[data-apos-refreshable]`.
* Adds a `isActive` state to context menu items. Also adds possibility to add icons to context menu items.
* Add a postcss plugin to handle `vh` and `vw` values on breakpoint preview mode.
* Adds inject component `when` condition with possible values `hmr`, `prod`, and `dev`. Modules should explicitely register their components with the same `when` value and the condition should be met to inject the component.
* Adds inject `bundler` registration condition. It's in use only when registering a component and will be evaluated on runtime. The value should match the current build module (`webpack` or the external build module alias).
* Adds new development task `@apostrophecms/asset:reset` to reset the asset build cache and all build artifacts.
* Revamps the `@apostrophecms/asset` module to enable bundling via build modules.
* Adds `apos.asset.devServerUrl()` nunjucks helper to get the (bundle) dev server URL when available.
* The asset module has a new option, `options.hmr` that accepts `public` (default), `apos` or `false` to enable HMR for the public bundle or the admin UI bundle or disable it respectively. This configuration works only with external build modules that support HMR.
* The asset module has a new option, `options.hmrPort` that accepts an integer (default `null`) to specify the HMR WS port. If not specified, the default express port is used. This configuration works only with external build modules that support HMR WS.
* The asset module has a new option, `options.productionSourceMaps` that accepts a boolean (default `false`) to enable source maps in production. This configuration works only with external build modules that support source maps.

### Changes

* Silence deprecation warnings from Sass 1.80+ regarding the use of `@import`. The Sass team [has stated there will be a two-year transition period](https://sass-lang.com/documentation/breaking-changes/import/#transition-period) before the feature is actually removed. The use of `@import` is common practice in the Apostrophe codebase and in many project codebases. We will arrange for an orderly migration to the new `@use` directive before Sass 3.x appears.
* Move saving indicator after breakpoint preview.
* Internal methods `mergeConfiguration`, `autodetectBundles`, `lintModules`, `nestedModuleSubdirs` and `testDir` are now async.
* `express.getSessionOptions` is now async.

### Fixes

* Modifies the `AposAreaMenu.vue` component to set the `disabled` attribute to `true` if the max number of widgets have been added in an area with `expanded: true`.
* `pnpm: true` option in `app.js` is no longer breaking the application.
* Remove unused `vue-template-compiler` dependency.
* Prevent un-publishing the `@apostrophecms/global` doc and more generally all singletons.
* When opening a context menu while another is already opened, prevent from focusing the button of the first one instead of the newly opened menu.
* Updates `isEqual` method of `area` field type to avoid comparing an area having temporary properties with one having none.
* In a relationship field, when asking for sub relationships using `withRelationships` an dot notion.
If this is done in combination with a projection, this projection is updated to add the id storage fields of the needed relationships for the whole `withRelationships` path.
* The admin UI no longer fails to function when the HTML page is rendered with a direct `sendPage` call and there is no current "in context" page or piece.

## 4.7.2 and 4.8.1 (2024-10-09)

### Fixes

* Correct a race condition that can cause a crash at startup when custom `uploadfs` options are present in some specific cloud environments e.g. when using Azure Blob Storage.

## 4.8.0 (2024-10-03)

### Adds

* Adds a mobile preview feature to the admin UI. The feature can be enabled using the `@apostrophecms/asset` module's new `breakpointPreviewMode` option. Once enabled, the asset build process will duplicate existing media queries as container queries. There are some limitations in the equivalence between media queries and container queries. You can refer to the [CSS @container at-rule](https://developer.mozilla.org/en-US/docs/Web/CSS/@container) documentation for more information. You can also enable `breakpointPreviewMode.debug` to be notified in the console when the build encounters an unsupported media query.
* Apostrophe now automatically adds the appropriate default values for new properties in the schema, even for existing documents in the database. This is done automatically during the migration phase of startup.
* Adds focus states for media library's Uploader tile.
* Adds focus states file attachment's input UI.
* Simplified importing rich text widgets via the REST API. If you  you have HTML that contains `img` tags pointing to existing images, you can now import them all quickly. When supplying the rich text widget object, include an `import` property with an `html` subproperty, rather than the usual `content` property. You can optionally provide a `baseUrl` subproperty as well. Any images present in `html` will be imported automatically and the correct `figure` tags will be added to the new rich text widget, along with any other markup acceptable to the widget's configuration.

### Changes

* The various implementations of `newInstance` found in Apostrophe, e.g. for widgets, array items, relationship fields and documents themselves, have been consolidated in one implementation. The same code is now reused both on the front and the back end, ensuring the same result without the need to introduce additional back end API calls.

### Fixes

* Apostrophe's migration logic is no longer executed twice on every startup and three times in the migration task. It is executed exactly once, always at the same point in the startup process. This bug did not cause significant performance issues because migrations were always only executed once, but there is a small performance improvement due to not checking for them more than once.
* The `@apostrophecms/page` module APIs no longer allow a page to become a child of itself. Thanks to [Maarten Marx](https://github.com/Pixelguymm) for reporting the issue.
* Uploaded SVGs now permit `<use>` tags granted their `xlink:href` property is a local reference and begins with the `#` character. This improves SVG support while mitgating XSS vulnerabilities.
* Default properties of object fields present in a widget now populate correctly even if never focused in the editor.
* Fixed the "choices" query builder to correctly support dynamic choices, ensuring compatibility with the [`piecesFilters`](https://docs.apostrophecms.org/reference/modules/piece-page-type.html#piecesfilters) feature when using dynamic choices.
* Fix a reordering issue for arrays when dragging and dropping items in the admin UI.
* The inline array item extract the label now using `title` as `titleField` value by default (consistent with the Slat list).

## 4.7.1 (2024-09-20)

### Fixes

* Ensure parked fields are not modified for parked pages when not configured in `_defaults`.

## 4.7.0 (2024-09-05)

### Changes

* UI and UX of inline arrays and their table styles

### Adds

* To aid debugging, when a file extension is unacceptable as an Apostrophe attachment the rejected extension is now printed as part of the error message.
* The new `big-upload-client` module can now be used to upload very large files to any route that uses the new `big-upload-middleware`.
* Add option `skipReplace` for `apos.doc.changeDocIds` method to skip the replacing of the "old" document in the database.
* The `@apostrophecms/i18n` module now exposes a `locales` HTTP GET API to aid in implementation of native apps for localized sites.
* Context menus can be supplied a `menuId` so that interested components can listen to their opening/closing.
* Allow to set mode in `AposWidget` component through props.
* Add batch operations to pages.
* Add shortcuts to pages manager.
* Add `replaces` (boolean, `false` by default) option to the context operation definition (registered via `apos.doc.addContextOperation()`) to allow the operation to require a replace confirmation before being executed. The user confirmation results in the Editor modal being closed and the operation being executed. The operation is not executed if the user cancels the confirmation.

### Changes

* Wait for notify before navigating to a new page.
* Send also `checkedTypes` via the pages body toolbar operations (e.g. 'batch') to the modal.

### Fixes

* Fix link to pages in rich-text not showing UI to select page during edit.
* Bumps `uploadfs` dependency to ensure `.tar.gz`, `.tgz` and `.gz` files uploaded to S3 download without double-gzipping.
This resolves the issue for new uploads.
* Registering duplicate icon is no longer breaking the build.
* Fix widget focus state so that the in-context Add Content menu stays visible during animation
* Fix UI of areas in schemas so that their context menus are layered overtop sibling schema fields UI
* Fix unhandled promise rejections and guard against potential memory leaks, remove 3rd party `debounce-async` dependency
* Adds an option to center the context menu arrow on the button icon. Sets this new option on some context menus in the admin UI.
* Fixes the update function of `AposSlatLists` so that elements are properly reordered on drag

## 4.6.1 (2024-08-26)

### Fixes

* Registering duplicate icon is no longer breaking the build.
* Fix widget focus state so that the in-context Add Content menu stays visible during animation.
* Fix UI of areas in schemas so that their context menus are layered overtop sibling schema fields UI.

### Removes

* Inline array option for `alwaysOpen` replaced with UI toggles

## 4.6.0 (2024-08-08)

### Adds

* Add a locale switcher in pieces and pages editor modals. This is available for localized documents only, and allows you to switch between locales for the same document.
  The locale can be switched at only one level, meaning that sub documents of a document that already switched locale will not be able to switch locale itself.
* Adds visual focus states and keyboard handlers for engaging with areas and widgets in-context
* Adds method `simulateRelationshipsFromStorage` method in schema module.
This method populates the relationship field with just enough information to allow convert to accept it. It does not fully fetch the related documents. It does the opposite of prepareForStorage.
* A new options object has been added to the convert method.
Setting the `fetchRelationships` option to false will prevent convert from actually fetching relationships to check which related documents currently exist.
The shape of the relationship field is still validated.

### Changes

* Refactors Admin UI SASS to eliminate deprecation warnings from declarations coming after nested rules.
* Bumps the sass-loader version and adds a webpack option to suppress mixed declaration deprecation warnings to be removed when all modules are updated.
* Add `title` and `_url` to select all projection.
* Display `Select all` message on all pages in the manager modal.
* Refresh `checked` in manager modal after archive action.
* Update `@apostrophecms/emulate-mongo-3-driver` dependency to keep supporting `mongodb@3.x` queries while using `mongodb@6.x`.
* Updates rich text link tool's keyboard key detection strategy.
* Buttons that appear on slats (preview, edit crop/relationship, remove) are visually focusable and keyboard accessible.
* Added tooltip for update button. Thanks to [gkumar9891](https://github.com/gkumar9891) for this addition.

### Fixes

* Fixes the rendering of conditional fields in arrays where the `inline: true` option is used.
* Fixes the rich text link tool's detection and display of the Remove Link button for removing existing links
* Fixes the rich text link tool's detection and display of Apostrophe Page relationship field.
* Overriding standard Vue.js components with `editorModal` and `managerModal` are now applied all the time.
* Accommodate old-style replica set URIs with comma-separated servers by passing any MongoDB URIs that Node.js cannot parse directly to the MongoDB driver, and avoiding unnecessary parsing of the URI in general.
* Bump `oembetter` dependency to guarantee compatibility with YouTube. YouTube recently deployed broken `link rel="undefined"` tags on some of their video pages.
* It is now possible to see the right filename and line number when debugging the admin UI build in the browser. This is automatically disabled when `@apostrophecms/security-headers` is installed, because its defaults are incompatible by design.

## 4.5.4 (2024-07-22)

### Fixes

* Add a default projection to ancestors of search results in order to load a reasonable amount of data and avoid request timeouts.

## 4.5.3 (2024-07-17)

### Fixes

* Enhanced media selection with touchpad on Windows by extending focus timeout.

## 4.5.2 (2024-07-11)

### Fixes

* Ensure that `apos.doc.walk` never gets caught in an infinite loop even if circular references are present in the data. This is a hotfix for an issue that can arise when the new support for breadcrumbs in search results is combined with a more inclusive projection for page ancestors.
* Correct a longstanding bug in `apos.doc.walk` that led items to be listed twice in the `ancestors` array passed to the iterator.
* Correct a longstanding bug in `apos.doc.walk` that led ancestors that are themselves arrays to be misrepresented as a series of objects in the `ancestors` array passed to the iterator.
* For additional guarantees of reliability the `_dotPath` and `_ancestors` arguments to `apos.doc.walk`, which were always clearly documented as for internal use only, can no longer be passed in externally.

## 4.5.1 (2024-07-11)

### Changes

* Allow tiptap rich-text widget to open modals for images and links without closing the toolbar.

## 4.5.0 (2024-07-10)

### Adds

* Allow to disable shortcut by setting the option `shortcut: false`
* Adds a new color picker tool for the rich-text-widget toolbar that matches the existing `color` schema field. This also adds the same `pickerOptions` and `format` options to the rich-text-widget configuration that exist in the `color` schema field.
* Add missing UI translation keys.
* Infite scroll in media manager instead of pagination and related search fixes.
* Improves loaders by using new `AposLoadingBlock` that uses `AposLoading` instead of the purple screen in media manager.
* Select the configured aspect ratio and add `data-apos-field` attributes to the fields inside `AposImageRelationshipEditor.vue`.
* Add `getShowAdminBar` method. This method can be overriden in projects to drive the admin bar visibility for logged-in users.

### Fixes

* Removes unnecessary, broadly applied line-height setting that may cause logged-in vs logged-out visual discrepencies.
* Remove double GET request when saving image update.
* Fix filter menu forgetting selecting filters and not instantiating them.
* Remove blur emit for filter buttons and search bar to avoid re requesting when clicking outside…
* `this.modified` was not working properly (set to false when saving). We can now avoid to reload images when saving no changes.
* In media manager images checkboxes are disabled when max is reached.
* In media manager when updating an image or archiving, update the list instead of fetching and update checked documents to see changes in the right panel selected list.
* The `password` field type now has a proper fallback default, the empty string, just like the string field type
and its derivatives. This resolves bugs in which the unexpected `null` caused problems during validation. This bug
was old, but was masked in some situations until the release of version `4.4.3`.
* Identify and mark server validation errors in the admin UI. This helps editors identify already existing data fields, having validation errors when schema changes (e.g. optional field becomes required).
* Removes `menu-offset` props that were causing `AposContextMenu` to not display properly.
* Allows to pass a number or an array to `AposContextMenu` to set the offset of the context menu (main and cross axis see `floating-ui` documentation).
* Fixes the relationship fields not having the data when coming from the relationship modal.
* Fixes watch on `checkedDocs` passed to `AposSlatList` not being reactive and not seeing updated relationship fields.
* Adds styles for 1 column expanded area ([#4608](https://github.com/apostrophecms/apostrophe/issues/4608))
* Fixes weird slug computations based on followed values like title. Simplifies based on the new tech design.
* Prevent broken admin UI when there is a missing widget.
* Fixes media manager not loading images when last infinite scroll page have been reached (when uploading image for example).
* Upgrade oembetter versions to allow all vimeo urls.

### Changes

* Update `Choose Images` selection behavior. When choosing images as part of a relationship, you click on the image or checkbox to add the image to the selection.
If a max is set to allow only one image, clicking on the selected image will remove it from the selection. Clicking on another image will update the selection with the newly clicked image.
If a max is set to allow multiple images, you can remove images from the selection by using the checkbox. Clicking on the image will bring the image schema in the right panel.
You can upload images even if the max has been reached. We will append the uploaded images to the existing selection up to the max if any.
* Update `@apostrophecms/emulate-mongo-3-driver` dependency to keep supporting `mongodb@3.x` queries while using `mongodb@6.x`.

## 4.4.3 (2024-06-17)

### Fixes

* Do not use schema `field.def` when calling `convert`. Applying defaults to new documents is the job of `newInstance()` and similar code.
If you wish a field to be mandatory use `required: true`.
* As a convenience, using `POST` for pieces and pages with `_newInstance: true` keeps any additional `req.body` properties in the API response.
This feature unofficially existed before, it is now supported.
* Rollbacks watcher on `checked` array. Fixes, checked docs not being properly updated.

## 4.4.2 (2024-06-14)

### Fixes

* Hotfix: the new `_parent` property of pieces, which refers to the same piece page as `_parentUrl`, is now a carefully pruned
subset to avoid the risk of infinite recursion when the piece page has a relationship to a piece. Those who want `_parent`
to be more complete can extend the new `pruneParent` method of the relevant piece page module. This regression was
introduced in version 4.4.0.

## 4.4.1 (2024-06-12)

### Fixes

* Depend on `stylelint-config-apostrophe` properly via npm, not github.

## 4.4.0 (2024-06-12)

### Adds

* Adds a pinia store to handle modals logic.
* Methods from the store are registered on `apos.modal` instead of methods from `TheAposModals` component.
* No more need to emit `safe-close` when defining an `AposModal`, modal is automatically resolved when closed.
* Adds field components access to the reactive document value.
* Expose `AposContextMenu` owned method for re-calculation of the content position.
* Field Meta components of `slug` and `string` types can now fire `replace-field-value` events with text value payload, which will replace the respective field value.
* `AposInputString` now accepts a `rows` prop, in effect only when `field.textarea` is set to `true`.
* Add `T,S` shortcut to open the Personal Settings.
* Add `T,D` shortcut to open the Submitted Drafts.
* Add a scrollbar to the shortcut list.
* Add breadcrumbs to search results page.
* Pages relationships have now their checkboxes disabled when max is reached.

### Changes

* Improves widget tabs for the hidden entries, improves UX when validation errors are present in non-focused tabs.
* When moving a page, recognize when the slug of a new child
already contains the new parent's slug and not double it.
For example, given we have two pages as children of the home page, page A and page B.
Page A and page B are siblings.
Page A has the slug `/peer` and page B has the slug `/peer/page`.
Now we want page B to be the child of page A.
We will now end up with page B slug as `/peer/page` and not `/peer/peer/page` as before.
* `AposSpinner` now respects the colors for `heavy` weight mode and also accepts second, "light" color in this mode. Props JSDoc blocks are added.
* `AposContextMenu` now respects the `menuOffset` component property.
* Set `G,Shift+I` shortcut to open the Image Tags manager modal.
* Set `G,Shift+F` shortcut to open the File Tags manager modal.
* Remove slug from suggestion for images.
* Increase suggestion search image size to 50px.
* For suggestions with image, keep title on a single line and truncate title field with `...` when it hits the right side.

### Fixes

* Rich Text editor properly unsets marks on heading close.
* Widget client side schema validation.
* Allow `G,Shift+I` shortcut style.
* Detect shortcut conflicts when using multiple shortcuts.
* Updating schema fields as read-only no longer reset the value when updating the document.
* Fixes stylelint config file, uses config from our shared configuration, fixes all lint errors.
* Fixes `TheAposCommandMenu` modals not computing shortcuts from the current opened modal.
* Fixes select boxes of relationships, we can now check manually published relationships, and `AposSlatList` renders properly checked relationships.
* Fixes issues in `AposInputArray` on production build to be able to add, remove and edit array items after `required` error.
* Relationships browse button isn't disabled when max is reached.
* In media manager images checkboxes are disabled when max is reached.

## 4.3.3 (2024-06-04)

### Fixes

* Removes `$nextTick` use to re render schema in `AposArrayEditor` because it was triggering weird vue error in production.
Instead, makes the AposSchema for loop keys more unique using `modelValue.data._id`,
if document changes it re-renders schema fields.
* In media manager image checkboxes are disabled when max is reached.
* Fixes tiptap bubble menu jumping on Firefox when clicking on buttons. Also fixes the fact that
double clicking on bubble menu out of buttons would prevent it from closing when unfocusing the rich text area.
* In media manager images checkboxes are disabled when max is reached.
* Makes the final fields accessible in the media manager right rail.

## 4.3.2 (2024-05-18)

### Fixes

* Corrects a regression introduced in version 4.3.0 that broke the validation of widget modals, resulting in a confusing
error on the page. A "required" field in a widget, for instance, once again blocks the save operation properly.

### Changes

* Improves widget tab UI for the hidden entries, improves UX when validation errors are present in non-focused tabs.

## 4.3.1 (2024-05-17)

### Fixes

* Databases containing documents that no longer correspond to any module no longer cause the migration that adds missing mode properties
to fail (an issue introduced in version 4.2.0). Databases with no such "orphaned" documents were not affected.

## 4.3.0 (2024-05-15)

### Adds

* Allows to disable page refresh on content changed for page types.
* Widget editor can now have tabs.
* Adds prop to `AposInputMixin` to disable blur emit.
* Adds `throttle` function in ui module utils.
* Adds a `publicBundle` option to `@apostrophecms/asset`. When set to `false`, the `ui/src` public asset bundle is not built at all in most cases
except as part of the admin UI bundle which depends on it. For use with external front ends such as [apostrophe-astro](https://github.com/apostrophecms/apostrophe-astro).
Thanks to Michelin for contributing this feature.

### Fixes

* Do not show widget editor tabs when the developer hasn't created any groups.
* `npm link` now works again for Apostrophe modules that are dependencies of a project.
* Re-crop image attachments found in image widgets, etc. when replacing an image in the Media Manager.
* Fixes visual transitions between modals, as well as slider transition on overlay opacity.
* Changing the aspect ratio multiple times in the image cropper modal no longer makes the stencil smaller and smaller.

### Changes

* Improves `debounce` function to handle async properly (waiting for previous async call to finish before triggering a new one).
* Adds the `copyOfId` property to be passed to the `apos.doc.edit()` method, while still allowing the entire `copyOf` object for backwards compatibility.

### Fixes

## 4.2.1 (2024-04-29)

### Fixes

* Fixes drag and drop regression in the page tree where pages were not able to be moved between parent and child.

## 4.2.0 (2024-04-18)

* Typing a `/` in the title field of a page no longer confuses the slug field. Thanks to [Gauav Kumar](https://github.com/gkumar9891).

### Changes

* Rich text styles are now split into Nodes and Marks, with independent toolbar controls for a better user experience when applying text styles.
There is no change in how the `styles` option is configured.
* Rich text style labels are fully localized.
* `i18n` module now uses the regular `req.redirect` instead of a direct `res.redirect` to ensure redirection, enabling more possibilities for `@apostrophecms/redirect` module
* Refactors `AposModal` component with composition api to get rid of duplicated code in `AposFocusMixin` and `AposFocus`.
* `APOS_MONGODB_LOG_LEVEL` has been removed. According to [mongodb documentation](https://github.com/mongodb/node-mongodb-native/blob/main/etc/notes/CHANGES_5.0.0.md#mongoclientoptionslogger-and-mongoclientoptionsloglevel-removed) "Both the logger and the logLevel options had no effect and have been removed."
* Update `connect-mongo` to `5.x`. Add `@apostrophecms/emulate-mongo-3-driver` dependency to keep supporting `mongodb@3.x` queries while using `mongodb@6.x`.

### Fixes

* Updates the docs `beforeInsert` handler to avoid ending with different modes being set between `_id`, `aposLocale` and `aposMode`.
* Adds a migration to fix potential corrupted data having different modes set between `_id`, `aposLocale` and `aposMode`.
* Fix a crash in `notification` when `req.body` was not present. Thanks to Michelin for contributing this fix.
* Addresses a console error observed when opening and closing the `@apostrophecms-pro/palette` module across various projects.
* Fixes the color picker field in `@apostrophecms-pro/palette` module.
* Ensures that the `data-apos-test` attribute in the admin bar's tray item buttons is set by passing the `action` prop to `AposButton`.
* Prevents stripping of query parameters from the URL when the page is either switched to edit mode or reloaded while in edit mode.
* Add the missing `metaType` property to newly inserted widgets.

### Security

* New passwords are now hashed with `scrypt`, the best password hash available in the Node.js core `crypto` module, following guidance from [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
This reduces login time while improving overall security.
* Old passwords are automatically re-hashed with `scrypt` on the next successful login attempt, which
adds some delay to that next attempt, but speeds them up forever after compared to the old implementation.
* Custom `scrypt` parameters for password hashing can be passed to the `@apostrophecms/user` module via the `scrypt` option. See the [Node.js documentation for `scrypt`]. Note that the `maxmem` parameter is computed automatically based on the other parameters.

## 4.1.1 (2024-03-21)

### Fixes

* Hotfix for a bug that broke the rich text editor when the rich text widget has
a `styles` property. The bug was introduced in 4.0.0 as an indirect side effect of deeper
watching behavior by Vue 3.

## 4.1.0 (2024-03-20)

### Fixes

* Don't crash if a document of a type no longer corresponding to any module is present
together with the advanced permission module.
* AposLoginForm.js now pulls its schema from the user module rather than hardcoding it. Includes the
addition of `enterUsername` and `enterPassword` i18n fields for front end customization and localization.
* Simulated Express requests returned by `apos.task.getReq` now include a `req.headers` property, for
greater accuracy and to prevent unexpected bugs in other code.
* Fix the missing attachment icon. The responsibility for checking whether an attachment
actually exists before calling `attachment.url` still lies with the developer.

### Adds

* Add new `getChanges` method to the schema module to get an array of document changed field names instead of just a boolean like does the `isEqual` method.
* Add highlight class in UI when comparing documents.

## 4.0.0 (2024-03-12)

### Adds

* Add Marks tool to the Rich Text widget for handling toggling marks.
* Add translation keys used by the multisite assembly module.
* Add side by side comparison support in AposSchema component.
* Add `beforeLocalize` and `afterLocalize` events.
* Add custom manager indicators support via `apos.schema.addManagerIndicator({ component, props, if })`. The component registered this way will be automatically rendered in the manager modal.
* Add the possibility to make widget modals wider, which can be useful for widgets that contain areas taking significant space. See [documentation](https://v3.docs.apostrophecms.org/reference/modules/widget-type.html#options).
* Temporarily add `translation` module to support document translations via the `@apostrophecms-pro/automatic-translation` module.
**The `translation` core module may be removed or refactored to reduce overhead in the core,** so its presence should
not be relied upon.

### Changes

* Migrate to Vue 3. This entails changes to some admin UI code, as detailed in our public announcement.
There are no other backwards incompatible changes in apostrophe version 4.0.0.
Certain other modules containing custom admin UI have also been updated in a new major version to be compatible,
as noted in our announcement and on the migration page of our website.

### Fixes

* Adds `textStyle` to Tiptap types so that spans are rendered on RT initialization
* `field.help` and `field.htmlHelp` are now correctly translated when displayed in a tooltip.
* Bump the `he` package to most recent version.
* Notification REST APIs should not directly return the result of MongoDB operations.

## 3.63.2 (2024-03-01)

### Security

* Always validate that method names passed to the `external-condition` API actually appear in `if` or `requiredIf`
clauses for the field in question. This fix addresses a serious security risk in which arbitrary methods of
Apostrophe modules could be called over the network, without arguments, and the results returned to the caller.
While the lack of arguments mitigates the data exfiltration risk, it is possible to cause data loss by
invoking the right method. Therefore this is an urgent upgrade for all Apostrophe 3.x users. Our thanks to the Michelin
penetration test red team for disclosing this vulnerability. All are welcome to disclose security vulnerabilities
in ApostropheCMS code via [security@apostrophecms.com](mailto:security@apostrophecms.com).
* Disable the `alwaysIframe` query parameter of the oembed proxy. This feature was never used in Apostrophe core, and could be misused to carry out arbitrary GET requests in the context of an iframe, although it could not be used to exfiltrate any information other than the success or failure of the request, and the request was still performed by the user's browser only. Thanks to the Michelin team.
* Remove vestigial A2 code relating to polymorphic relationship fields. The code in question had no relevance to the way such a feature would be implemented in A3, and could be used to cause a denial of service by crashing and restarting the process. Thanks to the Michelin team.

## 3.63.1 (2024-02-22)

### Security

* Bump dependency on `sanitize-html` to `^2.12.1` at a minimum, to ensure that `npm update apostrophe` is sufficient to guarantee a security update is installed. This security update prevents specially crafted HTML documents from revealing the existence or non-existence of files on the server. The vulnerability did not expose any other information about those files. Thanks to the [Snyk Security team](https://snyk.io/) for the disclosure and to [Dylan Armstrong](https://dylan.is/) for the fix.

## 3.63.0 (2024-02-21)

### Adds

* Adds a `launder` method to the `slug` schema field query builder to allow for use in API queries.
* Adds support for browsing specific pages in a relationship field when `withType` is set to a page type, like `@apostrophecms/home-page`, `default-page`, `article-page`...
* Add support for `canCreate`, `canPreview` & `canShareDraft` in context operations conditions.
* Add support for `canCreate`, `canEdit`, `canArchive` & `canPublish` in utility operations definitions.
* Add `uponSubmit` requirement in the `@apostrophecms/login` module. `uponSubmit` requirements are checked each time the user submit the login form. See the documentation for more information.
* Add field metadata feature, where every module can add metadata to fields via public API offered by `apos.doc.setMeta()`, `apos.doc.getMeta()`, `apos.doc.getMetaPath()` and `apos.doc.removeMeta()`. The metadata is stored in the database and can be used to store additional information about a field.
* Add new `apos.schema.addFieldMetadataComponent(namespace, component)` method to allow adding custom components. They have access to the server-side added field metadata and can decide to show indicators on the admin UI fields. Currently supported fields are "string", "slug", "array", "object" and "area".

### Fixes

* When deleting a draft document, we remove related reverse IDs of documents having a relation to the deleted one.
* Fix publishing or moving published page after a draft page on the same tree level to work as expected.
* Check create permissions on create keyboard shortcut.
* Copy requires create and edit permission.
* Display a more informative error message when publishing a page because the parent page is not published and the current user has no permission to publish the parent page (while having permission to publish the current one).
* The `content-changed` event for the submit draft action now uses a complete document.
* Fix the context bar overlap on palette for non-admin users that have the permission to modify it.
* Show widget icons in the editor area context menu.

### Changes

* Share Drafts modal styles made larger and it's toggle input has a larger hitbox.

## 3.62.0 (2024-01-25)

### Adds

* Adds support for `type` query parameter for page autocomplete. This allows to filter the results by page type. Example: `/api/v1/@apostrophecms/page?autocomplete=something&type=my-page-type`.
* Add testing for the `float` schema field query builder.
* Add testing for the `integer` schema field query builder.
* Add support for link HTML attributes in the rich text widget via configurable fields `linkFields`, extendable on a project level (same as it's done for `fields`). Add an `htmlAttribute` property to the standard fields that map directly to an HTML attribute, except `href` (see special case below), and set it accordingly, even if it is the same as the field name. Setting `htmlAttribute: 'href'` is not allowed and will throw a schema validation exception (on application boot).
* Adds support in `can` and `criteria` methods for `create` and `delete`.
* Changes support for image upload from `canEdit` to `canCreate`.
* The media manager is compatible with per-doc permissions granted via the `@apostrophecms-pro/advanced-permission` module.
* In inline arrays, the trash icon has been replaced by a close icon.

### Fixes

* Fix the `launder` and `finalize` methods of the `float` schema field query builder.
* Fix the `launder` and `finalize` methods of the `integer` schema field query builder.
* A user who has permission to `publish` a particular page should always be allowed to insert it into the
published version of the site even if they could not otherwise insert a child of the published
parent.
* Display the "Browse" button in a relationship inside an inline array.

## 3.61.1 (2023-01-08)

### Fixes

* Pinned Vue dependency to 2.7.15. Released on December 24th, Vue 2.7.16 broke the rich text toolbar in Apostrophe.

## 3.61.0 (2023-12-21)

### Adds

* Add a `validate` method to the `url` field type to allow the use of the `pattern` property.
* Add `autocomplete` attribute to schema fields that implement it (cf. [HTML attribute: autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)).
* Add the `delete` method to the `@apostrophecms/cache` module so we don't have to rely on direct MongoDB manipulation to remove a cache item.
* Adds tag property to fields in order to show a tag next to the field title (used in advanced permission for the admin field). Adds new sensitive label color.
* Pass on the module name and the full, namespaced template name to external front ends, e.g. Astro.
Also make this information available to other related methods for future and project-level use.
* Fixes the AposCheckbox component to be used more easily standalone, accepts a single model value instead of an array.

### Fixes

* Fix `date` schema field query builder to work with arrays.
* Fix `if` on pages. When you open the `AposDocEditor` modal on pages, you now see an up to date view of the visible fields.
* Pass on complete annotation information for nested areas when adding or editing a nested widget using an external front, like Astro.
* We can now close the image modal in rich-text widgets when we click outside of the modal.
The click on the cancel button now works too.
* Fixes the `clearLoginAttempts` method to work with the new `@apostrophecms/cache` module `delete` method.

## 3.60.1 (2023-12-06)

### Fixes

* corrected an issue where the use of the doc template library can result in errors at startup when
replicating certain content to new locales. This was not a bug in the doc template library.
Apostrophe was not invoking `findForEditing` where it should have.

## 3.60.0 (2023-11-29)

### Adds

* Add the possibility to add custom classes to notifications.
Setting the `apos-notification--hidden` class will hide the notification, which can be useful when we only care about the event carried by it.
* Give the possibility to add horizontal rules from the insert menu of the rich text editor with the following widget option: `insert: [ 'horizontalRule' ]`.
Improve also the UX to focus back the editor after inserting a horizontal rule or a table.

### Fixes

* The `render-widget` route now provides an `options` property on the widget, so that
schema-level options of the widget are available to the external front end when
rendering a newly added or edited widget in the editor. Note that when rendering a full page,
this information is already available on the parent area: `area.options.widgets[widget.type]`
* Pages inserted directly in the published mode are now given a
correct `lastPublishedAt` property, correcting several bugs relating
to the page tree.
* A migration has been added to introduce `lastPublishedAt` wherever
it is missing for existing pages.
* Fixed a bug that prevented page ranks from renumbering properly during "insert after" operations.
* Added a one-time migration to make existing page ranks unique among peers.
* Fixes conditional fields not being properly updated when switching items in array editor.
* The `beforeSend` event for pages and the loading of deferred widgets are now
handled in `renderPage` with the proper timing so that areas can be annotated
successfully for "external front" use.
* The external front now receives 100% of the serialization-friendly data that Nunjucks receives,
including the `home` property etc. Note that the responsibility to avoid passing any nonserializable
or excessively large data in `req.data` falls on the developer when choosing to use the
`apos-external-front` feature.
* Wraps the group label in the expanded preview menu component in `$t()` to allow translation

## 3.59.1 (2023-11-14)

### Fixes

* Fix `if` and `requiredIf` fields inside arrays. With regard to `if`, this is a hotfix for a regression introduced in 3.59.0.

## 3.59.0 (2023-11-03)

### Changes

* Webpack warnings about package size during the admin UI build process have been turned off by default. Warnings are still enabled for the public build, where a large bundle can be problematic for SEO.

### Fixes

* Apostrophe warns you if you have more than one piece page for the same piece type and you have not overridden `chooseParentPage`
to help Apostrophe decide which page is suitable as the `_url` of each piece. Beginning with this release, Apostrophe can recognize
when you have chosen to do this via `extendMethods`, so that you can call `_super()` to fall back to the default implementation without
receiving this warning. The default implementation still just returns the first page found, but always following the
`_super()` pattern here opens the door to npm modules that `improve` `@apostrophecms/piece-page` to do something more
sophisticated by default.
* `newInstance` always returns a reasonable non-null empty value for area and
object fields in case the document is inserted without being passed through
the editor, e.g. in a parked page like the home page. This simplifies
the new external front feature.

### Adds

* An adapter for Astro is under development with support from Michelin.
Starting with this release, adapters for external fronts, i.e. "back for front"
frameworks such as Astro, may now be implemented more easily. Apostrophe recognizes the
`x-requested-with: AposExternalFront` header and the `apos-external-front-key` header.
If both are present and `apos-external-front-key` matches the `APOS_EXTERNAL_FRONT_KEY`
environment variable, then Apostrophe returns JSON in place of a normal page response.
This mechanism is also available for the `render-widget` route.
* Like `type`, `metaType` is always included in projections. This helps
ensure that `apos.util.getManagerOf()` can be used on any object returned
by the Apostrophe APIs.

## 3.58.1 (2023-10-18)

### Security

* Update `uploadfs` to guarantee users get a fix for a [potential security vulnerability in `sharp`](https://security.snyk.io/vuln/SNYK-JS-SHARP-5922108).
This was theoretically exploitable only by users with permission to upload media to Apostrophe
* Remove the webpack bundle analyzer feature, which had been nonfunctional for some time, to address a harmless npm audit warning
* Note: there is one remaining `npm audit` warning regarding `postcss`. This is not a true vulnerability because only developers
with access to the entire codebase can modify styles passed to `postcss` by Apostrophe, but we are working with upstream
developers to determine the best steps to clear the warning

### Fixes

* Automatically add `type` to the projection only if there are no exclusions in the projection. Needed to prevent `Cannot do
exclusion on field in inclusion projection` error.

## 3.58.0 (2023-10-12)

### Fixes

* Ensure Apostrophe can make appropriate checks by always including `type` in the projection even if it is not explicitly listed.
* Never try to annotate a widget with permissions the way we annotate a document, even if the widget is simulating a document.
* The `areas` query builder now works properly when an array of area names has been specified.

### Adds

* Widget schema can now follow the parent schema via the similar to introduced in the `array` field type syntax (`<` prefix). In order a parent followed field to be available to the widget schema, the area field should follow it. For example, if area follows the root schema `title` field via `following: ['title']`, any field from a widget schema inside that area can do `following: ['<title']`.
* The values of fields followed by an `area` field are now available in custom widget preview Vue components (registered with widget option `options.widget = 'MyComponentPreview'`). Those components will also receive additional `areaField` prop (the parent area field definition object).
* Allows to insert attachments with a given ID, as well as with `docIds` and `archivedDocIds` to preserve related docs.
* Adds an `update` method to the attachment module, that updates the mongoDB doc and the associated file.
* Adds an option to the `http` `remote` method to allow receiving the original response from `node-fetch` that is a stream.

## 3.57.0 2023-09-27

### Changes

* Removes a 25px gap used to prevent in-context widget UI from overlapping with the admin bar
* Simplifies the way in-context widget state is rendered via modifier classes

### Adds

* Widgets detect whether or not their in-context editing UI will collide with the admin bar and adjust it appropriately.
* Italian translation i18n file created for the Apostrophe Admin-UI. Thanks to [Antonello Zanini](https://github.com/Tonel) for this contribution.
* Fixed date in piece type being displayed as current date in column when set as undefined and without default value. Thanks to [TheSaddestBread](https://github.com/AllanKoder) for this contribution.

### Fixes

* Bumped dependency on `oembetter` to ensure Vimeo starts working again
for everyone with this release. This is necessary because Vimeo stopped
offering oembed discovery meta tags on their video pages.

### Fixes

* The `118n` module now ignores non-JSON files within the i18n folder of any module and does not crash the build process.

## 3.56.0 (2023-09-13)

### Adds

* Add ability for custom tiptap extensions to access the options passed to rich text widgets at the area level.
* Add support for [npm workspaces](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#workspaces) dependencies. A workspace dependency can now be used as an Apostrophe module even if it is not a direct dependency of the Apostrophe project. Only direct workspaces dependencies of the Apostrophe project are supported, meaning this will only work with workspaces set in the Apostrophe project. Workspaces set in npm modules are not supported, please use [`bundle`](https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#bundle) instead. For instance, I have an Apostrophe project called `website`. `website` is set with two [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces), `workspace-a` & `workspace-b`. `workspace-a` `package.json` contains a module named `blog` as a dependency. `website` can reference `blog` as enabled in the Apostrophe `modules` configuration.
* The actual invocation of `renderPageForModule` by the `sendPage` method of all modules has been
factored out to `renderPage`, which is no longer deprecated. This provides a convenient override point
for those who wish to substitute something else for Nunjucks or just wrap the HTML in a larger data
structure. For consistent results, one might also choose to override the `renderWidget` and `render`
methods of the `@apostrophecms/area` module, which are used to render content while editing.
Thanks to Michelin for their support of this work.
* Add `@apostrophecms/rich-text-widget:lint-fix-figure` task to wrap text nodes in paragraph tags when next to figure tags. Figure tags are not valid children of paragraph tags.
* Add `@apostrophecms/rich-text-widget:remove-empty-paragraph` task to remove empty paragraphs from all existing rich-texts.

## 3.55.1 (2023-09-11)

### Fixes

* The structured logging for API routes now responds properly if an API route throws a `string` as an exception, rather than
a politely `Error`-derived object with a `stack` property. Previously this resulted in an error message about the logging
system itself, which was not useful for debugging the original exception.

## 3.55.0 (2023-08-30)

### Adds

* Add `publicApiCheckAsync` wrapper method (and use it internally) to allow for overrides to do async permission checks of REST APIs. This feature doesn't introduce any breaking changes because the default implementation still invokes `publicApiCheck` in case developers have overridden it.

### Fixes

* Refresh schema field with same name in `AposDocEditor` when the schema changes.
* Infer parent ID mode from the request when retrieving the parent (target) page to avoid `notfound`.
* Log the actual REST API error message and not the one meant for the user.
* Hide dash on autopublished pages title.

## 3.54.0 (2023-08-16)

### Adds

* Add `@apostrophecms/log` module to allow structured logging. All modules have `logDebug`, `logInfo`, `logWarn` and `logError` methods now. See the [documentation](https://v3.docs.apostrophecms.org/guide/logging.html) for more details.
* Add `@apostrophecms/settings` translations.
* Add the ability to have custom modals for batch operations.
* Add the possibility to display utility operations inside a 3-dots menu on the page manager, the same way it is done for the docs manager.
* Custom context operations now accept a `moduleIf` property, which tests options at the module level
the same way that `if` tests properties of the document to determine if the operation should be
offered for a particular document. Note that not all options are passed to the front end unless
`getBrowserData` is extended to suit the need.
* Move Pages Manager modal business logic to a mixin.
* Add `column.extraWidth` option (number) for `AposTreeHeader.vue` to allow control over the tree cell width.
* Move `AposDocContextMenu.vue` business logic to a mixin.
* Move Pages Manager modal business logic to a mixin. Add `column.extraWidth` option (number) for `AposTreeHeader.vue` to allow control over the tree cell width.

### Changes

* Rename misleading `projection` parameter into `options` in `self.find` method signature for
`@apostrophecms/any-doc-type`, `@apostrophecms/any-page-type` & `@apostrophecms/piece-type`.
**This was never really a projection in A3,** so it is not a backwards compatibility issue.
* Hide save button during in-context editing if the document is autopublished.
* Beginning with this release, the correct `moduleName` for typical
actions on the context document is automatically passed to the
modal associated with a custom context operation, unless `moduleName`
is explicitly specified. The `moduleName` parameter to `addContextOperation`
is no longer required and should not be passed at all in most cases
(just pass the object argument). If you do wish to specify a `moduleName`
to override that prop given to the modal, then it is recommended to pass
it as a `moduleName` property of the object, not as a separate argument.
For backwards compatibility the two-argument syntax is still permitted.

### Fixes

* Resolved data integrity issue with certain page tree operations by inferring the best peer to position the page relative to rather
than attempting to remember the most recent move operation.
* Fixes a downstream bug in the `getFieldsByCategory` method in the `AposEditorMixin.js` by checking for a property before accessing it.
* In Nunjucks templates, `data.url` now includes any sitewide and locale URL prefixes. This fixes local prefixing for pagination of piece-type index pages.
* Changes were detected in various fields such as integers, which caused the "Update" button to be active even when there was no actual modification in the doc.
* Fix a bug that prevented adding multiple operations in the same batch operation group.
* The `getTarget` method of the page module should use `findForEditing` to make sure it is able to see
pages that would be filtered out of a public view by project level or npm module overrides.

## 3.53.0 (2023-08-03)

### Adds

* Accessibility improved for navigation inside modals and various UI elements.
Pages/Docs Manager and Doc Editor modal now have better keyboard accessibility.
They keep the focus on elements inside modals and give it back to their parent modal when closed.
This implementation is evolving and will likely switch to use the `dialog` HTML element soon.
* Adds support for a new `if` property in `addContextOperation` in order to show or not a context operation based on the current document properties.
* Add `update-doc-fields` event to call `AposDocEditor.updateDocFields` method
* Add schema field `hidden` property to always hide a field
* Hide empty schema tabs in `AposDocEditor` when all fields are hidden due to `if` conditions
* The front end UI now respects the `_aposEditorModal` and `_aposAutopublish`
properties of a document if present, and otherwise falls back to module
configuration. This is a powerful addition to custom editor components
for piece and page types, allowing "virtual piece types" on the back end that
deal with many content types to give better hints to the UI.
* Respect the `_aposAutopublish` property of a document if present, otherwise
fall back to module configuration.
* For convenience in custom editor components, pass the new prop `type`, the original type of the document being copied or edited.
* For better results in custom editor components, pass the prop `copyOfId`, which implies
the custom editor should fetch the original itself by its means of choice.
For backwards compatibility `copyOf` is still passed, but it may be an
incomplete projection and should not be used in new code.
* Custom context operations now receive a `docId` prop, which should
be used in preference to `doc` because `doc` may be an incomplete
projection.
* Those creating custom context operations for documents can now
specify both a `props` object for additional properties to be passed to
their modal and a `docProps` object to map properties from the document
to props of their choosing.
* Adds support to add context labels in admin bar.
* Adds support for admin UI language configuration in the `@apostrophecms/i18n` module. The new options allow control over the default admin UI language and configures the list of languages, that any individual logged in user can choose from. See the [documentation](https://v3.docs.apostrophecms.org/reference/modules/i18n.html) for more details.
* Adds `adminLocale` User field to allow users to set their preferred admin UI language, but only when the `@apostrophecms/i18n` is configured accordingly (see above).
* Adds `@apostrophecms/settings` module and a "Personal Settings" feature. See the [documentation](https://v3.docs.apostrophecms.org/reference/modules/settings.html) for more details.
* Adds `$and` operator on `addContextOperation` `if` property in order to check multiple fields before showing or hiding a context operation.

### Fixes

* `AposDocEditor` `onSave` method signature. We now always expect an object when a parameter is passed to the function to check
the value of `navigate` flag.
* Fixes a problem in the rich text editor where the slash would not be deleted after item selectin from the insert menu.
* Modules that have a `public` or `i18n` subdirectory no longer generate a
warning if they export no code.
* Clean up focus parent event handlers when components are destroyed. Prevents a slow degradation of performance while editing.
Thanks to [Joshua N. Miller](https://github.com/jmiller-rise8).
* Fixes a visual discrepancy in the rich text editor where empty paragraphs would appear smaller in preview mode compared to edit mode.

### Changes

* To make life easier for module developers, modules that are `npm link`ed to
the project no longer have to be listed in `package.json` as
dependencies. To prevent surprises this is still a requirement for modules
that are not symlinked.

## 3.52.0 (2023-07-06)

### Changes

* Foreign widget UI no longer uses inverted theme styles.

### Adds

* Allows users to double-click a nested widget's breadcrumb entry and open its editor.
* Adds support for a new `conditions` property in `addContextOperation` and validation of `addContextOperation` configuration.

### Fixes

* The API now allows the user to create a page without defining the page target ID. By default it takes the Home page.
* Users are no longer blocked from saving documents when a field is hidden
by an `if` condition fails to satisfy a condition such as `min` or `max`
or is otherwise invalid. Instead the invalid value is discarded for safety.
Note that `required` has always been ignored when an `if` condition is not
satisfied.
* Errors thrown in `@apostrophecms/login:afterSessionLogin` event handlers are now properly passed back to Passport as such, avoiding a process restart.

## 3.51.1 (2023-06-23)

## Fixes

* Fix a regression introduced in 3.51.0 - conditional fields work again in the array editor dialog box.

## 3.51.0 (2023-06-21)

### Adds

* Items can now be added to the user's personal menu in the
admin bar, alongside the "Log Out" option. To do so, specify
the `user: true` option when calling `self.apos.adminBar.add`.
This should be reserved for items that manage personal settings.
* When duplicating another document, the `_id` properties of
array items, widgets and areas are still regenerated to ensure
uniqueness across documents. However, an `_originalId` property
is now available for reference while the document remains in memory.
This facilitates change detection within array items in
`beforeSave` handlers and the like.
* Adds the possibility to add custom admin bars via the `addBar()` method from the `admin-bar` module.
* Adds support for conditional fields within `array` and `object` field schema. See the [documentation](https://v3.docs.apostrophecms.org/guide/conditional-fields/) for more information.

### Fixes

* Uses `findForEditing` method in the page put route.
* The "Duplicate" option in the page or piece manager now correctly duplicates the
entire document. This was a regression introduced in 3.48.0. The "Duplicate" option
in the editor dialog box always worked correctly.

### Changes

* Browser URL now changes to reflect the slug of the document according to the mode that is being viewed.

## 3.50.0 (2023-06-09)

### Adds

* As a further fix for issues that could ensue before the improvements
to locale renaming support that were released in 3.49.0, an
`@apostrophecms/page:reattach` task has been added. This command line task
takes the `_id` or `slug` of a page and reattaches it to the page tree as
the last child of the home page, even if page tree data for that page
is corrupted. You may wish to use the `--new-slug` and `--locale` options. This task should not
be needed in normal circumstances.

## 3.49.0 (2023-06-08)

### Changes

* Updates area UX to not display Add Content controls when a widget is focused.
* Updates area UX to unfocus widget on esc key.
* Updates widget UI to use dashed outlines instead of borders to indicate bounds.
* Updates UI for Insert Menu.
* Updates Insert Menu UX to allow mid-node insertion.
* Rich Text Widget's Insert components are now expected to emit `done` and `cancel` for proper RT cleanup. `close` still supported for BC, acts as `done`.
* Migrated the business logic of the login-related Vue components to external mixins, so that the templates and styles can be overridden by
copying the component `.vue` file to project level without copying all of the business logic. If you have already copied the components to style them,
we encourage you to consider replacing your `script` tag with the new version, which just imports the mixin, so that fixes we make there will be
available in your project.

### Adds

* Adds keyboard accessibility to Insert menu.
* Adds regex pattern feature for string fields.
* Adds `pnpm` support. Introduces new optional Apostrophe root configuration `pnpm` to force opt-in/out when auto detection fails. See the [documentation](https://v3.docs.apostrophecms.org/guide/using-pnpm.html) for more details.
* Adds a warning if database queries involving relationships
are made before the last `apostrophe:modulesRegistered` handler has fired.
If you need to call Apostrophe's `find()` methods at startup,
it is best to wait for the `@apostrophecms/doc:beforeReplicate` event.
* Allow `@` when a piece is a template and `/@` for page templates (doc-template-library module).
* Adds a `prefix` option to the http frontend util module.
If explicitly set to `false`, prevents the prefix from being automatically added to the URL,
when making calls with already-prefixed URLs for instance.
* Adds the `redirectToFirstLocale` option to the `i18n` module to prevent users from reaching a version of their site that would not match any locale when requesting the site without a locale prefix in the URL.
* If just one instance of a piece type should always exist (per locale if localized), the
`singletonAuto` option may now be set to `true` or to an object with a `slug` option in
order to guarantee it. This implicitly sets `singleton: true` as well. This is now used
internally by `@apostrophecms/global` as well as the optional `@apostrophecms-pro/palette` module.

### Fixes

* Fix 404 error when viewing/editing a doc which draft has a different version of the slug than the published one.
* Fixed a bug where multiple home pages can potentially be inserted into the database if the
default locale is renamed. Introduced the `async apos.doc.bestAposDocId(criteria)` method to
help identify the right `aposDocId` when inserting a document that might exist in
other locales.
* Fixed a bug where singletons like the global doc might not be inserted at all if they
exist under the former name of the default locale and there are no other locales.

## 3.48.0 (2023-05-26)

### Adds

* For performance, add `apos.modules['piece-type']getManagerApiProjection` method to reduce the amount of data returned in the manager
    modal. The projection will contain the fields returned in the method in addition to the existing manager modal
    columns.
* Add `apos.schema.getRelationshipQueryBuilderChoicesProjection` method to set the projection used in
    `apos.schema.relationshipQueryBuilderChoices`.
* Rich-text inline images now copies the `alt` attribute from the original image from the Media Library.

### Changes

* Remove `stripPlaceholderBrs` and `restorePlaceholderBrs` from `AposRichTextWidgetEditor.vue` component.
* Change tiptap `Gapcursor` display to use a vertical blinking cursor instead of an horizontal cursor, which allow users to add text before and after inline images and tables.
* You can set `max-width` on `.apos-rich-text-toolbar__inner` to define the width of the rich-text toolbar. It will now
    flow on multiple lines if needed.
* The `utilityRail` prop of `AposSchema` now defaults to `false`, removing
the need to explicitly pass it in almost all contexts.
* Mark `apos.modules['doc-type']` methods `getAutocompleteTitle`, `getAutocompleteProjection` and `autocomplete` as
    deprecated. Our admin UI does not use them, it uses the `autocomplete('...')` query builder.
    More info at <https://v3.docs.apostrophecms.org/reference/query-builders.html#autocomplete>'.
* Print a warning with a clear explanation if a module's `index.js` file contains
no `module.exports` object (often due to a typo), or it is empty.

### Fixes

* Now errors and exits when a piece-type or widget-type module has a field object with the property `type`. Thanks to [NuktukDev](https://github.com/nuktukdev) for this contribution.
* Add a default page type value to prevent the dropdown from containing an empty value.

## 3.47.0 (2023-05-05)

### Changes

* Since Node 14 and MongoDB 4.2 have reached their own end-of-support dates,
we are **no longer supporting them for A3.** Note that our dependency on
`jsdom` 22 is incompatible with Node 14. Node 16 and Node 18 are both
still supported. However, because Node 16 reaches its
end-of-life date quite soon (September), testing and upgrading directly
to Node 18 is strongly recommended.
* Updated `sluggo` to version 1.0.0.
* Updated `jsdom` to version `22.0.0` to address an installation warning about the `word-wrap` module.

### Fixes

* Fix `extendQueries` to use super pattern for every function in builders and methods (and override properties that are not functions).

## 3.46.0 (2023-05-03)

### Fixes

* Adding or editing a piece no longer immediately refreshes the main content area if a widget editor is open. This prevents interruption of the widget editing process
when working with the `@apostrophecms/ai-helper` module, and also helps in other situations.
* Check that `e.doc` exists when handling `content-changed` event.
* Require updated `uploadfs` version with no dependency warnings.

### Adds

* Allow sub-schema fields (array and object) to follow parent schema fields using the newly introduced `following: '<parentField'` syntax, where the starting `<` indicates the parent level. For example `<parentField` follows a field in the parent level, `<<grandParentField` follows a field in the grandparent level, etc. The change is fully backward compatible with the current syntax for following fields from the same schema level.

### Changes

* Debounce search to prevent calling search on every key stroke in the manager modal.
* Various size and spacing adjustments in the expanded Add Content modal UI

## 3.45.1 (2023-04-28)

### Fixes

* Added missing styles to ensure consistent presentation of the rich text insert menu.
* Fixed a bug in which clicking on an image in the media manager would close the "insert
image" dialog box.
* Update `html-to-text` package to the latest major version.

## 3.45.0 (2023-04-27)

### Adds

* Rich text widgets now support the `insert` option, an array
which currently may contain the strings `image` and `table` in order to add a
convenient "insert menu" that pops up when the slash key is pressed.
This provides a better user experience for rich text features that shouldn't
require that the user select existing text before using them.
* Auto expand inline array width if needed using `width: max-content` in the admin UI.
* The "browse" button is now available when selecting pages and pieces
to link to in the rich text editor.
* The "browse" button is also available when selecting inline images
in the rich text editor.
* Images are now previewed in the relationship field's compact list view.
* The new `apos-refreshing` Apostrophe bus event can be used to prevent
Apostrophe from refreshing the main content zone of the page when images
and pieces are edited, by clearing the `refresh` property of the object
passed to the event.
* To facilitate custom click handlers, an `apos.modal.onTopOf(el1, el2)` function is now
available to check whether an element is considered to be "on top of" another element in
the modal stack.

### Changes

* The `v-click-outside-element` Vue directive now understands that modals "on top of"
an element should be considered to be "inside" the element, e.g. clicks on them
shouldn't close the link dialog etc.

### Fixes

* Fix various issues on conditional fields that were occurring when adding new widgets with default values or selecting a falsy value in a field that has a conditional field relying on it.
Populate new or existing doc instances with default values and add an empty `null` choice to select fields that do not have a default value (required or not) and to the ones configured with dynamic choices.
* Rich text widgets save more reliably when many actions are taken quickly just before save.
* Fix an issue in the `oembed` field where the value was kept in memory after cancelling the widget editor, which resulted in saving the value if the widget was nested and the parent widget was saved.
Also improve the `oembed` field UX by setting the input as `readonly` rather than `disabled` when fetching the video metadata, in order to avoid losing its focus when typing.

## 3.44.0 (2023-04-13)

### Adds

* `checkboxes` fields now support a new `style: 'combobox'` option for a better multiple-select experience when there
are many choices.
* If the new `guestApiAccess` option is set to `true` for a piece type or for `@apostrophecms/page`,
Apostrophe will allow all logged-in users to access the GET-method REST APIs of that
module, not just users with editing privileges, even if `publicApiProjection` is not set.
This is useful when the goal is to allow REST API access to "guest" users who have
project-specific reasons to fetch access content via REST APIs.
* `test-lib/utils.js` has new `createUser` and `loginAs` methods for the convenience of
those writing mocha tests of Apostrophe modules.
* `batchOperations` permissions: if a `permission` property is added to any entry in the `batchOperations` cascade of a piece-type module, this permission will be checked for every user. See `batchOperations` configuration in `modules/@apostrophecms/piece-type/index.js`. The check function `checkBatchOperationsPermissions` can be extended. Please note that this permission is checked only to determine whether to offer the operation.

### Fixes

* Fix child page slug when title is deleted

## 3.43.0 (2023-03-29)

### Adds

* Add the possibility to override the default "Add Item" button label by setting the `itemLabel` option of an `array` field.
* Adds `touch` task for every piece type. This task invokes `update` on each piece, which will execute all of the same event handlers that normally execute when a piece of that type is updated. Example usage: `node app article:touch`.

### Fixes

* Hide the suggestion help from the relationship input list when the user starts typing a search term.
* Hide the suggestion hint from the relationship input list when the user starts typing a search term except when there are no matches to display.
* Disable context menu for related items when their `relationship` field has no sub-[`fields`](https://v3.docs.apostrophecms.org/guide/relationships.html#providing-context-with-fields) configured.
* Logic for checking whether we are running a unit test of an external module under mocha now uses `includes` for a simpler, safer test that should be more cross-platform.

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
* Removes an unimplemented `csrfExceptions` module section cascade. Use the `csrfExceptions` _option_ of any module to set an array of URLs excluded from CSRF protection. More information is forthcoming in the documentation.
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
* `i18next` localization JSON files can be added to the `i18n` subdirectory of _any_ module, as long as its `i18n` option is set. The `i18n` object may specify `ns` to give an `i18next` namespace, otherwise phrases are in the default namespace, used when no namespace is specified with a `:` in an `i18next` call. The default namespace is yours for use at project level. Multiple modules may contribute to the same namespace.
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
* The `attachment` field type now correctly limits file uploads by file type when using the `fileGroup` field option.
* Uploading SVG files is permitted in the Media Library by default.

### Adds

* Apostrophe now enables you to ship frontend JavaScript and Sass (using the SCSS syntax) without your own webpack configuration.
* Any module may contain modern JavaScript in a `ui/src/index.js` file, which may use `import` to bring in other files in the standard way. Note that **`ui/src/index.js must export a function`**. These functions are called for you in the order modules are initialized.
* Any module may contain a Sass (SCSS) stylesheet in a `ui/src/index.scss` file, which may also import other Sass (SCSS) files.
* Any project that requires IE11 support for `ui/src` JavaScript code can enable it by setting the `es5: true` option to the `@apostrophecms/asset` module. Apostrophe produces separate builds for IE11 and modern browsers, so there is no loss of performance in modern browsers. Code is automatically compiled for IE11 using `babel` and missing language features are polyfilled using `core-js` so you can use promises, `async/await` and other standard modern JavaScript features.
* `ui/public` is still available for raw JavaScript and CSS files that should be pushed _as-is_ to the browser. The best use of this feature is to deliver the output of your own custom webpack build, if you have one.
* Adds browser-side `editMode` flag that tracks the state of the current view (edit or preview), located at `window.apos.adminBar.editMode`.
* Support for automatic inline style attribute sanitization for Rich Text widgets.
* Adds text align controls for Rich Text widgets. The following tools are now supported as part of a rich text widget's `toolbar` property:
-- `alignLeft`
-- `alignRight`
-- `alignCenter`
-- `alignJustify`
* `@apostrophecms/express` module now supports the `trustProxy: true` option, allowing your reverse proxy server (such as nginx) to pass on the original hostname, protocol and client IP address.

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

* This backwards compatibility break actually occurred in 3.0.0-beta.3 and was not documented at that time, but it is important to know that the following Rich Text tool names have been updated to match Tiptap2's convention:
-- `bullet_list` -> `bulletList`
-- `ordered_list` -> `orderedList`
-- `code_block` -> `codeBlock`
-- `horizontal_rule` -> `horizontalRule`

### Fixes

* Rich Text default tool names updated, no longer broken. Bug introduced in 3.0.0-beta.3.
* Fixed Rich Text's tool cascade to properly account for core defaults, project level defaults, and area-specific options.

## 3.0.0-beta.3 - 2021-06-03

### Security Fixes

The `nlbr` and `nlp` Nunjucks filters marked their output as safe to preserve the tags that they added, without first escaping their input, creating a CSRF risk. These filters have been updated to escape their input unless it has already been marked safe. No code changes are required to templates whose input to the filter is intended as plaintext, however if you were intentionally leveraging this bug to output unescaped HTML markup you will need to make sure your input is free of CSRF risks and then use the `| safe` filter before the `| nlbr` or `| nlp` filter.

### Adds

* Added the `ignoreUnusedFolderWarning` option for modules that intentionally might not be activated or inherited from in a particular startup.
* Better explanation of how to replace macros with fragments, in particular how to call the fragments with `{% render fragmentName(args) %}`.

### Fixes

* Temporarily pinned to Vue 2.6.12 to fix an issue where the "New" button in the piece manager modals disappeared. We think this is a bug in the newly released Vue 2.6.13 but we are continuing to research it.
* Updated dependencies on `sanitize-html` and `nodemailer` to new major versions, causing no bc breaks at the ApostropheCMS level. This resolved two critical vulnerabilities according to `npm audit`.
* Removed many unused dependencies.
* The data retained for "Undo Publish" no longer causes slug conflicts in certain situations.
* Custom piece types using `localized: false` or `autopublish: true,` as well as singleton types, now display the correct options on the "Save" dropdown.
* The "Save and View," "Publish and View" and/or "Save Draft and Preview" options now appear only if an appropriate piece page actually exists for the piece type.
* Duplicating a widget now properly assigns new IDs to all copied sub-widgets, sub-areas and array items as well.

* Added the `ignoreUnusedFolderWarning` option for modules that intentionally might not be activated or inherited from in a particular startup.
* If you refresh the page while previewing or editing, you will be returned to that same state.

### Notices

* Numerous `npm audit` vulnerability warnings relating to `postcss` 7.x were examined, however it was determined that these are based on the idea of a malicious SASS coder attempting to cause a denial of service. Apostrophe developers would in any case be able to contribute JavaScript as well and so are already expected to be trusted parties. This issue must be resolved upstream in packages including both `stylelint` and `vue-loader` which have considerable work to do before supporting `postcss` 8.x, and in any case public access to write SASS is not part of the attack surface of Apostrophe.

### Changes

* When logging out on a page that only exists in draft form, or a page with access controls, you are redirected to the home page rather than seeing a 404 message.

* Rich text editor upgraded to [tiptap 2.x beta](https://www.tiptap.dev) :tada:. On the surface not a lot has changed with the upgrade, but tiptap 2 has big improvements in terms of speed, composability, and extension support. [See the technical differences of tiptap 1 and 2 here](https://www.tiptap.dev/overview/upgrade-guide#reasons-to-upgrade-to-tiptap-2x)

## 3.0.0-beta.2 - 2021-05-21

### **Breaks**

* The `updateModified: false` option, formerly supported only by `apos.doc.update`, has been renamed to `setModified: false` and is now supported by `apos.doc.insert` as well. If explicitly set to false, the insert and update methods will leave the `modified` property alone, rather than trying to detect or infer whether a change has been made to the draft relative to the published version.
* The `permission` module no longer takes an `interestingTypes` option. Instead, doc type managers may set their `showPermissions` option to `true` to always be broken out separately in the permissions explorer, or explicitly set it to `false` to never be mentioned at all, even on a list of typical piece types that have the same permissions. This allows module creators to ship the right options with their modules rather than requiring the developer to hand-configure `interestingTypes`.
* When editing users, the permissions explorer no longer lists "submitted draft" as a piece type.
* Removed `apos.adminBar.group` method, which is unlikely to be needed in 3.x. One can group admin bar items into dropdowns via the `groups` option.
* Raw HTML is no longer permitted in an `apos.notify` message parameter. Instead, `options.buttons` is available. If present, it must be an array of objects with `type` and `label` properties. If `type` is `'event'` then that button object must have `name` and `data` properties, and when clicked the button will trigger an apos bus event of the given `name` with the provided `data` object. Currently `'event'` is the only supported value for `type`.

### Adds

* The name `@apostrophecms/any-page-type` is now accepted for relationships that should match any page. With this change, the doc type manager module name and the type name are now identical for all types in 3.x. However, for backwards compatibility `@apostrophecms/page` is still accepted. `apos.doc.getManager` will accept either name.
* Sets the project root-level `views` directory as the default fallback views directory. This is no longer a necessary configuration in projects unless they want to change it on the `@apostrophecms/template` option `viewsFolderFallback`.
* The new `afterAposScripts` nunjucks block allows for pushing markup after Apostrophe's asset bundle script tag, at the end of the body. This is a useful way to add a script tag for Webpack's hot reload capabilities in development while still ensuring that Apostrophe's utility methods are available first, like they are in production.
* An `uploadfs` option may be passed to the `@apostrophecms/asset` module, in order to pass options configuring a separate instance of `uploadfs` specifically for the static assets. The `@apostrophecms/uploadfs` module now exports a method to instantiate an uploadfs instance. The default behavior, in which user-uploaded attachments and static assets share a single instance of uploadfs, is unchanged. Note that asset builds never use uploadfs unless `APOS_UPLOADFS_ASSETS=1` is set in the environment.
* `AposButtonSplit` is a new UI component that combines a button with a context menu. Users can act on a primary action or change the button's function via menu button to the right of the button itself.
* Developers can now pass options to the `color` schema field by passing a `pickerOptions` object through your field. This allows for modifying/removing the default color palette, changing the resulting color format, and disabling various UI. For full set of options [see this example](https://github.com/xiaokaike/vue-color/blob/master/src/components/Sketch.vue)
* `AposModal` now emits a `ready` event when it is fully painted and can be interacted with by users or code.
* The video widget is now compatible with vimeo private videos when the domain is on the allowlist in vimeo.

### Changes

* You can now override the parked page definition for the home page without copying the entirety of `minimumPark` from the source code. Specifically, you will not lose the root archive page if you park the home page without explicitly parking the archive page as well. This makes it easier to choose your own type for the home page, in lieu of `@apostrophecms/home-page`.

### Fixes

* Piece types like users that have a slug prefix no longer trigger a false positive as being "modified" when you first click the "New" button.
* The `name` option to widget modules, which never worked in 3.x, has been officially removed. The name of the widget type is always the name of the module, with the `-widget` suffix removed.
* The home page and other parked pages should not immediately show as "pending changes."
* In-context editing works properly when the current browser URL has a hash (portion beginning with `#`), enabling the use of the hash for project-specific work. Thanks to [https://stepanjakl.com/](Štěpán Jákl) for reporting the issue.
* When present, the `apos.http.addQueryToUrl` method preserves the hash of the URL intact.
* The home page and other parked pages should not immediately show as "pending changes."
* The browser-side `apos.http.parseQuery` function now handles objects and arrays properly again.
* The in-context menu for documents has been refactored as a smart component that carries out actions on its own, eliminating a great deal of redundant code, props and events.
* Added additional retries when binding to the port in a dev environment.
* The "Submit" button in the admin bar updates properly to "Submitted" if the submission happens in the page settings modal.
* Skipping positional arguments in fragments now works as expected.
* The rich text editor now supports specifying a `styles` array with no `p` tags properly. A newly added rich text widget initially contains an element with the first style, rather than always a paragraph. If no styles are configured, a `p` tag is assumed. Thanks to Stepan Jakl for reporting the issue.

### Changes

* Editor modal's Save button (publish / save draft / submit) now updated to use the `AposSplitButton` component. Editors can choose from several follow-up actions that occur after save, including creating another piece of content of the same type, being taken to the in-context version of the document, or being returned to the manager. Editor's selection is saved in localstorage, creating a remembered preference per content type.

## 3.0.0-beta.1.1 - 2021-05-07

### Fixes

* A hotfix for an issue spotted in beta 1 in our demo: all previously published pages of sites migrated from early alpha releases had a "Draft" label until published again.

## 3.0.0-beta.1 - 2021-05-06

### **Breaks**

* Removes the `firstName` and `lastName` fields in user pieces.
* The query parameters `apos-refresh`, `apos-edit`, `apos-mode` and `apos-locale` are now `aposRefresh`, `aposEdit`, `aposMode`and `aposLocale`. Going forward all query parameters will be camelCase for consistency with query builders.

### Changes

* Archiving a page or piece deletes any outstanding draft in favor of archiving the last published version. Previously the behavior was effectively the opposite.
* "Publish Changes" button label has been changes to "Update".
* Draft mode is no longer the default view for published documents.
* The page and piece manager views now display the title, etc. of the published version of a document, unless that document only exists in draft form. However a label is also provided indicating if a newer draft is in progress.
* Notifications have been updated with a new visual display and animation style.

### **Adds**

* Four permissions roles are supported and enforced: guest, contributor, editor and admin. See the documentation for details. Pre-existing alpha users are automatically migrated to the admin role.
* Documents in managers now have context sensitive action menus that allow actions like edit, discard draft, archive, restore, etc.
* A fragment call may now have a body using `rendercall`, just like a macro call can have a body using `call`. In addition, fragments can now have named arguments, just like macros. Many thanks to Miro Yovchev for contributing this implementation.
* Major performance improvement to the `nestedModuleSubdirs` option.
* Updates URL fields and oEmbed URL requests to use the `httpsFix` option in launder's `url()` method.
* Documents receive a state label based on their document state (draft, pending, pending updates)
* Contributors can submit drafts for review ("Submit" versus "Submit Updates").
* Editors and admins can manage submitted drafts.
* Editors and admins can easily see the number of proposed changes awaiting their attention.
* Support for virtual piece types, such as submitted drafts, which in actuality manage more than one type of doc.
* Confirm modals now support a schema which can be assessed after confirmation.
* When archiving and restoring pages, editors can chose whether the action affects only this document or this document + children
* Routes support the `before` syntax, allowing routes that are added to Express prior to the routes or middleware of another module. The syntax `before: 'middleware:moduleName'` must be used to add the route prior to the middleware of `moduleName`. If `middleware:` is not used, the route is added before the routes of `moduleName`. Note that normally all middleware is added before all routes.
* A `url` property can now optionally be specified when adding middleware. By default all middleware is global.
* The pieces REST GET API now supports returning only a count of all matching pieces, using the `?count=1` query parameter.
* Admin bar menu items can now specify a custom Vue component to be used in place of `AposButton`.
* Sets `username` fields to follow the user `title` field to remove an extra step in user creation.
* Adds default data to the `outerLayoutBase.html` `<title>` tag: `data.piece.title or data.page.title`.
* Moves the core UI build task into the start up process. The UI build runs automatically when `NODE_ENV` is _not_ 'production' and when:
    1. The build folder does not yet exist.
    2. The package.json file is newer than the existing UI build.
    3. You explicitly tell it to by setting the environment variable `CORE_DEV=1`
* The new `._ids(_idOrArrayOfIds)` query builder replaces `explicitOrder` and accepts an array of document `_id`s or a single one. `_id` can be used as a multivalued query parameter. Documents are returned in the order you specify, and just like with single-document REST GET requests, the locale of the `_id`s is overridden by the `aposMode` query parameter if present.
* The `.withPublished(true)` query builder adds a `_publishedDoc` property to each returned draft document that has a published equivalent. `withPublished=1` can be used as a query parameter. Note this is not the way to fetch only published documents. For that, use `.locale('en:published')` or similar.
* The server-side implementation of `apos.http.post` now supports passing a `FormData` object created with the `[form-data](https://www.npmjs.com/package/form-data)` npm module. This keeps the API parallel with the browser-side implementation and allows for unit testing the attachments feature, as well as uploading files to internal and external APIs from the server.
* `manuallyPublished` computed property moved to the `AposPublishMixin` for the use cases where that mixin is otherwise warranted.
* `columns` specified for a piece type's manage view can have a name that uses "dot notation" to access a subproperty. Also, for types that are localized, the column name can begin with `draft:` or `published:` to specifically display a property of the draft or published version of the document rather than the best available. When a prefix is not used, the property comes from the published version of the document if available, otherwise from the draft.
* For page queries, the `children` query builder is now supported in query strings, including the `depth` subproperty. For instance you could fetch `/api/v1/@apostrophecms/page/id-of-page?children=1` or `/api/v1/@apostrophecms/page/id-of-page?children[depth]=3`.
* Setting `APOS_LOG_ALL_QUERIES=1` now logs the projection, skip, limit and sort in addition to the criteria, which were previously logged.

### **Fixes**

* Fragments can now call other fragments, both those declared in the same file and those imported, just like macros calling other macros. Thanks to Miro Yovchev for reporting the issue.
* There was a bug that allowed parked properties, such as the slug of the home page, to be edited. Note that if you don't want a property of a parked page to be locked down forever you can use the `_defaults` feature of parked pages.
* A required field error no longer appears immediately when you first start creating a user.
* Vue warning in the pieces manager due to use of value rather than name of column as a Vue key. Thanks to Miro Yovchev for spotting the issue.
* "Save Draft" is not an appropriate operation to offer when editing users.
* Pager links no longer break due to `aposRefresh=1` when in edit mode. Also removed superfluous `append` query parameter from these.
* You may now intentionally clear the username and slug fields in preparation to type a new value. They do not instantly repopulate based on the title field when you clear them.
* Language of buttons, labels, filters, and other UI updated and normalized throughout.
* A contributor who enters the page tree dialog box, opens the editor, and selects "delete draft" from within the editor of an individual page now sees the page tree reflect that change right away.
* The page manager listens for content change events in general and its refresh mechanism is robust in possible situations where both an explicit refresh call and a content change event occur.
* Automatically retries once if unable to bind to the port in a dev environment. This helps with occasional `EADDRINUSE` errors during nodemon restarts.
* Update the current page's context bar properly when appropriate after actions such as "Discard Draft."
* The main archive page cannot be restored, etc. via the context menu in the page tree.
* The context menu and "Preview Draft" are both disabled while errors are present in the editor dialog box.
* "Duplicate" should lead to a "Publish" button, not an "Update" button, "Submit" rather than "Submit Update," etc.
* When you "Duplicate" the home page you should be able to set a slug for the new page (parked properties of parked pages should be editable when making a duplicate).
* When duplicating the home page, the suggested slug should not be `/` as only one page can have that slug at a time.
* Attention is properly called to a slug conflict if it exists immediately when the document is opened (such as making a copy where the suggested slug has already been used for another copy).
* "Preview Draft" never appears for types that do not use drafts.
* The toggle state of admin bar utility items should only be mapped to an `is-active` class if, like palette, they opt in with `toggle: true`
* Fixed unique key errors in the migrate task by moving the parking of parked pages to a new `@apostrophecms/migrate:after` event handler, which runs only after migrations, whether that is at startup (in dev) or at the end of the migration task (in production).
* UI does not offer "Archive" for the home page, or other archived pages.
* Notification checks and other polling requests now occur only when the tab is in the foreground, resolving a number of problems that masqueraded as other bugs when the browser hit its connection limit for multiple tabs on the same site.
* Parked pages are now parked immediately after database migrations are checked and/or run. In dev this still happens at each startup. In production this happens when the database is brand new and when the migration task is manually run.

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
