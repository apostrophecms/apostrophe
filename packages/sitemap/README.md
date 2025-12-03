<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Sitemap generator for ApostropheCMS</h1>
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

The Apostrophe Sitemap module generates XML sitemaps for websites powered by [ApostropheCMS](https://apostrophecms.com). The sitemap includes all of the pages on your site that are visible to the public, including "piece" content, such as events and blog posts.

A frequently updated and accurate XML sitemap allows search engines to index your content more quickly and spot new pages. The Sitemap module will maintain a cached sitemap to load quickly, but then automatically refresh after one hour (by default). This also prevents the sitemap from getting out-of-date, which would be *very bad* for SEO.

## Roadmap

| Feature | Status |
| --- | --- |
| Sitemap generation for single-locale websites | ✅ Implemented |
| Module configuration to exclude certain doc types | ✅ Implemented |
| Tasks to manually generate sitemap | ✅ Implemented |
| Text-style sitemap generation (for content strategy work) | 🚧 Planned |
| Support for multiple locales (localization) | ✅ Implemented |
| Output customization function | 🚧 Planned |

## Installation

```bash
npm install @apostrophecms/sitemap
```

## Use

### Initialization

Configure `@apostrophecms/sitemap` in `app.js` as a project module.

```javascript
// app.js
require('apostrophe')({
  shortName: 'my-project',
  baseUrl: 'https://example.com',
  modules: {
    '@apostrophecms/sitemap': {}
  }
});
```

**Start the site** (with `node app` or your preferred command) and visit `http://localhost:3000/sitemap.xml` (in local development). You should now see any pages displayed in a sitemap as well as any pieces that have an associated piece page.

### Setting the `baseUrl`

It is important to configure a `baseUrl` for the project to properly display URLs. That can be done in the application configuration object as shown above. To support different domains in production and development environments, it can also be configured in a `data/local.js` file which should be ignored by version control. `data/local.js` will take precedence over `app.js`, so both can be used to support multiple environments as well.

```javascript
// data/local.js
module.exports = {
  baseUrl: 'http://localhost:3000'
};
```

### Options

All sitemap module options are configured in an `options` object.

```javascript
// modules/@apostrophecms/sitemap/index.js
module.exports = {
  // 👇 Module options
  options: {
    cacheLifetime: 1800,
    excludeTypes: [ 'exclusive-page', 'category' ]
    piecesPerBatch: 500
  }
};
```

These can be added in the `app.js` configuration object for the module, but it is better practice to use a dedicated file for module configuration.

#### `cacheLifetime`

By default sitemaps are cached for one hour. You can change this by specifying the `cacheLifetime` option to this module, in seconds. It must be a number greater than zero.

**Tip:** To make entering the cache lifetime easier it can help to write it as a math expression, multiplying the desired number of minutes by sixty:

```javascript
cacheLifetime: 30 * 60 // or 1800 seconds
```

Keep in mind: Google and other search engines more than weekly, if that.Refreshing once every hour is usually more than often enough.

#### `excludeTypes`

If there are particular page types or piece content types that should *not* be in the sitemap, list them in an array as the `excludeType` option.

```javascript
excludeTypes: [ 'exclusive-page', 'category' ]
```

#### `piecesPerBatch`

If you have thousands of URLs to index, building the sitemap may take a long time. By default, this module processes 100 pieces at a time, to avoid using too much memory. You can adjust this by setting the `piecesPerBatch` option to a larger number. Be aware that if you have many fields and content relationships **it is possible this can use a great deal of memory**.

```javascript
piecesPerBatch: 500
```

### `perLocale`

If your project uses multiple locales and you want **each locale to have its own sitemap**, enable the `perLocale` option:

```js
// modules/@apostrophecms/sitemap/index.js
module.exports = {
  options: {
    perLocale: true
  }
};
```

This will:

* Generate separate sitemap files for each locale (e.g., `/sitemaps/en.xml`, `/sitemaps/es.xml`, etc.)
* Serve a sitemap index file at `/sitemaps/index.xml`
* Disable the default `/sitemap.xml` route (returns a 404)

> 💡 **Tip**
> If you're using multiple locales, enable `perLocale` to generate a separate sitemap for each one.

> ```
> Sitemap: https://example.com/sitemaps/index.xml
> ```

### Tasks

#### `print`

The `print` command will generate an up-to-date sitemap on demand and **print the sitemap into the console**. You can also pipe the output it as needed, to help generate a static file version. On the command line, run:

```bash
node app @apostrophecms/sitemap:print
```

#### `update-cache`

Use the `update-cache` task to force a cache update at any time. If the website is very large (multiple hundreds of URLs), running this task option with a cron job on the production server more often than the standard cache refresh can help ensure the cache is available when a search engine begins crawling the site.

```bash
node app @apostrophecms/sitemap:update-cache
```

#### `clear`

You can manually clear the cached sitemap at any time with the `clear` task. This will force a new sitemap to be generated on the next request to `/sitemap.xml`. On the command line, run:

```bash
node app @apostrophecms/sitemap:clear
```

### Telling search engines about the sitemap

Create a `public/robots.txt` file if you do not already have one and add a sitemap line. Here is a valid example for a site that doesn't have any other `robots.txt` rules:

```
Sitemap: https://example.com/sitemap.xml
```

### Troubleshooting

- If you already have a static `public/sitemap.xml` file, **that file will be shown at the `/sitemap.xml` URL path instead.** Remove it to let the module take over.
- Sitemaps are cached for one hour by default, so you won't see content changes instantly. See above about the `cacheLifetime` option, `clear` task, and `update-cache` task for ways to refresh the sitemap more frequently.
