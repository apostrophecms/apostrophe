// `@apostrophecms/piece-page-type` implements "index pages" that display pieces of a
// particular type in a paginated, filterable way. It's great for implementing
// blogs, event listings, project listings, staff directories... almost any
// content type.
//
// You will `extend` this module in new modules corresponding to your modules
// that extend `@apostrophecms/piece-type`.
//
// To learn more and see complete examples, see:
//
// [Reusable content with pieces](../../tutorials/getting-started/reusable-content-with-pieces.html)
//
// ## Options
//
// ### `piecesFilters`
//
// If present, this is an array of objects with `name` properties.This works only if the corresponding
// query builders exist and have a `launder` method. An array of choices for each is populated
// in `req.data.piecesFilters`. The choices in the
// array are objects with `label` and `value` properties.
//
// If a filter configuration has a `counts` property set to `true`, then the array provided for
// that filter will also have a `count` property for each value. This has a performance
// impact.

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
    return {

      // Extend this method for your piece type to call additional
      // query builders by default.

      indexQuery(req) {
        const query = self.pieces.find(req, {}).applyBuildersSafely(req.query).perPage(self.perPage);
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
      // results appropriate to the given page. By default this method does nothing,
      // as it is quite common to have one pieces-page per piece type, but if you have
      // more than one you can override this method and `chooseParentPage` to map particular
      // pieces to particular pieces-pages.

      filterByIndexPage(query, page) {
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
          const query = self.pieces.find(req, { slug: req.params.slug });
          doc = await query.toObject();
        }

        async function findAsEditor() {
          // TODO: Is `contextual` still relevant?
          if (doc || !req.user || !self.pieces.contextual) {
            return;
          }
          // Use findForEditing to allow subclasses to extend the set of filters that
          // don't apply by default in an editing context. -Tom
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

      // Invoked just before the piece is displayed on its "show page." By default,
      // does nothing. A useful override point.

      async beforeShow(req) {
      },

      // TODO dispatch routes should be a module format section
      //
      // Set the dispatch routes. By default, the bare URL of the page displays
      // the index view via `indexPage`; if the URL has an additional component,
      // e.g. `/blog/good-article`, it is assumed to be the slug of the
      // article and `showPage` is invoked. You can override this method,
      // for instance to also accept `/:year/:month/:day/:slug` as a way of
      // invoking `self.showPage`. See [@apostrophecms/page-type](../@apostrophecms/page-type/index.html)
      // for more about what you can do with dispatch routes.

      dispatchAll() {
        self.dispatch('/', self.indexPage);
        self.dispatch('/:slug', self.showPage);
      },

      // This method is called for you. You should override it if you will have
      // more than one pieces-page on the site for a given type of piece.
      //
      // In the presence of pieces-pages, queries for the corresponding pieces are
      // automatically enhanced to invoke it when building the `_url` property of each piece.
      //
      // Given an array containing all of the index pages of this type that
      // exist on the site and an individual piece, your override of this method
      // should return the index page that is the best fit for use in the URL of
      // the piece. By default this method returns the first page, but
      // warns if there is more than one page, as the developer should
      // override this method to map pieces to pages in the way that makes sense
      // for their design.

      chooseParentPage(pages, piece) {
        if (pages.length > 1) {
          self.apos.util.warnDevOnce(`${self.__meta.name}/chooseParentPage`, `Your site has more than one ${self.name} page, but does not override the chooseParentPage method in ${self.__meta.name} to choose the right one for individual ${self.pieces.name}. You should also override filterByIndexPage. for ${self.pieces.name} will point to an arbitrarily chosen page.`);
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
        return page._url + '/' + piece.slug;
      },

      // Adds the `._url` property to all of the provided pieces,
      // which are assumed to be of the appropriate type for this module.
      // Aliased as the `addUrls` method of [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html).

      async addUrlsToPieces(req, results) {
        const pieceName = self.pieces.name;
        if (!(req.aposParentPageCache && req.aposParentPageCache[pieceName])) {
          const pages = await self.findForAddUrlsToPieces(req).toArray();
          if (!req.aposParentPageCache) {
            req.aposParentPageCache = {};
          }
          req.aposParentPageCache[pieceName] = pages;
        }
        results.forEach(function (piece) {
          const parentPage = self.chooseParentPage(req.aposParentPageCache[pieceName], piece);
          if (parentPage) {
            piece._url = self.buildUrl(req, parentPage, piece);
            piece._parentUrl = parentPage._url;
          }
        });
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

      // Configure our `addUrlsToPieces` method as the `addUrls` method
      // of the related pieces module.

      enableAddUrlsToPieces() {
        self.pieces.setAddUrls(self.addUrlsToPieces);
      },

      // Populate `req.data.piecesFilters` with arrays of choice objects,
      // with label and value properties, for each filter configured in the
      // `piecesFilters` array option. Each filter in that array must have a
      // `name` property. Distinct values are fetched for the corresponding
      // query builder (note that most schema fields automatically get a
      // corresponding query builder method). Each filter's choices are
      // reduced by the other filters; for instance, "tags" might only reveal
      // choices not ruled out by the current "topic" filter setting.
      //
      // If a filter in the array has its `counts` property set to true,
      // Apostrophe will supply a `count` property for each distinct value,
      // whenever possible. This has a performance impact.

      async populatePiecesFilters(query) {
        const req = query.req;
        req.data.piecesFilters = req.data.piecesFilters || {};
        for (const filter of self.piecesFilters) {
          // The choices for each filter should reflect the effect of all filters
          // except this one (filtering by topic pares down the list of categories and
          // vice versa)
          const _query = query.clone();
          _query[filter.name](undefined);
          req.data.piecesFilters[filter.name] = await _query.toChoices(filter.name, _.pick(filter, 'counts'));
        }
      }
    };
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
      }
    };
  }
};
