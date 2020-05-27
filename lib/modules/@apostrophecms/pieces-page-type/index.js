// `@apostrophecms/pieces-page-type` implements "index pages" that display pieces of a
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
// If present, this is an array of objects with `name` properties. The named cursor filters are
// marked as `safeFor: "public"` if they exist, and an array of choices for each is populated
// in `req.data.piecesFilters`. The choices in the
// array are objects with `label` and `value` properties.
//
// If a filter configuration has a `counts` property set to `true`, then the array provided for
// that filter will also have a `count` property for each value. This has a performance
// impact.

const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/page-type',
  init(self, options) {
    self.label = self.options.label;
    self.perPage = options.perPage || 10;

    self.piecesModuleName = self.options.piecesModuleName || self.__meta.name.replace(/-pages$/, '');
    self.pieces = self.apos.modules[self.piecesModuleName];
    self.piecesCssName = self.apos.utils.cssName(self.pieces.name);

    self.piecesFilters = self.options.piecesFilters || [];

    self.contextMenu = options.contextMenu || [
      {
        action: 'create-' + self.piecesCssName,
        label: 'Create ' + self.pieces.label
      },
      {
        action: 'edit-' + self.piecesCssName,
        label: 'Update ' + self.pieces.label,
        value: true
      },
      {
        action: 'manage-' + self.piecesCssName,
        label: 'Manage ' + self.pieces.pluralLabel
      },
      {
        action: 'versions-' + self.piecesCssName,
        label: self.pieces.label + ' Versions',
        value: true
      },
      {
        action: 'trash-' + self.piecesCssName,
        label: 'Trash ' + self.pieces.label,
        value: true
      }
    ];

    self.publishMenu = options.publishMenu || [{
      action: 'publish-' + self.piecesCssName,
      label: 'Publish ' + self.pieces.label,
      value: true
    }];
    self.enableAddUrlsToPieces();
  },
  methods(self, options) {
    return {

      // Extend this method for your piece type to call additional
      // chainable filters by default. You should not add entirely new
      // filters here. For that, define the appropriate subclass of
      // `@apostrophecms/piece-type-cursor` in your subclass of
      // `@apostrophecms/piece-type`.

      indexCursor(req) {
        const cursor = self.pieces.find(req, {}).markBuildersSafe(_.map(self.piecesFilters, 'name')).applySafeBuilders(req.query, 'public').perPage(self.perPage);
        self.filterByIndexPage(cursor, req.data.page);
        return cursor;
      },

      // At the URL of the page, display an index view (list view) of
      // the pieces, with support for pagination.

      async indexPage(req) {

        if (self.pieces.contextual) {
          req.contextMenu = _.filter(self.contextMenu, function (item) {
            // Items specific to a particular piece don't make sense
            // on the index page
            return !item.value; // Add the standard items, they have to be available sometime
            // when working with an index page
          }).concat(self.apos.pages.options.contextMenu);
          req.publishMenu = _.filter(self.publishMenu, function (item) {
            // Items specific to a particular piece don't make sense
            // on the index page
            return !item.value;
          });
        }

        const cursor = self.indexCursor(req);

        await getFilters();
        await totalPieces();
        await findPieces();
        await self.beforeIndex(req);

        async function getFilters() {
          return self.populatePiecesFilters(cursor);
        }

        async function totalPieces() {
          const count = await cursor.toCount();
          if (cursor.get('page') > cursor.get('totalPages')) {
            req.notFound = true;
            return;
          }
          req.data.totalPieces = count;
          req.data.totalPages = cursor.get('totalPages');
        }

        async function findPieces() {
          const docs = await cursor.toArray();
          if (self.apos.utils.isAjaxRequest(req)) {
            self.setTemplate(req, 'indexAjax');
          } else {
            self.setTemplate(req, 'index');
          }
          req.data.currentPage = cursor.get('page');
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
      //
      // If the pieces module is set `contextual: true`, the context menu
      // (the gear at lower left) is updated appropriately if the user has
      // editing permissions.

      async showPage(req) {

        // We'll try to find the piece as an ordinary reader and, if the piece type
        // is contextual, we'll also try it as an editor if needed

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
        if (self.pieces.contextual) {
          req.contextMenu = _.map(self.contextMenu, function (item) {
            if (item.value) {
              // Don't modify a shared item, race conditions
              // could give us the wrong ids
              item = _.clone(item);
              item.value = doc._id;
            }
            return item;
          });
          req.publishMenu = _.map(self.publishMenu, function (item) {
            if (item.value) {
              // Don't modify a shared item, race conditions
              // could give us the wrong ids
              item = _.clone(item);
              item.value = doc._id;
            }
            return item;
          });
        }
        self.setTemplate(req, 'show');
        req.data.piece = doc;
        req.data.previous = previous;
        req.data.next = next;
        await self.beforeShow(req);

        async function findAsReader() {
          const cursor = self.pieces.find(req, { slug: req.params.slug });
          doc = await cursor.toObject();
        }

        async function findAsEditor() {
          if (doc || !req.user || !self.pieces.contextual) {
            return;
          }
          // Use findForEditing to allow subclasses to extend the set of filters that
          // don't apply by default in an editing context. -Tom
          const cursor = self.pieces.findForEditing(req, { slug: req.params.slug });
          doc = await cursor.toObject();
        }

        async function findPrevious() {
          if (!self.options.previous) {
            return;
          }
          if (!doc) {
            return;
          }
          const cursor = self.indexCursor(req);
          previous = await cursor.previous(doc).applyBuilders(typeof self.options.previous === 'object' ? self.options.previous : {}).toObject();
        }

        async function findNext() {
          if (!self.options.next) {
            return;
          }
          if (!doc) {
            return;
          }
          const cursor = self.indexCursor(req);
          next = await cursor.next(doc).applyBuidlers(typeof self.options.next === 'object' ? self.options.next : {}).toObject();
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
          self.apos.utils.warnDevOnce(`${self.__meta.name}/chooseParentPage`, `Your site has more than one ${self.name} page, but does not override the chooseParentPage method in ${self.__meta.name} to choose the right one for individual ${self.pieces.name}. You should also override filterByIndexPage. for ${self.pieces.name} will point to an arbitrarily chosen page.`);
        }
        return pages[0];
      },

      // Given an index page and a piece, build a complete URL to
      // the piece. If you override `dispatch` to change how
      // "show page" URLs are matched, you will also want to override
      // this method to build them differently.

      buildUrl(page, piece) {
        if (!page) {
          return false;
        }
        return page._url + '/' + piece.slug;
      },

      // Adds the `._url` property to all of the provided pieces,
      // which are assumed to be of the appropriate type for this module.
      // Aliased as the `addUrls` method of [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html), which
      // is invoked by the `addUrls` filter of [@apostrophecms/cursor](../@apostrophecms/docs/server-@apostrophecms/cursor.html).

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
            piece._url = self.buildUrl(parentPage, piece);
            piece._parentUrl = parentPage._url;
          }
        });
      },

      // Returns a cursor suitable for finding pieces-page-type for the
      // purposes of assigning URLs to pieces based on the best match.
      //
      // Should be as fast as possible while still returning enough
      // information to do that.
      //
      // The default implementation returns a cursor with areas
      // and joins shut off for speed but all properties included.

      findForAddUrlsToPieces(req) {
        return self.find(req).areas(false).joins(false);
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
      // cursor filter (note that most schema fields automatically get a
      // corresponding cursor filter method). Each filter's choices are
      // reduced by the other filters; for instance, "tags" might only reveal
      // choices not ruled out by the current "topic" filter setting.
      //
      // If a filter in the array has its `counts` property set to true,
      // Apostrophe will supply a `count` property for each distinct value,
      // whenever possible. This has a performance impact.

      async populatePiecesFilters(cursor) {
        const req = cursor.req;
        req.data.piecesFilters = req.data.piecesFilters || {};
        for (const filter of self.piecesFilters) {
          // The choices for each filter should reflect the effect of all filters
          // except this one (filtering by topic pares down the list of categories and
          // vice versa)
          const _cursor = cursor.clone();
          _cursor[filter.name](undefined);
          req.data.piecesFilters[filter.name] = await _cursor.toChoices(filter.name, _.pick(filter, 'counts'));
        }
      },

      getBrowserData(req) {
        if (self.pieces.options.contextual && req.data.piece) {
          return {
            contextPiece: _.pick(req.data.piece, '_id', 'title', 'slug', 'type')
          };
        } else {
          return {};
        }
      }
    };
  }
};
