Unit tests passing.

Regression tests passing.

* `getSchemaOptions` method no longer throws inappropriate errors when the alternate form of `apos.area` or `apos.singleton` is used. Bug introduced in 2.89.0.
* The CSRF cookie is once again always reset on each request, to ensure no discrepancy between the session (and session cookie) lifespan and the CSRF cookie lifespan. This does not force sessions to exist unnecessarily, it just ensures CSRF errors do not mysteriously begin to appear in long-idle sessions, or when making cross-domain locale switches via the editing interface in apostrophe-workflow.
* Edits to raw .css files once again trigger less-middleware to recognize a change has occurred and avoid sending a stale cached file in development. When `.css` (rather than `.less`) assets are pushed inline, which is necessary to match the behavior we formerly received from clean-css and avoid crashes on CSS that the LESS parser cannot handle, we now monitor them for changes ourselves and "touch" the master LESS file to help the `less-middleware` module figure out that they have been changed.

Thanks to Michelin for making this work possible via [Apostrophe Enterprise Support](https://apostrophecms.org/support/enterprise-support). Your organization can also take advantage of the opportunity to fund development of the features you would like to see as well as receiving fast, personal support from Apostrophe's core development team.
