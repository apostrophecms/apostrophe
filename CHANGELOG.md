# Changelog

## 2.0.3

The `ancestors` and `children` filters defaulted to `areas(false)`, but `joins(false)` was omitted, contrary to documentation which has always indicated the information returned is limited for performance. This was fixed. You can still override freely with the `filters` option to `apostrophe-pages`.

## 2.0.2

Previously the `contextual` flag of a pieces module was not considered before deciding to redirect to the "show page" for the piece, which might not exist. This has been fixed. It should only happen when the module has `contextual: true`, creating a reasonable expectation that such a page must exist.

## 2.0.1

Packaging and documentation issues only.

## 2.0.0

Inaugural npm release of Apostrophe 2.x, which was used prior to that in many projects via git dependencies.



