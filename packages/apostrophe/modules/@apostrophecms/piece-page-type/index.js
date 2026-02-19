// `@apostrophecms/piece-page-type` implements "index pages" that display
// pieces of a particular type in a paginated, filterable way. It's great for
// implementing blogs, event listings, project listings, staff directories...
// almost any content type.
//
// You will `extend` this module in new modules corresponding to your modules
// that extend `@apostrophecms/piece-type`.
//
// To learn more and see complete examples, see:
//
// [Reusable content with
// pieces](../../tutorials/getting-started/reusable-content-with-pieces.html)
//
// ## Options
//
// ### `piecesFilters`
//
// If present, this is an array of objects with `name` properties. This works
// only if the corresponding query builders exist and have a `launder` method.
// An array of choices for each is populated in `req.data.piecesFilters`. The
// choices in the array are objects with `label` and `value` properties.
//
// If a filter configuration has a `counts` property set to `true`, then the
// array provided for that filter will also have a `count` property for each
// value. This has a performance impact.

const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/page-type',
  init(self) {
    self.label = self.options.label;
    self.perPage = self.options.perPage || 10;

    self.pieceModuleName = self.options.pieceModuleName || self.__meta.name.replace(/-page$/, '');
    self.pieces = self.apos.modules[self.pieceModuleName];
    self.piecesCssName = self.apos.util.cssName(self.pieces.name);

    self.piecesFilters = self.options.piecesFilters || [];

    self.enableAddUrlsToPieces();
  },
  methods(self) {
    const methods = {

      // Extend this method for your piece type to call additional
      // query builders by default.

      indexQuery(req) {
        const query = self.pieces
          .find(req, {})
          .applyBuildersSafely(req.query)
          .perPage(self.perPage);
        self.filterByIndexPage(query, req.data.page);
        return query;
      },

      // At the URL of the page, display an index view (list view) of
      // the pieces, with support for pagination.

      async indexPage(req) {

        const query = self.indexQuery(req);

        await getFilters();
        await totalPieces();
        await findPieces();
        await self.beforeIndex(req);

        async function getFilters() {
          return self.populatePiecesFilters(query);
        }

        async function totalPieces() {
          const count = await query.toCount();
          if (query.get('page') > query.get('totalPages')) {
            req.notFound = true;
            return;
          }
          req.data.totalPieces = count;
          req.data.totalPages = query.get('totalPages');
        }

        async function findPieces() {
          const docs = await query.toArray();
          if (self.apos.util.isAjaxRequest(req)) {
            self.setTemplate(req, 'indexAjax');
          } else {
            self.setTemplate(req, 'index');
          }
          req.data.currentPage = query.get('page');
          req.data.pieces = docs;
        }
      },

      // Called before `indexPage`. By default, does nothing.
      // A convenient way to extend the functionality.

      async beforeIndex(req) {
      },

      // Invokes query builders on the given query to ensure it only fetches
      // results appropriate to the given page. By default this method does
      // nothing, as it is quite common to have one pieces-page per piece type,
      // but if you have more than one you can override this method and
      // `chooseParentPage` to map particular pieces to particular pieces-pages.

      filterByIndexPage(query, page) {
      },

      // Extend this method for your piece type to call additional
      // query builders by default.

      showQuery(req) {
        return self.pieces.find(req, { slug: req.params.slug });
      },

      // Invoked to display a piece by itself, a "show page." Renders
      // the `show.html` template after setting `data.piece`.

      async showPage(req) {

        // We'll try to find the piece as an ordinary reader

        let doc;
        let previous;
        let next;

        await findAsReader();
        await findAsEditor();
        await findPrevious();
        await findNext();
        if (!doc) {
          req.notFound = true;
          return;
        }

        self.setTemplate(req, 'show');
        req.data.piece = doc;
        req.data.previous = previous;
        req.data.next = next;
        await self.beforeShow(req);

        async function findAsReader() {
          const query = self.showQuery(req);
          doc = await query.toObject();
        }

        async function findAsEditor() {
          // TODO: Is `contextual` still relevant?
          if (doc || !req.user || !self.pieces.contextual) {
            return;
          }
          // Use findForEditing to allow subclasses to extend the set of
          // filters that don't apply by default in an editing context. -Tom
          const query = self.pieces.findForEditing(req, { slug: req.params.slug });
          doc = await query.toObject();
        }

        async function findPrevious() {
          if (!self.options.previous) {
            return;
          }
          if (!doc) {
            return;
          }
          const query = self.indexQuery(req);
          previous = await query.previous(doc).applyBuilders(typeof self.options.previous === 'object' ? self.options.previous : {}).toObject();
        }

        async function findNext() {
          if (!self.options.next) {
            return;
          }
          if (!doc) {
            return;
          }
          const query = self.indexQuery(req);
          next = await query.next(doc).applyBuilders(typeof self.options.next === 'object' ? self.options.next : {}).toObject();
        }
      },

      // Invoked just before the piece is displayed on its "show page." By
      // default, does nothing. A useful override point.

      async beforeShow(req) {
      },

      // TODO dispatch routes should be a module format section
      //
      // Set the dispatch routes. By default, the bare URL of the page displays
      // the index view via `indexPage`; if the URL has an additional component,
      // e.g. `/blog/good-article`, it is assumed to be the slug of the
      // article and `showPage` is invoked. You can override this method,
      // for instance to also accept `/:year/:month/:day/:slug` as a way of
      // invoking `self.showPage`. See
      // [@apostrophecms/page-type](../@apostrophecms/page-type/index.html) for
      // more about what you can do with dispatch routes.

      dispatchAll() {
        self.dispatch('/', self.indexPage);
        if (self.apos.url.options.static) {
          // 1. SEO friendly pagination URLs
          self.dispatch('/page/:pagenum', req => {
            req.query.page = req.params.pagenum;
            return self.indexPage(req);
          });
          for (const filter of self.piecesFilters) {
            // 2. SEO friendly filter URLs
            self.dispatch(`/${filter.name}/:filterValue`, req => {
              req.query[filter.name] = req.params.filterValue;
              return self.indexPage(req);
            });
            // 3. SEO friendly filter + pagination URLs
            self.dispatch(`/${filter.name}/:filterValue/page/:pagenum`, req => {
              req.query[filter.name] = req.params.filterValue;
              req.query.page = req.params.pagenum;
              return self.indexPage(req);
            });
          }
        }
        self.dispatch('/:slug', self.showPage);
      },

      // This method is called for you. You should override it if you will have
      // more than one pieces-page on the site for a given type of piece.
      //
      // In the presence of pieces-pages, queries for the corresponding pieces
      // are automatically enhanced to invoke it when building the `_url`
      // property of each piece.
      //
      // Given an array containing all of the index pages of this type that
      // exist on the site and an individual piece, your override of this method
      // should return the index page that is the best fit for use in the URL of
      // the piece. By default this method returns the first page, but
      // warns if there is more than one page, as the developer should
      // override this method to map pieces to pages in the way that makes sense
      // for their design.

      chooseParentPage(pages, piece) {
        // Complain if this method is called with more than one page without an
        // extension to make it smart enough to presumably do something
        // intelligent in that situation. Don't complain though if this is just
        // a call to _super
        if (
          (self.originalChooseParentPage === self.chooseParentPage) &&
          (pages.length > 1)
        ) {
          self.apos.util.warnDevOnce(`${self.__meta.name}/chooseParentPage`, `Your site has more than one ${self.name} page, but does not extend the chooseParentPage\nmethod in ${self.__meta.name} to choose the right one for individual ${self.pieces.name}. You should also extend filterByIndexPage.\nOtherwise URLs for each ${self.pieces.name} will point to an arbitrarily chosen page.`);
        }
        return pages[0];
      },

      // Given req, an index page and a piece, build a complete URL to
      // the piece. If you override `dispatch` to change how
      // "show page" URLs are matched, you will also want to override
      // this method to build them differently.

      buildUrl(req, page, piece) {
        if (!page) {
          return false;
        }
        return self.apos.util.addSlashIfNeeded(page._url) + piece.slug;
      },

      // Adds the `._url` property to all of the provided pieces,
      // which are assumed to be of the appropriate type for this module.
      // Aliased as the `addUrls` method of
      // [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html).

      async addUrlsToPieces(req, results) {
        const pieceName = `${self.pieces.name}:${req.mode}`;
        if (!(req.aposParentPageCache && req.aposParentPageCache[pieceName])) {
          const pages = await self.findForAddUrlsToPieces(req).toArray();
          if (!req.aposParentPageCache) {
            req.aposParentPageCache = {};
          }
          req.aposParentPageCache[pieceName] = pages;
        }
        results.forEach(function (piece) {
          const parentPage = self.chooseParentPage(
            req.aposParentPageCache[pieceName] || [],
            piece
          );

          if (parentPage) {
            piece._url = self.buildUrl(req, parentPage, piece);
            piece._parent = self.pruneParent(parentPage);
            piece._parentUrl = parentPage._url;
            piece._parentSlug = parentPage.slug;
          }
        });
      },

      // The _parent property of a piece is useful for
      // breadcrumb navigation but we don't want it to lead
      // to runaway recursion etc., so make a shallow clone
      // of relevant properties only. Use extendMethods
      // if you want to return more (or less)
      pruneParent(parent) {
        return {
          _id: parent._id,
          aposDocId: parent.aposDocId,
          aposLocale: parent.aposLocale,
          aposMode: parent.aposMode,
          path: parent.path,
          level: parent.level,
          type: parent.type,
          title: parent.title,
          slug: parent.slug,
          // These are already pruned projections and
          // necessary for various types of navigation
          _ancestors: parent._ancestors,
          _children: parent._children
        };
      },

      // Returns a query suitable for finding pieces-page-type for the
      // purposes of assigning URLs to pieces based on the best match.
      //
      // Should be as fast as possible while still returning enough
      // information to do that.
      //
      // The default implementation returns a query with areas
      // and relationships shut off for speed but all properties included.

      findForAddUrlsToPieces(req) {
        return self.find(req).areas(false).relationships(false);
      },

      // Associates this module with the relevant piece type module
      // so that it knows to invoke our `addUrlsToPieces` method.
      // Also marks the piece type as previewable.

      enableAddUrlsToPieces() {
        self.pieces.addUrlsVia(self, true);
      },

      // Default implementation: we are ready to add URLs to pieces when we have
      // at least one reachable piece page. pieceTypeName is guaranteed to
      // always be our corresponding piece module name right now, however it is
      // provided in case a subclass chooses to invoke `addUrlsVia` for multiple
      // piece types
      async readyToAddUrlsToPieces(req, pieceTypeName) {
        return !!(await self.find(req, {}).areas(false).relationships(false).toObject());
      },

      // Populate `req.data.filters` based on the `piecesFilters` option.
      // Each entry in the option array must have a `name` property, and a
      // corresponding query builder with a `launder` method must exist
      // (note that most schema fields automatically get one).
      //
      // `req.data.filters` is an array of filter objects, each containing
      // the original configuration properties (e.g. `name`, `counts`) plus
      // a `choices` array. Each choice has `label`, `value`, `_url`, and
      // optionally `active` and `count` properties. Choices are reduced by
      // the other active filters; for instance, "tags" might only reveal
      // choices not ruled out by the current "topic" filter setting.
      //
      // If a filter has its `counts` property set to `true`, each choice
      // will also include a `count`. This has a performance impact.
      //
      // Legacy: `req.data.piecesFilters` is also populated as an object
      // keyed by filter name, where each value is that filter's choices
      // array. Still supported for backward compatibility but
      // `req.data.filters` is preferred.

      async populatePiecesFilters(query) {
        const req = query.req;
        const filtersWithChoices = await self.getFiltersWithChoices(query);
        req.data.filters = filtersWithChoices;
        // for bc (less useful)
        req.data.piecesFilters = {};
        for (const filter of filtersWithChoices) {
          req.data.piecesFilters[filter.name] = filter.choices;
        }
      },

      async getFiltersWithChoices(query, { allCounts = false } = {}) {
        const results = [];
        for (const filter of self.piecesFilters) {
          // The choices for each filter should reflect the effect of all
          // filters except this one (filtering by topic pares down the list of
          // categories and vice versa)
          const _query = query.clone();
          _query[filter.name](undefined);
          const countsOption = allCounts ? { counts: true } : _.pick(filter, 'counts');
          const choices = await _query.toChoices(filter.name, countsOption);
          for (const choice of choices) {
            if (query.req.data.page) {
              choice._url = query.req.data.page._url +
                self.apos.url.getChoiceFilter(filter.name, choice.value, 1);
            }
            if (query.req.query[filter.name] === choice.value) {
              choice.active = true;
            }
          }
          results.push({
            ...filter,
            choices
          });
        }
        return results;
      }
    };

    self.originalChooseParentPage = methods.chooseParentPage;
    return methods;
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const data = _super(req);
        // TODO: Is `contextual` still relevant?
        if (self.pieces.options.contextual && req.data.piece) {
          return {
            ...data,
            contextPiece: _.pick(req.data.piece, '_id', 'title', 'slug', 'type')
          };
        } else {
          return data;
        }
      },
      async getUrlMetadata(_super, req, doc) {
        const metadata = _super(req, doc);
        if (!metadata.length) {
          return metadata;
        }
        const [ pm ] = metadata;
        const query = self.indexQuery(req);
        const filters = await self.getFiltersWithChoices(query, { allCounts: true });

        // 1. Enumerate every filter + choice combination
        for (const filter of filters) {
          for (const choice of filter.choices) {
            const totalPages = Math.max(1, Math.ceil(choice.count / self.perPage));
            for (let p = 1; p <= totalPages; p++) {
              metadata.push({
                ...pm,
                i18nId: `${pm.i18nId}.${self.apos.util.slugify(filter.name)}.${self.apos.util.slugify(choice.value)}.${p}`,
                url: pm.url + self.apos.url
                  .getChoiceFilter(filter.name, choice.value, p)
              });
            }
          }
        }
        await query.toCount();
        const totalPages = query.get('totalPages');
        // 2. Enumerate pagination (starting at page 2; page 1 is the base URL)
        for (let p = 2; p <= totalPages; p++) {
          metadata.push({
            ...pm,
            i18nId: `${pm.i18nId}.${p}`,
            url: pm.url + self.apos.url.getPageFilter(p)
          });
        }
        return metadata;
      }
    };
  }
};
