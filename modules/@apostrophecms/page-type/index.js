const _ = require('lodash');
// Same engine used by express to match paths
const pathToRegexp = require('path-to-regexp');

module.exports = {
  extend: '@apostrophecms/doc-type',
  fields(self) {
    return {
      add: {
        slug: {
          type: 'slug',
          label: 'Slug',
          required: true,
          page: true,
          following: 'title'
        },
        type: {
          type: 'select',
          label: 'Type',
          required: true,
          choices: self.options.apos.page.typeChoices.map(function (type) {
            return {
              value: type.name,
              label: type.label
            };
          })
        },
        orphan: {
          type: 'boolean',
          label: 'Hide in Navigation',
          def: false
        }
      },
      remove: [ 'trash' ],
      group: {
        utility: {
          fields: [
            'slug',
            'type',
            'orphan'
          ]
        }
      }
    };
  },
  init(self) {
    self.removeTrashPrefixFields([ 'slug' ]);
    self.addTrashSuffixFields([
      'slug'
    ]);
    self.rules = {};
    self.dispatchAll();
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
      afterMove: {
        async replayMoveAfterMoved(req, doc) {
          if (!doc._id.includes(':draft')) {
            return;
          }
          const published = await self.findOneForEditing({
            ...req,
            mode: 'published'
          }, {
            _id: doc._id.replace(':draft', ':published')
          }, {
            permission: false
          });
          if (published && doc.aposLastTargetId) {
            return self.apos.page.move({
              ...req,
              mode: 'published'
            }, published._id, doc.aposLastTargetId.replace(':draft', ':published'), doc.aposLastPosition);
          }
        }
      },
      afterTrash: {
        async trashIsDraftOnly(req, doc) {
          if (!doc._id.includes(':draft')) {
            return;
          }
          return self.apos.doc.db.removeMany({
            _id: {
              $in: [
                doc._id.replace(':draft', ':published'),
                doc._id.replace(':draft', ':previous')
              ]
            }
          });
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
              aposDocId: 1,
              title: 1
            }).toArray();
            throw self.apos.error('invalid', {
              unpublishedAncestors: draftAncestors.filter(draftAncestor => !publishedAncestors.find(publishedAncestor => draftAncestor.aposDocId === publishedAncestor.aposDocId))
            });
          }
        }
      },
      afterPublish: {
        async replayMoveAfterPublish(req, { published, firstTime }) {
          if (!firstTime) {
            // We already do this after every move of the draft, so
            // if there was already a published version it will have
            // already been moved
            return;
          }
          // Home page does not move
          if (published.aposLastTargetId) {
            return self.apos.page.move({
              ...req,
              mode: 'published'
            }, published._id, published.aposLastTargetId, published.aposLastPosition);
          }
        }
      },
      beforeUnpublish: {
        async descendantsMustNotBePublished(req, published) {
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
        }
      },
      afterRevertDraftToPublished: {
        async replayMoveAfterRevert(req, result) {
          const _req = {
            ...req,
            mode: 'draft'
          };
          if (!result.draft.level) {
            // The home page cannot move, so there is no
            // chance we need to "replay" such a move
            return;
          }
          await self.apos.page.move(_req, result.draft._id, result.draft.aposLastTargetId, result.draft.aposLastPosition);
          const draft = await self.apos.page.findOneForEditing(_req, {
            _id: result.draft._id
          });
          result.draft = draft;
        }
      },
      afterRevertPublishedToPrevious: {
        async replayMoveAfterRevert(req, result) {
          const publishedReq = {
            ...req,
            mode: 'published'
          };
          if (!result.published.level) {
            // The home page cannot move, so there is no
            // chance we need to "replay" such a move
            return;
          }
          await self.apos.page.move(publishedReq, result.published._id, result.published.aposLastTargetId, result.published.aposLastPosition);
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
          const descendants = await self.apos.doc.db.countDocuments({
            path: self.apos.page.matchDescendants(doc),
            aposLocale: doc.aposLocale
          });
          if (descendants) {
            throw self.apos.error('invalid', 'You must delete the children of this page first.');
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
          pattern: pattern,
          middleware: Array.prototype.slice.call(arguments, 1, arguments.length - 1),
          handler: arguments[arguments.length - 1],
          regexp: regexp,
          keys: keys
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
        const _req = {
          ...req,
          mode: 'draft'
        };
        if (doc.aposLastTargetId) {
          // Replay the high level positioning used to place it in the published locale
          return self.apos.page.insert(_req, doc.aposLastTargetId.replace(':published', ':draft'), doc.aposLastPosition, draft, options);
        } else if (!doc.level) {
          // Insert the home page
          return self.apos.doc.insert(_req, draft, options);
        } else {
          throw new Error('Page inserted without using the page APIs, has no aposLastTargetId and aposLastPosition, cannot insert equivalent draft');
        }
      },
      // Called for you when a page is inserted in
      // the published locale, to ensure there is an equivalent
      // draft page. You don't need to invoke this.
      async insertPublishedOf(req, doc, published, options = {}) {
        const _req = {
          ...req,
          mode: 'published'
        };
        if (doc.aposLastTargetId) {
          // Replay the high level positioning used to place it in the published locale
          return self.apos.page.insert(_req, doc.aposLastTargetId.replace(':draft', ':published'), doc.aposLastPosition, published, options);
        } else if (!doc.level) {
          // Insert the home page
          return self.apos.doc.db.insertOne(_req, published, options);
        } else {
          throw new Error('insertPublishedOf called on a page that was never inserted via the standard page APIs, has no aposLastTargetId and aposLastPosition, cannot insert equivalent published page');
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
  extendMethods(self) {
    return {
      copyForPublication(_super, req, from, to) {
        _super(req, from, to);
        const newMode = to.aposLocale.endsWith(':published') ? ':published' : ':draft';
        const oldMode = (newMode === ':published') ? ':draft' : ':published';
        // Home pages will not have this
        if (from.aposLastTargetId) {
          to.aposLastTargetId = from.aposLastTargetId.replace(oldMode, newMode);
          to.aposLastPosition = from.aposLastPosition;
        }
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
      }
    };
  }
};
