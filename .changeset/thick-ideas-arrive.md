---
"apostrophe": minor
---

Fixed the tag popover in the media library (used to apply tags to images in bulk) so it loads all image tags instead of only the first 50. Tags beyond the first 50 can now be found and applied, and creating a tag whose name already exists no longer produces a duplicate. The number of tags loaded into the popover is configurable via the new `tagPickerPerPage` option on the `@apostrophecms/image` module (default `400`).
