# Changelog

## 1.0.3 (2026-09-30)

### Changes

- Corrected README code examples that would not run as written: a `const` declaration using `:` instead of `=`, two missing commas between object properties, a stray line above an unrelated example, and a pagination example referencing an undestructured variable and comparing a page object to a page number. Also fixed a misplaced backtick in the import-export format documentation.
- Corrected typos and grammar in the README documentation.
- Broken links in the README and `package.json` of these packages, as surfaced by their pages on the ApostropheCMS extensions site, are corrected. The license badges pointed at the retired standalone repositories, and in the case of `@apostrophecms/redirect` and `@apostrophecms/form-submission-google` at the Blog module's license rather than their own; "Give us a star on GitHub!" pointed at the archived `apostrophecms/form` and `apostrophecms/anchors` repositories; and `@apostrophecms/import-export` linked `@apostrophecms/import-export-xlsx` to its archived repository. All now resolve within the monorepo. The `@apostrophecms/form` README also linked `@apostrophecms-pro/advanced-permission` to a private repository, which 404s for anyone without access; it now links to the public extension page.

  In `package.json`, `@apostrophecms/favicon` had its `repository.directory` misspelled as `packages/favison` and `@apostrophecms/import-export` had `packages/` missing from its `homepage`. `@apostrophecms/favicon`, `@apostrophecms/anchors` and `@apostrophecms/form-submission-google` were each missing a `bugs` field, so tools that need one derived it from `homepage` and produced an unusable URL. No code changes.

## 1.0.2 (2024-10-03)

- Edits README and package description. No code changes.
- Adds translation strings

## 1.0.1 - 2023-03-06

* Removes `apostrophe` as a peer dependency.

## 1.0.0 - 2022-01-21

* Initial release.
