---
"apostrophe": minor
---

Added the `direction` option to `@apostrophecms/login` (`ltr` or `rtl`) to force the text direction of the login page and the pages related to it (password reset, additional login requirements) regardless of the direction of the current locale; unset, the login page keeps following the locale. Projects that override `TheAposLogin.vue` keep the `<html dir>` fix but lose the root direction class; projects that override `login.html` without extending `data.outerLayout` must set the `dir` attribute themselves.
