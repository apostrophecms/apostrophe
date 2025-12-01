# Changelog

## 1.0.5 (2024-09-05)

### Adds

* Add AI and community-reviewed translation strings.

## 1.0.4 (2024-03-20)

### Fixes

* Use manager in test to insert pages
* Update dependencies

## 1.0.3 2022-09-15

### Fixes

* Add missing `permission.type` in schema fields. `@apostrophecms/scheduled-publising` fields were missing on all pieces and pages when the module was used with `@apostrophecms-pro/advanced-permission` enabled.

## 1.0.2

### Fixes

* Documentation oversight re: the necessary command line task.

## 1.0.1

### Fixes

* Clarifies module is public, with an MIT license.
* Module npm organization name changed to match.

## 1.0.0

### Adds

* Command line task to update all documents that have a publishing or unpublishing date by comparing with the current one.
* Since the Home page cannot be unpublished, it's not possible to schedule unpublishing for this specific page.
