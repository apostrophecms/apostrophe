# Changelog

## 3.5.2

### Adds

- Support for testing with or without pro modules available (without, by default)

## 3.5.1

### Fixes

- Fixes possible infinite loop when getting related types by storing processed widgets.

## 3.5.0 (2025-11-25)

### Adds

- Adds failed export batch notifications.

## 3.4.0 (2025-10-30)

### Changes

- Save import files in uploadfs. Import-export now works on projects using multiple node servers.

## 3.3.1 (2025-09-03)

### Fixes

- CSV imports should not require a `type` column when importing pieces.
- Removed unused `connect-multiparty` middleware, eliminating superfluous warnings.

## 3.3.0 (2025-08-06)

### Adds

- Adds a checkbox to select and deselect all related document types in the export modal.

## 3.2.1 (2025-05-14)

### Fixes

- Fixes the missing failed imports report modal when cancelling the import during override duplicates phase.
- Compatible with `apostrophe` version 4.17.0 and up. Do not use 4.16.0, which was briefly incompatible with this module.
  This version correctly handles inserts of documents before their related images in the context of the latest `apostrophe` release.

## 3.2.0 (2025-04-16)

### Adds

- Adds support for translating content while importing via the Automatic Translation module (when available).
- Allow page position to be adapted when importing based on slug hierarchy.

### Fixes

- Fix "include related documents" modal height.
- Fixes `moduleLabel` computed.
- Fixes missing call to `recomputeAllDocReferences` when duplicated have been overridden.

### Changes

- Bumbs `eslint-config-apostrophe` to `5`, fixes errors, removes unused dependencies.
- Exports attachments by default, without treating them like related documents.

## 3.1.0 (2025-03-19)

### Adds

- Add error reporting UI (modal) for failed imports.

### Fixes

- Better english wording when import succeeds.
- Adds missing information to export and import batch operation jobs.

## 3.0.0 (2025-02-19)

### Changes

