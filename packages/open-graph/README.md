<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Open Graph for ApostropheCMS</h1>
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

## Compatibility
This version requires the latest ApostropheCMS. When adding this module to an existing project, run `npm update` to ensure all ApostropheCMS modules are up-to-date.

## Installation

```bash
npm install @apostrophecms/open-graph
```

## Use

Configure `@apostrophecms/open-graph` in `app.js`.

```js
const apos = require('apostrophe')({
  shortName: 'project',
  modules: {
    '@apostrophecms/open-graph': {}
  }
});
```

### Setting the `baseUrl`

Open Graph images *will not be set* with absolute URLs if the `baseUrl` is not set. This should either be set statically in `app.js`, but more likely, in the environment configuration, such as in `data/local.js`. Some social media platforms consider an aboslute URL to be a requirement and *will not accept the image URL without it*.

#### In `app.js` as part of your main Apostrophe app
```js
require('apostrophe')({
  shortName: 'mysite',
  baseUrl: 'https://mysite.com',
  modules: {
    // other module configurations
  }
});
```
#### As part of an environment configuration in `data/local.js`
```js
  module.exports = {
    baseUrl: 'https://mysite.com',
    modules: {
      // other environment-specific module configurations
    }
  };
```
### Opting out of Open Graph Fields

Adding `openGraph: false` to any module will prevent Open Graph fields from being added. Good use cases for this are utility modules, special page types, or piece types that don't have index or show pages.

```js
require('apostrophe')({
  shortName: 'mysite',
  baseUrl: 'https://mysite.com',
  modules: {
    category: {
      options: {
        openGraph: false;
      }
    }
  }
});
```

The following modules opt out of the Open Graph fields by default:
 - `@apostrophecms/global`
 - `@apostrophecms/user`
 - `@apostrophecms/image`
 - `@apostrophecms/image-tag`
 - `@apostrophecms/file`
 - `@apostrophecms/file-tag`

### Field Reference
The following are the fields that are added to pieces and pages

|Name |Description  | Module Effected |
--- | --- | --- 
|`openGraphTitle`|OG Title, populates `<meta property="og:title" />`|`@apostrophecms/doc-type`
|`openGraphDescription`|OG Description, populates `<meta property="og:description" />`|`@apostrophecms/doc-type`
|`openGraphType`|OG Type, populates `<meta property="og:type" />`, defaults to 'website'|`@apostrophecms/doc-type`
|`openGraphImage`|OG Image, populates `<meta property="og:image" />`|`@apostrophecms/doc-type`