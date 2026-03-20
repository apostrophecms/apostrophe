// A virtual "piece type" that provides a cross-type manager
// for recently edited documents. It doesn't own documents but
// queries across all managed doc types. Write operations are
// delegated to each document's actual type manager.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'recentlyEdited',
    label: 'apostrophe:recentlyEdited',
    pluralLabel: 'apostrophe:recentlyEditedDocuments',
    quickCreate: false,
    showCreate: false,
    showArchive: false,
    showDiscardDraft: false,
    showDismissSubmission: false,
    showRestore: false,
    showUnpublish: false,
    showPermissions: false,
    // 30-day window
    rollingWindowDays: 300,
    // Developer-configurable type exclusion
    excludeTypes: [],
    perPage: 50,
    managerApiProjection: {
      title: 1,
      type: 1,
      slug: 1,
      updatedAt: 1,
      updatedBy: 1,
      aposLocale: 1,
      aposMode: 1,
      aposDocId: 1,
      visibility: 1,
      lastPublishedAt: 1,
      submitted: 1,
      aposPermissions: 1,
      _url: 1
    }
  },
  filters: {
    add: {
      _editedBy: {
        label: 'apostrophe:recentlyEditedEditedBy'
      },
      _docType: {
        label: 'apostrophe:type'
      },
      _action: {
        label: 'apostrophe:recentlyEditedAction'
      },
      _locale: {
        label: 'apostrophe:locale'
      },
      _status: {
        label: 'apostrophe:recentlyEditedStatus'
      }
    },
    remove: [ 'visibility', 'archived' ]
  },
  icons: {
    'clock-outline-icon': 'ClockOutline',
    'open-in-new-icon': 'OpenInNew'
  },
  async init(self) {
    self.actionFilterRegistry = {};
    self.statusFilterRegistry = {};
    self.managedTypes = [];
    self.managedTypeNames = [];
    self.managedPageTypeNames = [];
    self.managedPieceTypeNames = [];

    self.registerOwnFilterActions();
    self.registerOwnFilterStatuses();
    await self.createIndexes();
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        detectManagedTypes() {
          const internalExcludeTypes = [
            self.__meta.name,
            '@apostrophecms/submitted-draft',
            '@apostrophecms/archive-page'
          ];

          const userExcludeTypes = self.options.excludeTypes || [];
          const excludeSet = new Set([
            ...internalExcludeTypes,
            ...userExcludeTypes
          ]);

          const managers = Object.values(self.apos.doc.managers);
          self.managedTypes = managers
            .filter(manager => {
              if (!manager.__meta) {
                return false;
              }
              const name = manager.__meta.name;
              if (excludeSet.has(name)) {
                return false;
              }
              if (!manager.isLocalized?.()) {
                return false;
              }
              // Only concrete types: piece types and page types.
              // Excludes abstract bases like any-doc-type,
              // any-page-type, polymorphic-type.
              const isPiece = self.apos.instanceOf(
                manager, '@apostrophecms/piece-type'
              );
              const isPage = self.apos.instanceOf(
                manager, '@apostrophecms/page-type'
              );
              if (!isPiece && !isPage) {
                return false;
              }
              return true;
            })
            .map(manager => ({
              name: manager.__meta.name,
              label: manager.options.label || manager.__meta.name,
              pluralLabel: manager.options.pluralLabel ||
                manager.options.label ||
                manager.__meta.name
            }));
          self.managedTypeNames = self.managedTypes.map(t => t.name);

          // Cache page and piece type names for virtual group filters.
          const managedManagersByName = Object.fromEntries(
            managers
              .filter(m => m.__meta && self.managedTypeNames.includes(m.__meta.name))
              .map(m => [ m.__meta.name, m ])
          );
          self.managedPageTypeNames = self.managedTypeNames.filter(
            name => self.apos.instanceOf(
              managedManagersByName[name], '@apostrophecms/page-type'
            )
          );
          self.managedPieceTypeNames = self.managedTypeNames.filter(
            name => self.apos.instanceOf(
              managedManagersByName[name], '@apostrophecms/piece-type'
            )
          );
        }
      }
    };
  },
  methods(self) {
    return {
      // Register a new action for the Action filter dropdown.
      // External modules (e.g. import-export) can call this in their
      // own `modulesRegistered` handler to add actions like "imported".
      //
      // `name` - unique action identifier (e.g. 'imported')
      // `config.label` - i18n key for the dropdown choice label
      // `config.query` - function(queryBuilder) that applies filter criteria
      registerFilterAction(name, { label, query }) {
        self.actionFilterRegistry[name] = {
          label,
          query
        };
      },
      // Register a new status for the Status filter dropdown.
      // External modules (e.g. automatic-translation) can call this
      // in their `modulesRegistered` handler to add statuses like
      // "Unpublished Translations".
      //
      // `name` - unique status identifier (e.g. 'translated')
      // `config.label` - i18n key for the dropdown choice label
      // `config.query` - function(queryBuilder) that applies filter criteria.
      //   Can call queryBuilder.and(...) for criteria or override core
      //   builders like queryBuilder.archived(true). Runs early enough
      //   to override any core builder defaults.
      registerFilterStatus(name, { label, query }) {
        self.statusFilterRegistry[name] = {
          label,
          query
        };
      },
      // Calculate the cutoff date for recently edited documents based on the
      // rolling window setting. Can be used by external modules to provide
      // their own "recently X" filters that align with the same window.
      getCutoffDate() {
        const cutoff = new Date();
        cutoff.setDate(
          cutoff.getDate() - (self.options.rollingWindowDays || 30)
        );
        return cutoff;
      },
      addToAdminBar() {
        self.apos.adminBar.add(
          `${self.__meta.name}:manager`,
          self.pluralLabel,
          false,
          {
            component: 'AposRecentlyEditedIcon',
            contextUtility: true,
            tooltip: 'apostrophe:recentlyEditedDocuments'
          }
        );
      },
      addManagerModal() {
        self.apos.modal.add(
          `${self.__meta.name}:manager`,
          'AposRecentlyEditedManager',
          { moduleName: self.__meta.name }
        );
      },
      insert(req, piece, options) {
        throw new Error('Virtual piece type, should never be inserted');
      },
      update(req, piece, options) {
        const manager = self.apos.doc.getManager(piece.type);
        return manager.update(req, piece, options);
      },
      publish(req, piece, options) {
        const manager = self.apos.doc.getManager(piece.type);
        return manager.publish(req, piece, options);
      },
      delete(req, piece, options) {
        const manager = self.apos.doc.getManager(piece.type);
        return manager.delete(req, piece, options);
      },
      revertDraftToPublished(req, piece, options) {
        const manager = self.apos.doc.getManager(piece.type);
        return manager.revertDraftToPublished(req, piece, options);
      },
      async distinctFromQuery(query, property, options = {}) {
        const subquery = query.clone();
        subquery.skip(undefined);
        subquery.limit(undefined);
        subquery.page(undefined);
        subquery.perPage(undefined);
        if (subquery.choices) {
          subquery.choices(false);
        }
        if (subquery.counts) {
          subquery.counts(false);
        }
        if (options.permission) {
          subquery.and(
            self.apos.permission.criteria(query.req, options.permission)
          );
        }
        return subquery.toDistinct(property);
      },
      async createIndexes() {
        await self.apos.doc.db.createIndex(
          {
            updatedAt: -1,
            type: 1,
            aposLocale: 1
          },
          { name: 'recentlyEditedLookup' }
        );
      },
      registerOwnFilterActions() {
        self.registerFilterAction('created', {
          label: 'apostrophe:recentlyEditedActionCreated',
          query(queryBuilder) {
            queryBuilder.and({ createdAt: { $gte: self.getCutoffDate() } });
          }
        });
        self.registerFilterAction('published', {
          label: 'apostrophe:recentlyEditedActionPublished',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $gte: self.getCutoffDate() } });
          }
        });
        self.registerFilterAction('submitted', {
          label: 'apostrophe:recentlyEditedActionSubmitted',
          query(queryBuilder) {
            queryBuilder.and({ 'submitted.at': { $gte: self.getCutoffDate() } });
          }
        });
        self.registerFilterAction('localized', {
          label: 'apostrophe:recentlyEditedActionLocalized',
          query(queryBuilder) {
            queryBuilder.and({ localizedAt: { $gte: self.getCutoffDate() } });
          }
        });
      },
      registerOwnFilterStatuses() {
        self.registerFilterStatus('live', {
          label: 'apostrophe:live',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $exists: true } });
          }
        });
        self.registerFilterStatus('draft', {
          label: 'apostrophe:draft',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $exists: false } });
          }
        });
        self.registerFilterStatus('modified', {
          label: 'apostrophe:pendingUpdates',
          query(queryBuilder) {
            queryBuilder.and({
              lastPublishedAt: { $exists: true },
              $expr: {
                $gt: [ '$updatedAt', '$lastPublishedAt' ]
              }
            });
          }
        });
        self.registerFilterStatus('submitted', {
          label: 'apostrophe:recentlyEditedStatusSubmitted',
          query(queryBuilder) {
            queryBuilder.and({ 'submitted.at': { $exists: true } });
          }
        });
        self.registerFilterStatus('archived', {
          label: 'apostrophe:archived',
          query(queryBuilder) {
            queryBuilder.archived(true);
          }
        });
      }
    };
  },
  extendMethods(self) {
    return {
      find(_super, req, criteria, options) {
        // The manager projection contains no attachment, area, or
        // relationship fields, so disable their expensive
        // post-processing. `addUrls` is kept because `_url`
        // is projected.
        return _super(req, criteria, options)
          .type(null)
          .locale(null)
          .attachments(false)
          .areas(false)
          .relationships(false)
          .and({
            type: { $in: self.managedTypeNames },
            aposMode: 'draft',
            updatedAt: { $gte: self.getCutoffDate() }
          })
          .sort({ updatedAt: -1 });
      },
      // Inject the manager API projection into req.query before the
      // parent processes it via applyBuildersSafely. If the client
      // already sends a projection (e.g. { _id: 1 } for select-all),
      // it takes precedence.
      //
      // When `lean` is set, also disable URL resolution — the caller
      // wants lightweight results close to raw DB data.
      getRestQuery(_super, req) {
        if (!req.query.project) {
          const projection = self.getManagerApiProjection(req);
          if (projection) {
            req.query.project = projection;
          }
        }
        const query = _super(req);
        if (self.apos.launder.boolean(req.query.lean)) {
          query.addUrls(false);
        }
        return query;
      },
      getBrowserData(_super, req) {
        const data = _super(req);
        return {
          ...data,
          managedTypes: self.managedTypes,
          batchOperations: [],
          perPage: self.options.perPage,
          showRestore: self.options.showRestore,
          showUnpublish: self.options.showUnpublish,
          rollingWindowDays: self.options.rollingWindowDays,
          components: {
            managerModal: 'AposRecentlyEditedManager'
          }
        };
      }
    };
  },
  queries(self, query) {
    return {
      builders: {
        _docType: {
          def: null,
          launder(type) {
            return self.apos.launder.string(type);
          },
          finalize() {
            const value = query.get('_docType');
            if (!value) {
              return;
            }
            // Virtual group types expand to all page or piece types.
            if (value === '@apostrophecms/any-page-type') {
              if (self.managedPageTypeNames.length) {
                query.and({ type: { $in: self.managedPageTypeNames } });
              }
            } else if (value === '@apostrophecms/piece-type') {
              if (self.managedPieceTypeNames.length) {
                query.and({ type: { $in: self.managedPieceTypeNames } });
              }
            } else {
              query.and({ type: value });
            }
          },
          async choices() {
            const distinctTypes = await self.distinctFromQuery(query, 'type');
            const managedByName = Object.fromEntries(
              self.managedTypes.map(type => [ type.name, type ])
            );

            const typeChoices = distinctTypes
              .filter(type => managedByName[type])
              .map(type => ({
                value: type,
                label: managedByName[type].label
              }));

            // Add virtual group entries when more than one type
            // of that category has results — the group provides useful
            // narrowing. A single-type category needs no group shortcut.
            const pageCount = typeChoices.filter(
              c => self.managedPageTypeNames.includes(c.value)
            ).length;
            const pieceCount = typeChoices.filter(
              c => self.managedPieceTypeNames.includes(c.value)
            ).length;
            if (pageCount > 1) {
              typeChoices.push({
                value: '@apostrophecms/any-page-type',
                label: 'apostrophe:pages'
              });
            }
            if (pieceCount > 1) {
              typeChoices.push({
                value: '@apostrophecms/piece-type',
                label: 'apostrophe:pieces'
              });
            }

            return typeChoices;
          }
        },
        _editedBy: {
          def: null,
          launder(userId) {
            return self.apos.launder.string(userId);
          },
          finalize() {
            const value = query.get('_editedBy');
            if (value) {
              query.and({ 'updatedBy._id': value });
            }
          },
          async choices() {
            const users = await self.distinctFromQuery(query, 'updatedBy');

            return users
              .filter(user => user && user._id)
              .map(user => ({
                value: user._id,
                label: user.title || user.username || user._id
              }));
          }
        },
        _locale: {
          def: null,
          launder(locale) {
            return self.apos.launder.string(locale);
          },
          finalize() {
            const value = query.get('_locale');
            if (value) {
              query.and({ aposLocale: `${value}:draft` });
            }
          },
          async choices() {
            // Pass permission: 'edit' so distinctFromQuery applies
            // core permission criteria. Modules that extend
            // permission.criteria() (e.g. advanced-permission)
            // automatically filter by allowed locales.
            const distinctLocales = await self.distinctFromQuery(
              query, 'aposLocale', { permission: 'edit' }
            );
            const localesConfig = self.apos.i18n?.locales || {};
            const seen = new Set();

            return distinctLocales
              .filter(Boolean)
              .map(locale => locale.split(':')[0])
              .filter(locale => {
                if (!locale || seen.has(locale)) {
                  return false;
                }
                seen.add(locale);
                return true;
              })
              .map(locale => ({
                value: locale,
                label: localesConfig[locale]?.label
                  ? `${localesConfig[locale].label} (${locale})`
                  : locale
              }))
              .sort((a, b) => a.label.localeCompare(b.label));
          }
        },
        _status: {
          def: null,
          launder(status) {
            const laundered = self.apos.launder.string(status);
            return self.statusFilterRegistry[laundered] ? laundered : null;
          },
          prefinalize() {
            const value = query.get('_status');
            const status = self.statusFilterRegistry[value];
            if (status?.query) {
              status.query(query);
            }
          },
          choices() {
            return Object.entries(self.statusFilterRegistry).map(([ value, config ]) => ({
              value,
              label: config.label
            }));
          }
        },
        _action: {
          def: null,
          launder(action) {
            const laundered = self.apos.launder.string(action);
            return self.actionFilterRegistry[laundered] ? laundered : null;
          },
          prefinalize() {
            const value = query.get('_action');
            const action = self.actionFilterRegistry[value];
            if (action?.query) {
              action.query(query);
            }
          },
          choices() {
            return Object.entries(self.actionFilterRegistry).map(([ value, config ]) => ({
              value,
              label: config.label
            }));
          }
        }
      }
    };
  }
};
