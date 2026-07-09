---
"@apostrophecms/emulate-mongo-3-driver": patch
---

Patching the `mongodb-legacy` classes is now idempotent. When two copies of this package are loaded against the same `mongodb-legacy` instance (for example, a version or source skew between a direct and a transitive dependency), the second copy no longer throws `TypeError: Cannot redefine property: Symbol(@@mdb.callbacks.toEmulate)`. The emulation method is defined only once and is now `configurable`, so any mix of patched and unpatched copies can load in either order without error.
