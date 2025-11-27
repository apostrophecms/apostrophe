# Changelog

## 1.5.0 (2025-11-25)

* Support for wildcards. See the README for more information.

## 1.4.3 (2025-09-03)

* Bug fix: UTF8 URLs now match properly. For instance, redirects containing Thai characters work as expected. Editors can paste them naturally (without hand-escaping them first) and the redirect module will correctly decode the URL received from Express before attempting to match it to a redirect.

## 1.4.2 (2024-10-03)

* Updates translations strings

## 1.4.1 (2024-03-20)

* Bug fix to properly migrate older redirects missing a `targetLocale` property, and to tolerate situations where this property is irrelevant or makes reference to a locale that no longer exists in the system.
* Fixes permanent redirects (301) being 302 because `statusCode` of the redirects were never fetched.
* README and package description updated.

## 1.4.0 (2024-02-23)

Several fixes and improvements contributed by Stéphane Maccari of Michelin:

* Add a way to modify the target url before doing the redirection
* Irrelevant SEO fields are properly removed from redirect pieces
* The `ignoreQueryString` field is honored properly
* Redirects to internal pages are saved properly
* Admins adding redirects may now elect to pass on the query string as part of the redirect
* `before` option added, giving the option of running the middleware earlier, e.g. before `@apostrophecms/global`
* Performance enhancement: skip the redirect check for API URLs like `/api/v1/...`. This can be
overridden using the `skip` option

Many thanks for this contribution.

## 1.3.0 (2023-11-03)

- Adds possibility to redirect from a locale to another one using internal redirects.

## 1.2.3

- Fixes redirections when using locale prefixes.

## 1.2.2 (2023-03-06)

- Removes `apostrophe` as a peer dependency.

## 1.2.1 (2023-02-01)

- Any exceptions thrown in the middleware are caught properly, avoiding a process restart.

## 1.2.0 (2021-12-22)

- Adds `noMatch` event for implementing fallbacks, and also documents how to preempt this module if desired.

## 1.1.0 (2021-10-28)

- Adds English (`en`) locale strings for static text.
- Adds Spanish (`es`) localization to static text. Thanks to [Eugenio Gonzalez](https://github.com/egonzalezg9) for the contribution.
- Adds Slovak (`sk`) locale strings for static text. Thanks to [Michael Huna](https://github.com/Miselrkba) for the contribution.


## 1.0.1 (2021-08-26)

- Localization is inappropriate for redirects since it's necessary to be able to redirect from any URL. Previously `autopublish: true` was used by the module, but `localize: false` is more appropriate as it eliminates multiple locale versions altogether. A migration has been added to take care of existing redirects in this transition.
- Fixes README code examples for the `withType` and `statusCode` options.

## 1.0.0
- Initial port from Apostrophe 2.0
