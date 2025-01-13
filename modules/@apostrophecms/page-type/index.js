const _ = require('lodash');
// Same engine used by express to match paths
const pathToRegexp = require('path-to-regexp');

module.exports = {
  extend: '@apostrophecms/doc-type',
  cascades: [
    'filters',
    'columns'
  ],
  options: {
    perPage: 10,
    // Pages should never be considered "related documents" when localizing another document etc.
    relatedDocument: false
  },
  fields(self) {
    return {
      add: {
        slug: {
          type: 'slug',
          label: 'apostrophe:slug',
          required: true,
          page: true,
          following: [ 'title', 'archived' ]
        },
        type: {
          type: 'select',
          label: 'apostrophe:type',
          required: true,
          def: self.options.apos.page.typeChoices[0].name,
          choices: self.options.apos.page.typeChoices.map(function (type) {
            return {
              value: type.name,
              label: type.label
            };
          })
        },
        orphan: {
          type: 'boolean',
          label: 'apostrophe:hideInNavigation',
          def: false
        }
      },
      remove: [ 'archived' ],
      group: {
        utility: {
          // Keep `slug`, `type`, `visibility` and `orphan` fields before others,
          // in case of modules improving `@apostrophecms/doc-type` that would add
          // custom fields (included in `self.fieldsGroups.utility.fields`).
          fields: _.uniq([
            'slug',
            'type',
            'visibility',
            'orphan',
            ...self.fieldsGroups.utility.fields
          ])
        }
      }
    };
  },
  columns() {
    return {
      add: {
        title: {
          name: 'title',
          label: 'apostrophe:title',
          component: 'AposCellButton'
        },
        slug: {
          name: 'slug',
          label: 'apostrophe:slug',
          component: 'AposCellButton'
        },
        updatedAt: {
          name: 'updatedAt',
          label: 'apostrophe:lastEdited',
          component: 'AposCellLastEdited'
        }
      }
    };
  },
  filters: {
    add: {
      archived: {
        label: 'apostrophe:archived',
        inputType: 'radio',
        choices: [
          {
            value: false,
            label: 'apostrophe:live'
          },
          {
            value: true,
            label: 'apostrophe:archived'
          }
        ],
        def: false,
        required: true
      }
    }
  },
  init(self) {
    self.removeDeduplicatePrefixFields([ 'slug' ]);
    self.addDeduplicateSuffixFields([
      'slug'
    ]);
    self.rules = {};
    self.dispatchAll();
    self.composeFilters();
    self.composeColumns();
  },
  handlers(self) {
    return {
      '@apostrophecms/page:serve': {
        async dispatchPage(req) {
          if (!req.data.bestPage) {
            return;
          }
          if (req.data.bestPage.type !== self.name) {
            return;
          }
          let matched;
          if (_.isEmpty(self.rules)) {
            // If there are no dispatch rules, assume this is an "ordinary" page type and
            // just look for an exact match
            if (req.remainder !== '/') {
              req.notFound = true;
            } else {
              self.acceptResponsibility(req);
            }
            return;
          }
          _.each(self.rules, function (_rule) {
            if (self.match(req, _rule, req.remainder)) {
              matched = _rule;
              return false;
            }
          });
          if (!matched) {
            req.notFound = true;
            return;
          }
          self.acceptResponsibility(req);
          for (const fn of matched.middleware) {
            const result = await fn(req);
            if (result === false) {
              return;
            }
          }
          await matched.handler(req);
        }
      },
      beforeMove: {
        checkPermissions(req, doc) {
          if (doc.lastPublishedAt && !self.apos.permission.can(req, 'publish', doc)) {
            throw self.apos.error('forbidden', 'Contributors may only move unpublished pages.');
          }
        }
      },
      afterMove: {
        async replayMoveAfterMoved(req, doc) {
          if (!doc._id.includes(':draft')) {
            return;
          }
          const published = await self.findOneForEditing(req.clone({
            mode: 'published'
          }), {
            _id: doc._id.replace(':draft', ':published')
          }, {
            permission: false
          });
          if (published && (doc.level > 0)) {
            const { lastTargetId, lastPosition } = await self.apos.page.inferLastTargetIdAndPosition(doc);
            return self.apos.page.move(
              req.clone({
                mode: 'published'
              }),
              published._id,
              lastTargetId.replace(':draft', ':published'),
              lastPosition
            );
          }
        }
      },
      beforePublish: {
        async ancestorsMustBePublished(req, { draft, published }) {
          const ancestorAposDocIds = draft.path.split('/');
          // Self is not a parent
          ancestorAposDocIds.pop();
          const publishedAncestors = await self.apos.doc.db.find({
            aposDocId: {
              $in: ancestorAposDocIds
            },
            aposLocale: published.aposLocale
          }).project({
            _id: 1,
            aposDocId: 1,
            title: 1
          }).toArray();
          if (publishedAncestors.length !== ancestorAposDocIds.length) {
            const draftAncestors = await self.apos.doc.db.find({
              aposDocId: {
                $in: ancestorAposDocIds
              },
              aposLocale: draft.aposLocale
            }).project({
              _id: 1,
              aposLocale: 1,
              aposDocId: 1,
              title: 1,
              type: 1
            }).toArray();
            throw self.apos.error('invalid', 'Publish the parent page(s) first.', {
              unpublishedAncestors: draftAncestors.filter(draftAncestor => {
                return !publishedAncestors.find(publishedAncestor => {
                  return draftAncestor.aposDocId === publishedAncestor.aposDocId;
                });
              })
            });
          }
        }
      },
      beforeUnpublish: {
        async descendantsMustNotBePublished(req, published, options = {}) {
          if (options.descendantsMustNotBePublished === false) {
            return;
          }
          const descendants = await self.apos.doc.db.countDocuments({
            path: self.apos.page.matchDescendants(published),
            aposLocale: published.aposLocale
          });
          if (descendants) {
            // TODO it might be nice to have an option to automatically do it
            // recursively, but right now this is a hypothetical because we
            // only invoke the unpublish API as "undo publish," and "publish" is already
            // guarded to happen from the bottom up. Just providing minimum
            // acceptable coverage here for now
            throw self.apos.error('invalid', 'You must unpublish child pages before unpublishing their parent.');
          }
        },
        async parkedPageMustNotBeUnpublished(req, published) {
          if (published.parked) {
            throw self.apos.error('invalid', 'apostrophe:pageIsParkedAndCannotBeUnpublished');
          }
        }
      },
      afterRevertPublishedToPrevious: {
        async replayMoveAfterRevert(req, result) {
          const publishedReq = req.clone({
            mode: 'published'
          });
          if (result.published.level === 0) {
            // The home page cannot move, so there is no
            // chance we need to "replay" such a move
            return;
          }
          const { lastTargetId, lastPosition } = await self.apos.page.inferLastTargetIdAndPosition(result.published);
          await self.apos.page.move(
            publishedReq,
            result.published._id,
            lastTargetId,
            lastPosition
          );
          const published = await self.apos.page.findOneForEditing(publishedReq, {
            _id: result.published._id
          });
          result.published = published;
        }
      },
      beforeDelete: {
        async checkForParked(req, doc, options) {
          if (doc.level === 0) {
            throw self.apos.error('invalid', 'The home page may not be removed.');
          }
          if (doc.parked) {
            throw self.apos.error('invalid', 'This page is "parked" and may not be removed.');
          }
        },
        async checkForChildren(req, doc, options) {
          if (options.checkForChildren !== false) {
            const descendants = await self.apos.doc.db.countDocuments({
              path: self.apos.page.matchDescendants(doc),
              aposLocale: doc.aposLocale
            });
            if (descendants) {
              throw self.apos.error('invalid', 'You must delete the children of this page first.');
            }
          }
        }
      }
    };
  },
  methods(self) {
    return {
      dispatchAll() {
        self.dispatch('/', req => self.setTemplate(req, 'page'));
      },
      // Add an Express-style route that responds when "the rest" of the URL, beyond
      // the page slug itself, matches a pattern.
      //
      // For instance,  if the page slug is `/poets`, the URL is
      // `/poets/chaucer`, and this method has been called with
      // `('/:poet', self.poetPage)`, then the `poetPage` method will
      // be invoked with `(req)`. **The method must be an async
      // function, and it will be awaited.**
      //
      // **Special case:** if the page slug is simply `/poets` (with no slash) and
      // there is a dispatch route with the pattern `/`, that route will be invoked.
      //
      // Dispatch routes can also have async middleware. Pass middleware functions as
      // arguments in between the pattern and the handler. Dispatch middleware
      // functions are async functions which receive `(req)` as an argument. If
      // a middleware function explicitly returns `false`, no more middleware is run
      // and the handler is not run. Otherwise the chain of middleware continues
      // and, at the end, the handler is invoked.
      dispatch(pattern) {
        const keys = [];
        const regexp = pathToRegexp(pattern, keys);
        self.rules[pattern] = {
          pattern,
          middleware: Array.prototype.slice.call(arguments, 1, arguments.length - 1),
          handler: arguments[arguments.length - 1],
          regexp,
          keys
        };
      },
      // Match a URL according to the provided rule as registered
      // via the dispatch method. If there is a match, `req.params` is
      // set exactly as it would be by Express and `true` is returned.
      match(req, rule, url) {
        const matches = rule.regexp.exec(url);
        if (!matches) {
          return false;
        }
        req.params = {};
        for (let i = 0; i < rule.keys.length; i++) {
          req.params[rule.keys[i].name] = matches[i + 1];
        }
        return true;
      },
      // Called by `pageServe`. Accepts responsibility for
      // the current URL by assigning `req.data.bestPage` to
      // `req.page` and implementing the `scene` option, if set
      // for this module.
      acceptResponsibility(req) {
        // We have a match, so consider bestPage to be the
        // current page for template purposes
        req.data.page = req.data.bestPage;
        if (self.options.scene) {
          req.scene = self.options.scene;
        }
      },
      // Returns a string to represent the given `doc` in an
      // autocomplete menu. `doc` will contain only the fields returned
      // by `getAutocompleteProjection`. `query.field` will contain
      // the schema field definition for the relationship the user is attempting
      // to match titles from. The default behavior is to return
      // the `title` property, but since this is a page we are including
      // the slug as well.
      getAutocompleteTitle(doc, query) {
        // TODO Remove in next major version.
        self.apos.util.warnDevOnce(
          'deprecate-get-autocomplete-title',
          'self.getAutocompleteTitle() is deprecated. Use the autocomplete(\'...\') query builder instead. More info at https://v3.docs.apostrophecms.org/reference/query-builders.html#autocomplete'
        );
        return doc.title + ' (' + doc.slug + ')';
      },
      // `req` determines what the user is eligible to edit, `criteria`
      // is the MongoDB criteria object, and any properties of `options`
      // are invoked as methods on the query with their values.
      find(req, criteria = {}, options = {}) {
        return self.apos.modules['@apostrophecms/any-page-type'].find(req, criteria, options).type(self.name);
      },
      // Called for you when a page is inserted directly in
      // the published locale, to ensure there is an equivalent
      // draft page. You don't need to invoke this.
      async insertDraftOf(req, doc, draft, options) {
        const _req = req.clone({
          mode: 'draft'
        });
        options = {
          ...options,
          setModified: false
        };
        if (doc.level > 0) {
          const { lastTargetId, lastPosition } = await self.apos.page.inferLastTargetIdAndPosition(doc);
          // Replay the high level positioning used to place it in the published locale
          return self.apos.page.insert(
            _req,
            lastTargetId.replace(':published', ':draft'),
            lastPosition,
            draft,
            options
          );
        } else {
          // Insert the home page
          return self.apos.doc.insert(_req, draft, options);
        }
      },
      // Called for you when a page is published for the first time.
      // You don't need to invoke this.
      async insertPublishedOf(req, doc, published, options = {}) {
        // Check publish permission up front because we won't check it
        // in insert
        if (!self.apos.permission.can(req, 'publish', doc)) {
          throw self.apos.error('forbidden');
        }
        const _req = req.clone({
          mode: 'published'
        });
        if (doc.level > 0) {
          const { lastTargetId, lastPosition } = await self.apos.page.inferLastTargetIdAndPosition(doc);
          // Replay the high level positioning used to place it in the draft locale
          return self.apos.page.insert(
            _req,
            // do not force published doc as it might not exist, lastTargetId
            // existance is granted (see `inferLastTargetIdAndPosition`).
            lastTargetId,
            lastPosition,
            published,
            {
              ...options,
              // We already confirmed we are allowed to
              // publish the draft, bypass checks that
              // can get hung up on "create" permission
              permissions: false
            }
          );
        } else {
          // Insert the home page
          Object.assign(published, {
            path: doc.path,
            level: doc.level,
            rank: doc.rank,
            parked: doc.parked,
            parkedId: doc.parkedId
          });
          return self.apos.doc.insert(_req, published, options);
        }
      },
      // Update a page. The `options` argument may be omitted entirely.
      // if it is present and `options.permissions` is set to `false`,
      // permissions are not checked.
      //
      // This is a convenience wrapper for `apos.page.update`, for the
      // benefit of code that expects all managers to have an update method.
      // Pages are usually updated via `apos.page.update`.
      async update(req, page, options = {}) {
        return self.apos.page.update(req, page, options);
      },
      // True delete. Will throw an error if the page
      // has descendants.
      //
      // This is a convenience wrapper for `apos.page.delete`, for the
      // benefit of code that expects all managers to have a delete method.
      // Pages are usually deleted via `apos.page.delete`.
      async delete(req, page, options = {}) {
        return self.apos.page.delete(req, page, options);
      },
      // If the page does not yet have a slug, add one based on the
      // title; throw an error if there is no title
      ensureSlug(page) {
        if (!page.slug || (!page.slug.match(/^\//))) {
          if (page.title) {
            // Parent-based slug would be better, but this is not an
            // async function and callers will typically have done
            // that already, so skip the overhead. This is just a fallback
            // for naive use of the APIs
            page.slug = '/' + self.apos.util.slugify(page.title);
          } else {
            throw self.apos.error('invalid', 'Page has neither a slug beginning with / or a title, giving up');
          }
        }
      }
    };
  },
  extendMethods(self, options) {
    return {
      enableAction() {
        self.action = self.apos.modules['@apostrophecms/page'].action;
      },
      copyForPublication(_super, req, from, to) {
        _super(req, from, to);
        to.parkedId = from.parkedId;
        to.parked = from.parked;
      },
      getAutocompleteProjection(_super, query) {
        const projection = _super(query);
        projection.slug = 1;
        return projection;
      },
      // Extend `composeSchema` to flag the use of field names
      // that are forbidden or nonfunctional in page types,
      // i.e. path, rank, level
      composeSchema(_super) {
        _super();
        const forbiddenFields = [
          'path',
          'rank',
          'level'
        ];
        _.each(self.schema, function (field) {
          if (_.includes(forbiddenFields, field.name)) {
            throw new Error('Page type ' + self.name + ': the field name ' + field.name + ' is forbidden');
          }
        });
      },
      // Given a page and its parent (if any), returns a schema that  is
      // filtered appropriately to that page's type, taking into account whether
      // the page is new, whether it is parked, and the parent's allowed subpage
      // types.
      allowedSchema(_super, req, page = {}, parentPage = {}) {
        let schema = _super(req);

        const typeField = _.find(schema, { name: 'type' });
        if (typeField) {
          const allowed = self.apos.page.allowedChildTypes(parentPage);
          // For a preexisting page, we can't forbid the type it currently has
          if (page._id && !_.includes(allowed, page.type)) {
            allowed.unshift(page.type);
          }
          typeField.choices = _.map(allowed, function (name) {
            return {
              value: name,
              label: getLabel(name)
            };
          });
        }
        if (page._id) {
          // Preexisting page
          schema = self.apos.page.addApplyToSubpagesToSchema(schema);
          schema = self.apos.page.removeParkedPropertiesFromSchema(page, schema);
        }
        return schema;
        function getLabel(name) {
          const choice = _.find(self.apos.page.typeChoices, { name });
          let label = choice && choice.label;
          if (!label) {
            const manager = self.apos.doc.getManager(name);
            if (!manager) {
              throw new Error(`There is no page type ${name} but it is configured in the types option`);
            }
            label = manager.label;
          }
          if (!label) {
            label = name;
          }
          return label;
        }
      },
      getBrowserData(_super, req) {
        const browserOptions = _super(req);

        browserOptions.filters = self.filters;
        browserOptions.columns = self.columns;
        browserOptions.contentChangedRefresh = options.contentChangedRefresh !== false;

        // Sets manager modal to AposDocsManager
        // for browsing specific page types:
        browserOptions.components = {
          ...browserOptions.components,
          managerModal: 'AposDocsManager'
        };

        return browserOptions;
      }
    };
  }
};
