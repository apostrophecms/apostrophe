# sluggo

<a href="https://apostrophecms.com/"><img src="https://raw.githubusercontent.com/apostrophecms/sanitize-html/main/logos/logo-box-madefor.png" align="right" alt="Made for ApostropheCMS"/></a>

sluggo is a slug generator that:

* Understands Unicode
* Runs fast (much, much faster than a RegExp solution)
* Replaces all runs of punctuation (in any language), control characters, whitespace, etc. with single dashes, with no leading or trailing dashes
* Allows you to let one punctuation character through if you wish, such as a slash for pathnames
* Allows you to change the separator character
* Is small enough to include in your browser javascript (<10K), even with the Unicode data

## Installation

```bash
npm install sluggo
```

## Usage

```javascript
var sluggo = require('sluggo');

var s = sluggo('@ monkey\'s are elab؉؉orate fools##');
console.log(s);
```

Outputs:

```
monkey-s-are-elab-orate-fools
```

## Options

### separator

Change the string separator by passing a string (usually one character) to `separator`.

```javascript
const sluggo = require('sluggo');

const s = sluggo('monkey\'s are elaborate fools', {
  separator: ','
});
console.log(s);
```

Outputs:

```
monkey,s,are,elaborate,fools
```

### allow

Set a single-character string to allow in returned strings. Otherwise all punctuation characters are replaced by the separator.

```javascript
const sluggo = require('sluggo');

const s = sluggo('@ monkey\'s are elab؉؉orate fools##', {
  allow: '؉'
});
console.log(s);
```

Outputs:

```
monkey-s-are-elab؉؉orate-fools
```

## In the Browser

You just want `sluggo.js`. Add that file to your frontend javascript world.

Now you can call the `sluggo()` function anywhere.

You do NOT need `generator.js`, which we will use when the next version of Unicode comes out to update this module.

## About ApostropheCMS

sluggo was created at [P'unk Avenue](https://punkave.com) for use in [ApostropheCMS](https://apostrophecms.com), an open-source content management system built on Node.js. If you like sanitize-html you should definitely check out Apostrophe.

## Support

Feel free to [open issues on Github](http://github.com/apostrophecms/sluggo/issues).

## Changelog

### 1.0.0 - 2023-05-03
- Accepts an array of exceptions in the `allow` options property while still accepting a string. Declared stable.

### 0.3.1 - 2021-04-23
- Accepts the empty string as a legitimate value for `def`, as was always intended, rather than forcing `none` in that situation. If `def` is not set at all `none` is still the fallback default.

### 0.3.0 - 2020-01-27
- Updates package.json with new metadata
- Updates README.

### 0.2.0

Whoops, the classic apostrophe slugify method accepted `allow`, not `allowed`. We just released this today, so I've switched to `allow` in `sluggo` as well. However I did bump to 0.2.0 to remain faithful to the semver standard.

### 0.1.2

Converts to lowercase properly.

### 0.1.1

Packaged correctly to work in either node or the browser.

### 0.1.0

Initial release.
