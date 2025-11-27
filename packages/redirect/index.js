module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'redirect',
    label: 'aposRedirect:label',
    pluralLabel: 'aposRedirect:pluralLabel',
    searchable: false,
    editRole: 'editor',
    publishRole: 'editor',
    withType: '@apostrophecms/page',
    localized: false,
    quickCreate: false,
    statusCode: 302,
    i18n: {
      ns: 'aposRedirect',
      browser: true
    },
    openGraph: false, // Disables @apostrophecms/open-graph for redirects
    seoFields: false, // Disables @apostrophecms/seo for redirects
    skip: [ /\/api\/v1\/.*/ ],
    before: null
  },
  init(self) {
    self.addUnlocalizedMigration();
    self.addTargetLocaleMigration();
    self.createIndexes();
  },
  handlers(self) {
    return {
      beforeSave: {
        slugPrefix(req, doc) {
          doc.slug = 'redirect-' + doc.redirectSlug;

          if (!doc.title) {
            doc.title = doc.redirectSlug;
          }
        },
        setRedirectSlugPrefix(req, doc) {
          if (doc.redirectSlug === '/*') {
            throw self.apos.error('invalid', 'The redirect slug "/*" is not allowed.');
          }
          if (doc.redirectSlug === '/api/v1/*') {
            throw self.apos.error('invalid', 'The redirect slug "/api/v1/*" is not allowed.');
          }

          const wildcardIndex = doc.redirectSlug.indexOf('*');

          // Include the slash before the wildcard
          doc.redirectSlugPrefix = wildcardIndex === -1
            ? null
            : doc.redirectSlug.substring(0, wildcardIndex);
        },
        setCurrentLocale(req, doc) {
          const internalPage = doc._newPage && doc._newPage[0];
          // Watch out for unlocalized types and missing documents
          doc.targetLocale = (doc.urlType === 'internal' && internalPage?.aposLocale)
            ? internalPage.aposLocale.replace(/:.*$/, '')
            : null;
        }
      }
    };
  },
  fields(self, options) {
    const remove = [
      'visibility'
    ];
    const add = {
      redirectSlug: {
        // This is *not* type: 'slug' because we want to let you match any
        // nonsense the old site had in there, including mixed case, with
        // one exception: only one * is allowed and it must not be right
        // after the leading /
        type: 'string',
        label: 'aposRedirect:originalSlug',
        help: 'aposRedirect:originalSlugHelp',
        pattern: '^(/[^*/]+)+(/\\*)?(/[^*/]+)*$',
        required: true
      },
      title: {
        label: 'aposRedirect:title',
        type: 'string',
        required: true
      },
      urlType: {
        label: 'aposRedirect:urlType',
        type: 'select',
        choices: [
          {
            label: 'aposRedirect:urlTypeInternal',
            value: 'internal'
          },
          {
            label: 'aposRedirect:urlTypeExternal',
            value: 'external'
          }
        ],
        def: 'internal'
      },
      ignoreQueryString: {
        label: 'aposRedirect:ignoreQuery',
        type: 'boolean',
        def: false
      },
      forwardQueryString: {
        label: 'aposRedirect:forwardQuery',
        type: 'boolean',
        def: false
      },
      _newPage: {
        type: 'relationship',
        label: 'aposRedirect:newPage',
        withType: '@apostrophecms/page',
        if: {
          urlType: 'internal'
        },
        builders: {
          // Editors+ set up redirects, so it's OK for non-admins to follow
          // them anywhere (they won't actually get access without logging in)
          project: {
            slug: 1,
            title: 1,
            _url: 1,
            aposLocale: 1
          }
        },
        max: 1
      },
      externalUrl: {
        label: 'aposRedirect:external',
        type: 'url',
        if: {
          urlType: 'external'
        }
      },
      statusCode: {
        label: 'aposRedirect:statusCode',
        type: 'radio',
        htmlHelp: 'aposRedirect:statusCodeHtmlHelp',
        choices: [
          {
            label: 'aposRedirect:302',
            value: '302'
          },
          {
            label: 'aposRedirect:301',
            value: '301'
          }
        ],
        def: '302'
      }
    };

    const group = {
      basics: {
        label: 'apostrophe:basics',
        fields: [
          'title',
          'redirectSlug',
          'urlType',
          '_newPage',
          'externalUrl',
          'statusCode',
          'ignoreQueryString',
          'forwardQueryString'
        ]
      }
    };

    if (options.statusCode.toString() === '301') {
      add.statusCode.def = options.statusCode.toString();
    }

    add._newPage.withType = options.withType;

    return {
      add,
      remove,
      group
    };
  },
  middleware(self, options) {
    return {
      checkRedirect: {
        before: self.options.before,
        async middleware(req, res, next) {

          try {
            if (self.options.skip.find((regExp) => regExp.test(req.originalUrl))) {
              return next();
            }
          } catch (e) {
            self.apos.util.error('Error checking redirect allow list: ', e);
          }

          try {
            let slug = req.originalUrl;
            let [ pathOnly, queryString ] = slug.split('?');
            const pathOnlyParts = pathOnly.split('/').map(decodeURIComponent);
            pathOnly = pathOnlyParts.join('/');
            const prefixes = [];
            // We are not interested in a wildcard at / because we expressly disallow it,
            // so checking for it is a needless performance hit
            for (let i = 2; (i < pathOnlyParts.length); i++) {
              prefixes.push(pathOnlyParts.slice(0, i).join('/') + '/');
            }
            if (queryString !== undefined) {
              slug = `${pathOnly}?${queryString}`;
            } else {
              slug = pathOnly;
            }

            // Build query conditions
            const orConditions = [
              { redirectSlug: slug }
            ];

            if (pathOnly !== slug) {
              orConditions.push({
                redirectSlug: pathOnly
              });
            }

            // Add wildcard prefix matching
            orConditions.push({
              redirectSlugPrefix: {
                $in: prefixes
              }
            });

            const results = await self
              .find(req, { $or: orConditions })
              .currentLocaleTarget(false)
              .relationships(false)
              .project({
                _id: 1,
                redirectSlug: 1,
                redirectSlugPrefix: 1,
                targetLocale: 1,
                externalUrl: 1,
                urlType: 1,
                ignoreQueryString: 1,
                forwardQueryString: 1,
                statusCode: 1
              })
              .toArray();

            if (!results.length) {
              return await emitAndRedirectOrNext();
            }

            // Filter and sort matches by priority. Stop early if we find
            // exact matches
            let validMatches = [];
            for (const redirect of results) {
              // Exact match
              if (redirect.redirectSlug === slug) {
                redirect.matchType = 'exact';
                redirect.matchLength = 0;
                redirect.wildcardMatch = null;
                // The only one that matters, so we can stop early, discard
                // any others and skip the sort
                validMatches = [ redirect ];
                break;
              }

              // Exact match ignoring query string
              if (redirect.redirectSlug === pathOnly && redirect.ignoreQueryString) {
                redirect.matchType = 'exact';
                redirect.matchLength = 0;
                redirect.wildcardMatch = null;
                // The only one that matters, so we can stop early, discard
                // any others and skip the sort
                validMatches = [ redirect ];
                break;
              }

              // Wildcard match
              if (redirect.redirectSlugPrefix && pathOnly.startsWith(redirect.redirectSlugPrefix)) {
                const wildcardIndex = redirect.redirectSlug.indexOf('*');
                const suffixPattern = redirect.redirectSlug.substring(wildcardIndex + 1);
                const capturedPart = pathOnly.substring(redirect.redirectSlugPrefix.length);

                // Check if the URL matches the suffix pattern
                if (suffixPattern) {
                  if (capturedPart.endsWith(suffixPattern)) {
                    redirect.matchType = 'wildcard';
                    redirect.matchLength = redirect.redirectSlugPrefix.length;
                    redirect.wildcardMatch = capturedPart.substring(0, capturedPart.length - suffixPattern.length);
                    validMatches.push(redirect);
                    continue;
                  }
                } else {
                  // No suffix, match everything after prefix
                  redirect.matchType = 'wildcard';
                  redirect.matchLength = redirect.redirectSlugPrefix.length;
                  redirect.wildcardMatch = capturedPart;
                  validMatches.push(redirect);
                  continue;
                }
              }
            }

            if (!validMatches.length) {
              return await emitAndRedirectOrNext();
            }

            if (validMatches.length > 1) {
              // Sort by priority: exact matches first, then longer matches, then shorter matches
              validMatches.sort((a, b) => {
                if (a.matchType === 'exact' && b.matchType !== 'exact') {
                  return -1;
                }
                if (a.matchType !== 'exact' && b.matchType === 'exact') {
                  return 1;
                }
                return b.matchLength - a.matchLength;
              });
            }

            const foundTarget = validMatches[0];
            const isWildcardMatch = foundTarget.matchType === 'wildcard';
            const shouldForwardQueryString = foundTarget.forwardQueryString && !isWildcardMatch;

            const localizedReq = (
              (foundTarget.urlType === 'internal') &&
              Object.keys(self.apos.i18n.locales).includes(foundTarget.targetLocale) &&
              (req.locale !== foundTarget.targetLocale)
            )
              ? req.clone({ locale: foundTarget.targetLocale })
              : req;

            const target = foundTarget.urlType === 'internal'
              ? await self.find(localizedReq, { _id: foundTarget._id }).toObject()
              : foundTarget;

            if (!target) {
              return await emitAndRedirectOrNext();
            }

            const parsedCode = parseInt(target.statusCode);
            const status = (parsedCode && !isNaN(parsedCode)) ? parsedCode : 302;
            const qs = shouldForwardQueryString && queryString ? `?${queryString}` : '';

            if (target.urlType === 'internal' && target._newPage && target._newPage[0]) {
              return redirect(status, target._newPage[0]._url + qs);
            } else if (target.urlType === 'external' && target.externalUrl.length) {
              const externalUrl = isWildcardMatch && target.externalUrl.includes('*')
                ? target.externalUrl.replace('*', foundTarget.wildcardMatch)
                : target.externalUrl;

              return redirect(status, externalUrl + qs);
            }

            return await emitAndRedirectOrNext();
          } catch (e) {
            self.apos.util.error(e);
            return res.status(500).send('error');
          }

          async function redirect(status, url, redirectMethod = 'rawRedirect') {
            const result = {
              status,
              url
            };
            await self.emit('beforeRedirect', req, result);
            return res[redirectMethod](result.status, result.url);
          }

          async function emitAndRedirectOrNext() {
            const result = { status: 302 };
            await self.emit('noMatch', req, result);
            if (result.redirect) {
              return redirect(result.status, result.redirect, 'redirect');
            }
            if (result.rawRedirect) {
              return redirect(result.status, result.rawRedirect);
            }
            return next();
          }
        }
      }
    };
  },
  queries(self, query) {
    return {
      builders: {
        currentLocaleTarget: {
          def: true,
          launder(val) {
            return self.apos.launder.booleanOrNull(val);
          },
          finalize() {
            const active = query.get('currentLocaleTarget');
            const { locale } = query.req;

            if (active && locale) {
              query.and({ $or: [ { targetLocale: null }, { targetLocale: locale } ] });
            }
          }
        }
      }
    };
  },
  methods(self) {
    return {
      addUnlocalizedMigration() {
        self.apos.migration.add('@apostrophecms/redirect:unlocalized', async () => {
          const redirects = await self.apos.doc.db.find({
            type: self.name,
            aposMode: 'published'
          }).toArray();
          for (const redirect of redirects) {
            delete redirect.aposLocale;
            delete redirect.aposMode;
            delete redirect.lastPublishedAt;
            redirect._id = redirect._id.split(':')[0];
            if (redirect.aposDocId) {
              await self.apos.doc.db.removeMany({
                aposDocId: redirect.aposDocId
              });
              await self.apos.doc.db.insertOne(redirect);
            }
          }
        });
      },

      addTargetLocaleMigration() {
        self.apos.migration.add('@apostrophecms/redirect:addTargetLocale', async () => {
          await self.apos.migration.eachDoc({
            type: self.__meta.name,
            urlType: 'internal',
            targetLocale: {
              $exists: 0
            }
          }, async redirect => {
            await self.apos.doc.db.updateOne({
              _id: redirect._id
            }, {
              $set: {
                // It is in the nature of the original bug that we can't tell exactly
                // what locale this should have been (relationships use aposDocId which
                // is cross-locale and we were not saving any information about the
                // target locale). However the default locale is the most
                // likely to be useful and prevents a crash, and if it is not useful
                // the user can just edit or remove the redirect
                targetLocale: self.apos.i18n.defaultLocale
              }
            });
          });
        });
      },

      createIndexes() {
        self.apos.doc.db.createIndex({ redirectSlug: 1 });
        self.apos.doc.db.createIndex({ redirectSlugPrefix: 1 });
      }
    };
  }
};
