---
"@apostrophecms/passport-bridge": minor
---

Login through a strategy now returns the user to where they were going. The login route takes a `returnTo` query parameter, as the login page does, and only a path on the site is accepted. Login links on a login page that was given `returnTo` pass it along. This brings users back to the OAuth approval page after they log in.

On a site with the regular login page turned off (`localLogin: false`), `apos.login.getLoginUrl()` now returns where login moved to: the `loginUrl` option of `@apostrophecms/login` if set, otherwise the login route of the only strategy. With several strategies and no `loginUrl` it still returns `null`.

Fixes switching locale at login, which was lost because Passport starts a new session when the user logs in.
