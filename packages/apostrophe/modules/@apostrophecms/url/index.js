// Provides the `build` method, a flexible and powerful way to build
// URLs with query parameters and more. This method is made available
// as the `build` filter in Nunjucks. This is also the logical place
// to add new utility methods relating to URLs.

const _ = require('lodash');
const qs = require('qs');
const fs = require('fs');
const cp = require('child_process');
const waitOn = require('wait-on');

module.exports = {

  options: {
    alias: 'url',
    static: false
  },

  tasks(self) {
    return {
      'build-static-site': {
        usage: 'Build a static site at a specified directory path',

        async task(argv) {
          self.apos.url.options.static = true;
          if (argv._.length !== 2) {
            throw new Error('A directory path for the static site must be given.');
          }
          await self.buildStaticSite(argv._[1]);
        }
      }
    };
  },

  methods(self) {
    return {

      // Build filter URLs. `data` is an object whose properties
      // become new query parameters. These parameters override any
      // existing parameters of the same name in the URL. If you
      // pass a property with a value of `undefined`, `null` or an
      // empty string, that parameter is removed from the
      // URL if already present (note that the number `0` does not
      // do this). This is very useful for maintaining filter
      // parameters in a query string without redundant code.
      //
      // Pretty URLs
      //
      // If the optional `path` argument is present, it must be an
      // array. (You may skip this argument if you are just
      // adding query parameters.)
      //
      // Any properties of `data` whose names appear in `path`
      // are concatenated to the URL directly, separated by slashes,
      // in the order they appear in that array.
      //
      // The first missing or empty value for a property in `path`
      // stops this process to prevent an ambiguous URL.
      //
      // Note that there is no automatic detection that this has
      // already happened in an existing URL, so you can't override
      // existing components of the path.
      //
      // If a property's value is not equal to the slugification of
      // itself as determined by apos.util.slugify, then a query
      // parameter is set instead.
      //
      // If you don't want to handle a property as a query parameter,
      // make sure it is always slug-safe.
      //
      // Overrides: multiple data objects
      //
      // You may pass additional data objects. The last one wins, so
      // you can pass your existing parameters first and pass new
      // parameters you are changing as a second data object.
      //
      // Working with Arrays
      //
      // Normally, a new value for a property replaces any old one,
      // and `undefined`, `null` or `''` removes the old one. If you
      // wish to build up an array property instead you'll need
      // to use the MongoDB-style $addToSet and $pull operators to add and
      // remove values from an array field in the URL:
      //
      // Add colors[]=blue to the query string, if not already present
      //
      // `{ colors: { $addToSet: 'blue' } }`
      //
      // Remove colors[]=blue from the query string, if present
      //
      // `{ colors: { $pull: 'blue' } }`
      //
      // All values passed to $addToSet or $pull must be strings or
      // convertible to strings via `toString()` (e.g. numbers, booleans)
      //
      // (The actual query string syntax includes array indices and
      // is fully URI escaped, so it's slightly different but has
      // the same impact. PHP does the same thing.)

      build(url, path, data) {

        let hash;
        // Preserve hash separately
        const matches = url.match(/^(.*)?#(.*)$/);
        if (matches) {
          url = matches[1];
          hash = matches[2];
          if (url === undefined) {
            // Why, JavaScript? Why? -Tom
            url = '';
          }
        }

        // Sometimes necessary with nunjucks, we may otherwise be
        // exposed to a SafeString object and throw an exception
        url = url.toString();

        const qat = url.indexOf('?');
        let base = url;
        const dataObjects = [];
        let pathKeys;
        let original;
        const query = {};
        let i, j;
        let key;

        if (qat !== -1) {
          original = qs.parse(url.substr(qat + 1));
          base = url.substr(0, qat);
        }
        let dataStart = 1;
        if (path && Array.isArray(path)) {
          pathKeys = path;
          dataStart = 2;
        } else {
          pathKeys = [];
        }

        // Process data objects in reverse order so the last
        // override wins
        for (i = arguments.length - 1; i >= dataStart; i--) {
          dataObjects.push(arguments[i]);
        }
        if (original) {
          dataObjects.push(original);
        }
        const done = {};
        let stop = false;
        let dataObject;
        let value;

        for (i = 0; i < pathKeys.length; i++) {
          if (stop) {
            break;
          }
          key = pathKeys[i];
          for (j = 0; j < dataObjects.length; j++) {
            dataObject = dataObjects[j];
            if (dataObject[key] !== undefined) {
              value = dataObject[key];
              // If we hit an empty value we need to stop all path processing
              // to avoid ambiguous URLs
              if (value === undefined || value === null || value === '') {
                done[key] = true;
                stop = true;
                break;
              }
              // If the value is an object it can't be stored in the path,
              // so stop path processing, but don't mark this key 'done'
              // because we can still store it as a query parameter
              if (typeof value === 'object') {
                stop = true;
                break;
              }
              const s = dataObject[key].toString();
              if (s === self.apos.util.slugify(s)) {
                // Don't append double /
                if (base !== '/') {
                  base += '/' + s;
                } else {
                  base += s;
                }
                done[key] = true;
                break;
              } else {
                // A value that cannot be slugified also forces an end to
                // path processing
                stop = true;
                break;
              }
            }
          }
        }

        // For non-path parameters we process starting with the original
        // object so cumulative operations like $addToSet and $pull can work

        for (i = dataObjects.length - 1; i >= 0; i--) {
          dataObject = dataObjects[i];
          for (key in dataObject) {
            if (done[key]) {
              continue;
            }
            value = dataObject[key];
            if (value && value.$pull !== undefined) {
              value = _.difference(query[key] || [], [ value.$pull.toString() ]);
              if (!value.length) {
                value = undefined;
              }
            } else if (value && value.$addToSet !== undefined) {
              value = _.union(query[key] || [], [ value.$addToSet.toString() ]);
              if (!value.length) {
                value = undefined;
              }
            }
            if (value === undefined || value === null || value === '') {
              delete query[key];
            } else {
              query[key] = value;
            }
          }
        }

        function restoreHash(url) {
          if (hash !== undefined) {
            return url + '#' + hash;
          } else {
            return url;
          }
        }

        if (_.size(query)) {
          return restoreHash(base + '?' + qs.stringify(query));
        } else {
          return restoreHash(base);
        }
      },

      // Generate a list of all URLs reachable with the given
      // req object. Used internally to implement static site
      // generation and sitemaps. Usually called in a loop,
      // once for each locale.
      //
      // Returns a list of objects with `url`, `type`, `_id`,
      // `aposDocId` and `i18nId` properties. `type`, `_id`
      // and `aposDocId` are only present if the URL is a
      // representation of a particular document in
      // ApostropheCMS, but `i18nId` should always be present
      // and should be consistent across localized versions
      // of the same URL. If the URL is the main view of a
      // document (e.g. an ordinary page URL or piece URL)
      // it will be equal to `aposDocId`.
      //
      // To accommodate requirements such as `changefreq`
      // and `priority` for sitemaps, additional such
      // properties may be returned, although as of this
      // writing Google explicitly states they are not
      // expected or honored.
      //
      // This method emits the
      // `@apostrophecms/url:getAllUrlMetadata` event, so
      // that handlers in any module can add URLs to the
      // results. The default implementation already calls
      // `getAllUrlMetadata` on every doc type manager that
      // has at least one doc in the database, so listening
      // for the event is only for edge cases that can't be
      // covered by extending `getAllUrlMetadata` or
      // `getUrlMetadata` on such a manager.
      //
      // Handlers should respect `excludeTypes`.
      async getAll(req, { excludeTypes = [] } = {}) {
        let results = [];
        const types = await self.apos.doc.db.distinct('type');
        for (const type of types) {
          if (!excludeTypes.includes(type)) {
            results = [
              ...results,
              ...await self.apos.doc.getManager(type)
                .getAllUrlMetadata(req)
            ];
          }
        }
        await self.emit('getAllUrlMetadata', req, results, { excludeTypes });
        return results;
      },

      // Build a static site in the directory specified
      // by `dir`.
      // This is an implementation detail of the task. This method will
      // listen on port 3123 and is not designed to be run in parallel.
      // After execution the server on port 3123 remains open

      async buildStaticSite(dir) {
        process.env.NODE_ENV = 'production';
        const baseUrl = self.apos.baseUrl;
        if (!self.apos.baseUrl) {
          throw new Error('The top-level baseUrl option must be set for static site builds');
        }
        const releaseId = self.apos.util.generateId();
        console.log('Building assets for static site...');
        cp.execSync(`APOS_RELEASE_ID=${releaseId} NODE_ENV=production node app @apostrophecms/asset:build`, {
          stdio: 'inherit'
        });
        console.log('Copying assets into static site...');
        const assetsFrom = `${self.apos.rootDir}/public/apos-frontend/releases/${releaseId}`;
        const assetsTo = `${dir}/apos-frontend/releases`;
        fs.mkdirSync(assetsTo, { recursive: true });
        cp.execSync(`cp -r ${assetsFrom} ${assetsTo}`);
        console.log('Launching temporary server for static site page generation...');
        const child = cp.spawn('node app', {
          cwd: self.apos.rootDir,
          shell: '/bin/bash',
          stdio: 'inherit',
          env: {
            ...process.env,
            APOS_RELEASE_ID: releaseId,
            NODE_ENV: 'production',
            PORT: '3123',
            ADDRESS: '127.0.0.1'
          }
        });
        await waitOn({
          resources: [
            'tcp:127.0.0.1:3123'
          ]
        });
        const locales = Object.keys(self.apos.i18n.getLocales());
        for (const locale of locales) {
          console.log(`Generating pages for locale ${locale}...`);
          const req = self.apos.task.getAnonReq({
            locale,
            mode: 'published'
          });
          const urls = await self.getAll(req);
          for (const { url } of urls) {
            const path = url.substring(baseUrl.length);
            if (path.includes('?')) {
              console.log(`Ignoring ${path}, not suitable for inclusion in a static site`);
              continue;
            }
            const file = `${path}/index.html`;
            const body = await getBody(path);
            fs.mkdirSync(`${dir}${path}`, { recursive: true });
            fs.writeFileSync(`${dir}${file}`, body);
          }
        }
        // flush I/O for debugging
        child.kill();
        console.log('Static site built.');

        async function getBody(path) {
          const result = await fetch(`http://127.0.0.1:3123${path}`);
          if (result.status !== 200) {
            throw self.apos.error('invalid', `The path ${path} did not produce a 200 status`);
          }
          return result.text();
        }
      },
      // Returns a string suitable to append to the original page URL when we're
      // specifying a particular filter and a page number. Pages start with 1
      getChoiceFilter(name, value, page) {
        if (value === null) {
          return '';
        }
        name = encodeURIComponent(name);
        value = encodeURIComponent(value);
        if (self.options.static) {
          return `/${name}/${value}${page > 1 ? `/page/${page}` : ''}`;
        } else {
          return `?${name}=${value}${page > 1 ? `&page=${page}` : ''}`;
        }
      },
      // Returns a string suitable to append to the original page URL when all we're
      // adding is a page number. Pages start with 1
      getPageFilter(page) {
        if (page <= 1) {
          return '';
        }
        if (self.options.static) {
          return `/page/${page}`;
        } else {
          return `?page=${page}`;
        }
      }
    };
  }
};
