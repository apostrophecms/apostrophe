<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Manage site redirects for ApostropheCMS</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/blog/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

## Installation

First make sure you have an [Apostrophe project](https://apostrophecms.com)!

Then:

```javascript
npm install @apostrophecms/redirect
```

## Configuration

In `app.js`, add the module to your configuration:

  ```js
  require('apostrophe')({
    shortName: 'MYPROJECT',
    modules: {
      '@apostrophecms/redirect': {}
    }
  });
  ```
### `statusCode`
*Defaults to `302`*
By passing `statusCode` to your configuration you can change the default status code value.
Accepted values are `301` and `302`

```javascript
// Other modules, then...
'@apostrophecms/redirect': {
  options: {
    statusCode: 301
  }
}
```
> Note that permanent redirects are cached by Google for a long time. It is a good idea to encourage users to test with a temporary redirect first, then switch to permanent which is an SEO best practice — as long as it's correct.

### `withType`
*Defaults to `@apostrophecms/page`*
By passing `withType` to your configuration you can specify the document type your internal redirects can redirect to.

```javascript
// Other modules, then...
'@apostrophecms/redirect': {
  options: {
    withType: 'article'
  }
}
```

**Note:** Apostrophe 2 supported creating relationships to multiple doc types from a single interface. This feature doesn't yet exist in the newer versions of Apostrophe, as such redirects can only specify a single doc type to redirect to.

### `skip`

For performance the redirect check can be skipped for URLs matching certain regular expressions.
The default configuration of the `skip` option is:

```javascript
// Other modules, then...
'@apostrophecms/redirect': {
  options: {
    skip: [ /\/api\/v1\/.*/ ]
  }
}
```

If you wish to skip other patterns, we recommend keeping the default one as it speeds up API calls.

## Usage

While logged in as an admin, click the "Redirects" button. A list of redirects appears, initially empty. Add as many redirects as you like. The "from" URL must begin with a `/`. The "to" URL may be anything and need not be on your site. The "description" field is for your own convenience.

### Matching the query string

By default a redirect includes any query string (the `?` and whatever follows it, up to but not including any `#`) on incoming requests when matching for redirection. 

You can toggle the "ignore query string when matching" option in a redirect definition to ignore query strings on incoming requests and only match on the base URL path. A redirect that does not use this option will always match first, so you can match various specific query strings and then have a fallback rule for other cases.

### Matching wildcards

Normally, aside from the query string, only an exact match is honored. If you wish to redirect an entire subdirectory, you may use a `*` immediately after a `/`, for example:

```
/auto/*
```

This will redirect **all** URLs beginning with `/auto/` to your destination, like this:

```
/auto/hyundai -> /fr/auto
/auto/hyundai/ioniq-5 -> /fr/auto
/auto/hyundai/ioniq-5 -> /fr/auto
```

⚠️ Note that this **discards the rest of the URL**. If this is not what you want, see below for ways to avoid it.

### Exact matches always win

If you have a redirect rule with no `*`, it will always beat a redirect rule with an `*`.

Fro instance, if you have rules like this:

```
/auto/gm/bolt -> /en/auto/gm/bolt
/auto/* -> /fr/auto
```

Then actual redirects will play out like this:

```
/auto/gm/bolt -> /en/auto/gm/bolt
/auto/toyota/tercel -> /fr/auto
```

### Capturing wildcards

If you are creating an "URL" redirect, and not an "Internal Page" one, you may also "capture" and reuse the rest of the URL by including the `*` . This is useful when the rest of the URL is still correct.

For instance, if your "Old URL" is:

```
/auto/*
```

And you select "URL" as the redirect type and type the following in the "URL" field:

```
/fr/auto/*
```

Then redirects will occur like this:

```
/auto/hyundai -> /fr/auto/hyundai
/auto/hyundai/ioniq-5 -> /fr/auto/hyundai/ioniq-5
/auto/hyundai/ioniq-5 -> /fr/auto/hyundai/ioniq-5
```

### Creating fallbacks with multiple wildcard rules

Note that if you have two redirect rules involving an `*` and one is longer than the other, **the longer match always wins.*

For example, if your redirects are set up like this:

```
/auto/hyundai/* -> /en/car/hyundai/*
/auto/* -> /fr/auto/*
```

Then redirects will play out like this:

```
/auto/mercedes -> /fr/auto/mercedes
/auto/mercedes/w123 -> /fr/auto/mercedes/w123
/auto/hyundai -> /en/car/hyundai
/auto/hyundai/ioniq-5 -> /en/car/hyundai/ioniq-5
/auto/hyundai/ioniq-5 -> /en/car/hyundai/ioniq-5
```

### Safety concerns

Be aware that each redirect is live as soon as you save it and that it is possible to make a mess with redirects. A few obvious dangers like redirecting `/*` or `/api/v1/*` are locked out, but it is still possible to cause problems depending on your site's structure. In a pinch, you can remove unwanted redirects via the MongoDB command line client (look for `{ type: "@apostrophecms/redirect" }` in the `aposDocs` collection in MongoDB).

### Soft redirects: when you don't need this module at all

For your convenience, ApostropheCMS automatically creates "soft redirects" every time you change the slug of a page or piece, provided the document was accessed at least once at the old URL. So you shouldn't need to manually create a "hard redirect" in that situation.

## Extending the module

### Providing a fallback handler

If you wish to handle redirects in another way when this module does not find a match, you can do so by listening for the `@apostrophecms/redirect:noMatch` event. This event handler receives `req, result`. To issue a redirect, set `result.redirect` in your event handler. To issue a "raw" redirect to which any sitewide prefix is not appended automatically, set `result.rawRedirect` in your event handler. You can also set `result.status` to match your need as the status code of the redirection, default is `302`.   
If you wish to alter the target url when a redirection is about to come, like for example to change the domain, you can listen to the `@apostrophecms/redirect:beforeRedirect`. This event handler receives `req, result`. `result` will have two properties that you can alter before the redirection: `status` and `url`. **Do not** call `req.res.redirect()` yourself in your event handler in those two cases.

For example:

```javascript
// modules/redirect-fallback/index.js
module.exports = {
  handlers(self) {
    return {
      '@apostrophecms/redirect:noMatch': {
        // will be awaited, you can do queries here if needed
        async fallback(req, result) {
          if (req.url.match(/pattern/)) {
            result.redirect = '/destination';
          }
        }
      }
    }
  }
}
```

### Preempting the redirect module

If your goal is to preempt this module by making a decision to redirect differently in some cases before this module looks for a match, register your own middleware and perform the redirect there. Use `before` to specify that your own module's middleware comes first.

For example:

```javascript
// modules/early-redirect/index.js
module.exports = {
  middleware(self) {
    return {
      earlyRedirect: {
        before: '@apostrophecms/redirect',
        middleware(req, res, next) {
          if (req.url.match(/pattern/)) {
            return res.redirect('/destination');
          } else {
            return next();
          }
        }
      }
    };
  }
};
```

### Executing the middleware sooner

By default the middleware of this module that checks for redirect is executed depending on the place of this module in your modules configuration.   
You can choose to execute it before any other module by setting the `before` option, indicating before which module middleware this one should run (for example `@apostrophecms/global`).   
Note that by doing this, the above preemption will not work anymore.   


## Redirecting to other locales

It's possible to redirect from one locale to another one, with external redirections, 
since you manually define the url to redirect to.

As for internal redirects (relationships with pages), this works across locales as well, 
but keep in mind that you will only see the internal redirects that target the current locale when managing redirects. 
To find redirects that target an internal page in a different locale, switch locales before viewing "Manage Redirects."

A note for developers: a query builder called `currentLocaleTarget` hides redirects that have relationships to other locales (different from the current one).
If you want to get all redirects whatever the locale of their internal redirects you can undo this behavior using the query builder:
```javascript
const redirects = await self.apos.modules['@apostrophecms/redirect']
    .find(req)
    .currentLocaleTarget(false)
    .toArray();
```
