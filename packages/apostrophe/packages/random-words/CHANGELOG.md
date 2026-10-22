# Changelog

## 2.0.1 (2024-01-25)

- Fixed return type of `generate` so that it is consistent with the possibility of returning either `string` or `string[]`

## 2.0.0 - 2023-06-08

This is a significant update that transforms this module into an ECMAScript module and changes the name of the exported function. For that reason, we have updated the major version number.

- Converted default export to named export (`generate`) to generate random words.
- Adds `count` named export to count number of words.
- Thanks to [prateek-budhiraja](https://github.com/prateek-budhiraja) for these updates.
- Addition of `minLength` option.
- Code update to ES6 Syntax.
- Thanks to [Nellfs](https://github.com/nellfs) for these updates.

## 1.3.0 - 2023-02-17

- Adds new `seed` option. Thanks to [Nathan Klingensmith](https://github.com/IamParadoxdotexe).

## 1.2.1 - 2023-01-06

- Fixes misspelling of `separator` in typings. Thanks to Andrei Gec for the correction.

## 1.2.0 - 2022-06-16

- Adds typescript typings. Thanks to Tim Kennedy for this contribution.

## 1.1.2 - 2022-01-20

- Updates mocha to v9.

## 1.1.1

- Use `var` in a small amount of newer code that used `let`, to match ES5 legacy support status of the rest of the module. We should probably decide on a strategy for moving this module to ES6, but there is no urgency.

## 1.1.0

- Addition of `wordsPerString`, `separator` and `format` options. Thanks to Matteo Veraldi.

## 1.0.0

- Addition of `maxLength` option, thanks to Scoombe.

- Since this module has achieved considerable use, has good test coverage and has had no bug reports, we've declared version 1.0.0 stable. We will follow the semver standard from here on out.

## 0.0.1

Initial release.
