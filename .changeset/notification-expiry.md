---
"apostrophe": patch
---

Notifications now expire at the database level, rather than lingering forever when nothing dismisses them and being re-sent on every admin page load. The lifetime is set by the new `expireAfter` option of the `@apostrophecms/notification` module, in seconds, defaulting to `86400` (one day); set it to `0` for the previous behavior. A one-time `notification-expire` migration clears the existing backlog. Also fixed `apos.notification.dismiss()` creating a stray database document when the notification it names is already gone.