- **Major version change:** 3.0.0 because this release is compatible only with ApostropheCMS 4.x. If you have not upgraded to ApostropheCMS 4.x, [you should do so.](https://docs.apostrophecms.org/guide/migration/upgrading-3-to-4.html#how-to-upgrade-your-project). For your ApostropheCMS 4.x project, make sure you change the dependency in `package.json` to `^3.0.0` to get this version.
- Hide the `importDraftsOnly` checkbox for autopublished documents.

### Adds

- Adds a method to sort all exported documents, makes sure that parent pages come always first.
- Uses the new big-upload feature of apostrophe to allow very large export files to be imported.
- Handles progress notification when uploading document (before running the actual import).

## 2.6.0 (2025-01-27)

### Adds

- Pages linked a page via the "Internal Page" option in the rich text editor are now candidates to be exported as related documents.
- Images embedded inline in rich text widgets via the `insert: [ 'image' ]` option are now candidates to be exported as related documents.
- Uses `moduleLabels` prop when available.

### Fixes

- Fixes Export modal related types slide animation. Uses `checkedTypes` when passed from parent component.

## 2.5.0 (2024-11-08)

### Adds

- Adds a checkbox to the import modal that, when selected, imports published versions of documents from an export file **as drafts**. If a document doesn’t have a published version, it will still be imported. Setting the `importDraftsOnlyDefault: true` option selects this checkbox by default.

## 2.4.2 (2024-10-31)

### Adds

- Adds AI-generated missing translations.

## 2.4.1 (2024-10-03)

### Fixes

- Fixes SASS warnings.
- Fixes a bug where related documents were not exported if they were only in one (draft or published) mode.
- Fixes a bug where additional crops of an image were not imported properly when the image was already present on the receiving site.
- Clean up timers on instance destroy.

## Changes

- Update devDependencies.

## 2.4.0 (2024-09-05)

### Adds

- Singletons can now be imported through `contextOperations` since they have no manager modal and thus no `utilityOperation` available.
- Pages can be exported via an Export batch operation.

### Fixes

- Exported related documents now contain the entire document and not only the projected fields.
- The `related` route also returns the related types of the exported documents related documents.
- Greatly improved performance when imports involve attachments that already exist on the target site.
- Cropped images are imported properly.
- Page tree relationships are maintained.
- In general: many fixes to bring this module up to speed for use cases that involve selecting multiple documents.

## 2.3.0 (2024-08-08)

### Adds

- Add a scrollbar to the duplicate import modal to handle too many duplicates, and fixed the "Type" column to display the correct document type. Thanks to (Borel Kuomo)(<https://github.com/borelkoumo>) for this contribution.

### Fixes

- Adds a method `checkDuplicates` to pre check for duplicates before importing, allows to insert attachments before documents to avoid them being stripped.
- Uses the new method `simulateRelationshipsFromStorage` from core to simulate relationships on data from DB to be able to pass the convert,
  also uses the new option `fetchRelationships: false` on the convert to avoid fetching relationships from the DB.
  It prevents issues when a relationship has not been inserted yet.
- Requires a duplicate confirmation for existing singleton documents (including parked pages), keeping their original ID's while importing (if the user chooses to do so).

## 2.2.0 (2024-07-12)

### Adds

- Adds a `preventUpdateAssets` to the module that will not try to update already existing assets on import.

## 2.1.1 (2024-06-21)

### Fixes

- Fix export relationship when an area has grouped widgets. Thanks to Michelin for contributing this fix.

## 2.1.0 (2024-06-12)

### Adds

- Add the possibility to set a **key column** in your import CSV file in order to update existing pieces and pages.  
  Thanks to this, this module reaches parity with the deprecated [`@apostrophecms/piece-type-importer`](https://github.com/apostrophecms/piece-type-importer) module.

### Fixes

- We can now import pieces or pages with an import file that contains just the required fields.

## 2.0.0 (2024-05-15)

### Changes

- Corrects documentation of required permissions.

### Adds

- Add CSV format.

### Breaking changes

- This is a new major version, 2.0.0. To update to this version you must edit your `package.json` file and change the dependency to `^2.0.0` or similar.
- The signature of the `output` function from the gzip format has changed. It no longer takes the `apos` instance and now requires a `processAttachments` callback.
- `import` and `overrideDuplicates` functions now require `formatLabel` to be passed in `req`.

## 1.4.1 (2024-03-20)

### Changes

- Documentation updates.

### Fixes

- Fixes imported data with the wrong mode because `req.mode` was always `published`, even for draft documents.

## 1.4.0 (2024-03-12)

### Changes

- Compatible with both Apostrophe 3.x and Apostrophe 4.x (both Vue 2 and Vue 3).

### Fixes

- Bug fix. When a piece or a page is created, published, then unpublished, and subsequently exported and re-imported, the manager modal incorrectly showed no published version. This occurs because the `lastPublishedAt` property of the draft document was set to null upon import, misleading the representation of the document's published state. Now it retains the original document's `lastPublishedAt` value.

## 1.3.0 (2024-02-21)

### Changes

- Requires the create and edit permissions to use the import utility operation

## 1.2.1 (2024-01-24)

### Security

- Fixed a security issue that allowed a correctly crafted
  HTTP request to delete arbitrary files and folders, subject to the permissions with which the Node.js
  process was run. No user account was required to exploit this issue. All users of this module should immediately run `npm update @apostrophecms/import-export` and deploy the latest version of this module. The module has been carefully audited for similar issues and best practices have been put in place to prevent any similar issue in future.

### Changes

- Prefix routes and events to avoid conflicts with the old [`@apostrophecms/piece-type-importer`](https://github.com/apostrophecms/piece-type-importer) and [`@apostrophecms/piece-type-exporter`](https://github.com/apostrophecms/piece-type-exporter) modules.

## 1.2.0 (2023-11-29)

### Adds

- Import now detects if the locale found in the exported docs is different from the current site one.
  If the site has only one locale configured, then the docs are automatically re-written with the site locale.
  If the site has multiple locales configured, the user is given the possibility to abort the import or re-write the docs with the site locale.  
  Please note that this change is dependent on core changes found in 3.60.0.

### Changes

- Hide "Duplicates Detected." notification.

## 1.1.0 (2023-11-03)

### Adds

- Display more information about duplicated documents.
- Export file name more meaningful, containing project name, module name and current date and time.

### Fixes

- Fix progress bar going over `100%` when importing docs that are archived after being exported.
- Adds missing dependency.

## 1.0.2 (2023-10-13)

### Fixes

- Use `uploadfs.copyOut` to ensure success in more attachment export situations, such as debugging a multisite Assembly project
  on a local machine where Chrome considers subdomains of `localhost` to be your machine but Node.js does not.
- Minor refactoring for maintainability and performance.
- Error and warning notifications stay in place until dismissed.

## 1.0.1 (2023-10-12)

### Fixes

Move documentation images to our own hosting.

## 1.0.0 (2023-10-12)

### Adds

Initial release.
