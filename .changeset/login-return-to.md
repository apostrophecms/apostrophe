---
"apostrophe": minor
---

The login page accepts a `returnTo` query parameter: after logging in, the user is sent to that path instead of the home page. Only a path on this site is accepted; anything that could lead off the site is ignored. A user who is already logged in is sent there directly. The project name and environment label shown in the login page's header are now available to other pages through `apos.login.getProjectHeader()`. Override `getProjectHeader()` to change the name or label on both the login page and the OAuth pages.
