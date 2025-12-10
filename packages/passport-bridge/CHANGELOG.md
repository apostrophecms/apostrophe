# Changelog

## 1.6.0 (2025-10-30)

### Adds

* Uses core login `normalizeLoginName` method to lowercase username and email in case project login option `caseInsensitive` is set to true.

## 1.5.2 (2025-08-27)

* Fixed regression introduced in 1.5.0-beta.1 that made it more difficult to see the logs regarding certain types of login failures and account creation issues. This issue was particularly likely to occur with strategies that do not supply `req`.
* Works correctly out of the box when only `email` is available in the profile, e.g. when the user's full name or username is not available, as can happen when an idP is configured to provide an absolute minimum of information.

## 1.5.1 (2025-08-06)

* README changes only.

## 1.5.0 (2025-07-09)

* See 1.5.0-beta.1, below. Those changes are now official in 1.5.0.

## 1.5.0-beta.1 (2025-07-03)

### Adds

* The new `factory` option allows developers to pass an async function that returns a fully initialized passport strategy object. This allows developers to solve many exactly problems as they see fit, in one single place: taking care of discovery before initialization, initializing strategies that won't accept a plain object of parameters, remapping `verify` parameters, and remapping profile properties.
* Structured logging has been added, helping to debug in many situations. The debug log level is used, so by default it won't clutter the logs in production.
* Logic intended to automatically refresh access tokens is no longer invoked for non-oauth strategies that can't support it.

## 1.4.0 (2025-04-16)

### Adds

* Adds strategy option `verify`. `verify` is a function that accepts `findOrCreateUser` and returns a function
The default `findOrCreateUser` method returns a function that accepts 5 parameters `req` plus `accessToken`, `refreshToken`, `profile` and `callback`.
This is the default for some strategies like `passport-oauth2`, `passport-github2` and `passport-gitlab2`.
If the passport strategy you're using have a different set of parameters outside of `req` (for example `passport-auth0`), please use the `verify` options.
More info at [Customizing call to the strategy verify method](/#customizing-call-to-the-strategy-verify-method)
* Add `self.specs` with the computed strategies options.

### Fixes

* Fix infinite loop issue with `findOrCreateUser` without `req` parameter.
* Fixed ESM support by removing `self.apos.root.import` usage.

### Changes

* Bumbs `eslint-config-apostrophe` to `5`, fixes errors, removes unused dependencies.

## 1.3.0 (2024-10-31)

* Use `self.apos.root.import` instead of `self.apos.root.require`.
* `enablePassportStrategies` is now async.

## 1.2.1 (2024-10-03)

* Adds translation strings.

## 1.2.0 - 2023-06-08

* Support for making "connections" to secondary accounts. For instance, a user whose primary account login method is email can connect
their account to a github account when the appropriate features are active as described in the documentation.
* Accept `scope` either as an `option` of the strategy, or as an `authenticate` property for the strategy, and
pass it on to the strategy in both ways, as well as to both the login and callback routes. This allows `passport-github2`
to capture the user's private email address correctly, and should help with other differences between strategies as well.
* Back to using upstream `passport-oauth2-refresh` now that our PR has been accepted (thanks).

## 1.2.0-alpha.4 - 2023-04-07

* More dependency games.

## 1.2.0-alpha.3 - 2023-04-07

* Depend on a compatible temporary fork of `passport-oauth2-refresh`.

## 1.2.0-alpha.2 - 2023-04-07

* Introduced the new `retainAccessToken` option, which retains tokens in Apostrophe's
"safe" where they can be used for longer than a single Apostrophe session. Please note
that `retainAccessTokenInSession` is now deprecated, as it cannot work with Passport 0.6
as found in current Apostrophe 3.x due to upstream changes. See the README for
more information about the new approach. You only need this option if you want to
call additional APIs of the provider, for instance github APIs for those using
`passport-github`.
* Introduced convenience methods to use the access token in such a way that it is
automatically refreshed if necessary.

## 1.1.1 - 2023-02-14

* Corrected a bug that prevented `retainAccessTokenInSession` from working properly. Note that this option can only work with Passport strategies that honor the `passReqToCallback: true` option (passed for you automatically). Strategies derived from `passport-oauth2`, such as `passport-github` and many others, support this and others may as well.

## 1.1.0 - 2023-02-01

Setting the `retainAccessTokenInSession` option to `true` retains the `accessToken` and `refreshToken` provided by passport in `req.session.accessToken` and `req.session.refreshToken`. Depending on your oauth authentication scope, this makes it possible to carry out API calls on the user's behalf when authenticating with github, gmail, etc. If you need to refresh the access token, you might try the [passport-oauth2-refresh](https://www.npmjs.com/package/passport-oauth2-refresh) module.

## 1.0.0 - 2023-01-16

Declared stable. No code changes.

## 1.0.0-beta - 2022-01-06

Initial release for A3. Tested and working with Google and Okta. Other standard passport modules should also work, especially those based on OpenAuth.
