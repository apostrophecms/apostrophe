<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe Redis Cache</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/cache-redis/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/cache-redis/tests/main?label=Tests&logo=github&labelColor=000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/cache-redis/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This module enhances the core caching module, `@apostrophecms/cache`, to use [Redis](https://redis.io/) rather than MongoDB. This module does not set up the actual Redis store, but instead allows Apostrophe to access an existing Redis store through the standard Apostrophe caching API and an internal Redis client.

All normal Apostrophe cache API features are maintained in addition to the Redis-specific features described below.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/cache-redis
```

## Usage

Configure the Redis cache module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/cache-redis': {}
  }
});
```

## Configuring Redis options

**All options for this module should be applied to `@apostrophecms/cache` in project code.** This module simply "improves" that core module (updates its features). The main caching module still does all the work.

Configure the underlying Redis client by adding a configuration object on the cache module's `redis` option.

```javascript
// modules/@apostrophecms/cache/index.js
module.exports = {
  options: {
    redis: {
      url: 'redis://alice:foobared@awesome.redis.server:6380'
    }
  }
};
```

By default, the client will look for a Redis server running on localhost port 6379. See [all the client configuration options](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md) on the Node-Redis documentation.

Note that this module uses the 4.x version of Node-Redis, which changed its configuration options from earlier major versions.

## Cache keys

The Apostrophe cache `get` and `set` methods take two arguments that are used for individual cache item keys:

| Argument | Description |
| -------- | ----------- |
| `namespace` | A namespace for related data. Apostrophe core often uses the active module's name for the namespace, e.g., `@apostrophecms/oembed`. |
| `key` | The unique cache item key within a namespace. |

```javascript
await apos.cache.get(namespace, key)
await apos.cache.set(namespace, key, value)
```

Example:

```javascript
const fetch = node
// modules/api-connect/index.js
module.exports = {
  apiRoutes(self) {
    return {
      get: {
        // GET /api/v1/api-connect/set-cache-info
        async setCacheInfo(req) {
          const info = await myApiClient.get({ latest: true });

          // 👇 This status will be "OK" if successful. This is due to the Redis
          // API, not a common Apostrophe pattern.
          const status = await self.apos.cache.set('api-connect', 'latest', info);

          return { status };
        },
        // GET /api/v1/api-connect/get-cache-info
        async getCacheInfo(req) {
          // 👇 This will return the stored information or `undefined` if not
          // set.
          const latest = await self.apos.cache.get('api-connect', 'latest');

          return { latest };
        }
      }
    };
  }
};
```

### Using the `prefix` for multiple sites

By default, this module applies a prefix to cache keys in the store. This prefix is the shortname of the website, which automatically separates cache items if multiple Apostrophe sites share the same Redis store.

To disable the cache key prefix, set the cache module's `prefix` option to `false`.

```javascript
// modules/@apostrophecms/cache/index.js
module.exports = {
  options: {
    prefix: false
  }
};
```

To customize the prefix, set the `prefix` option to the desired string value.

```javascript
// modules/@apostrophecms/cache/index.js
module.exports = {
  options: {
    prefix: 'project-alpha'
  }
};
```
