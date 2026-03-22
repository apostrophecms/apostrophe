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
    recentDays: 300,
    // Developer-configurable type exclusion
    excludeTypes: [],
    perPage: 50,
    managerApiProjection: {
      updatedAt: 1,
      updatedBy: 1,
      archived: 1,
      modified: 1,
      parked: 1,
      lastPublishedAt: 1,
      submitted: 1,
      aposPermissions: 1
    }
  },
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:manager`]: {
          type: 'item',
          label: self.options.label,
          action: {
            type: 'admin-menu-click',
            payload: {
              itemName: `${self.__meta.name}:manager`
            }
          },
          shortcut: 'T,R'
        },
        [`${self.__meta.name}:search`]: {
          type: 'item',
          label: 'apostrophe:commandMenuSearch',
          action: {
            type: 'command-menu-manager-focus-search'
          },
          shortcut: 'Ctrl+F Meta+F'
        },
        [`${self.__meta.name}:select-all`]: {
          type: 'item',
          label: 'apostrophe:commandMenuSelectAll',
          action: {
            type: 'command-menu-manager-select-all'
          },
          shortcut: 'Ctrl+Shift+A Meta+Shift+A'
        },
        [`${self.__meta.name}:exit-manager`]: {
          type: 'item',
          label: 'apostrophe:commandMenuExitManager',
          action: {
            type: 'command-menu-manager-close'
          },
          shortcut: 'Q'
        }
      },
      remove: [
        `${self.__meta.name}:create-new`,
        `${self.__meta.name}:archive-selected`
      ],
      modal: {
        default: {
          '@apostrophecms/command-menu:taskbar': {
            label: 'apostrophe:commandMenuTaskbar',
            commands: [
              `${self.__meta.name}:manager`
            ]
          }
        },
        [`${self.__meta.name}:manager`]: {
          '@apostrophecms/command-menu:manager': {
            label: 'apostrophe:commandMenuManager',
            commands: [
              `${self.__meta.name}:search`,
              `${self.__meta.name}:select-all`,
              `${self.__meta.name}:exit-manager`
            ]
          },
          '@apostrophecms/command-menu:general': {
            label: 'apostrophe:commandMenuGeneral',
            commands: [
              '@apostrophecms/command-menu:show-shortcut-list'
            ]
          }
        }
      }
    };
  },
  filters: {
    add: {
      _editedBy: {
        label: 'apostrophe:recentlyEditedEditedBy'
      },
      _docType: {
        label: 'apostrophe:type',
        inputType: 'checkbox'
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
  async init(self) {
    self.filterChoiceRegistry = {
      action: {},
      status: {}
    };
    self.managedTypes = [];
    self.managedTypeNames = [];
    self.managedPageTypeNames = [];
    self.managedPieceTypeNames = [];

    self.addOwnFilterChoices();
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
      // Register a new choice for a filter dropdown (Action or Status).
      // External modules can call this in their `modulesRegistered` handler.
      //
      // `type` - 'action' or 'status'
      // `name` - unique choice identifier (e.g. 'imported', 'translated')
      // `label` - i18n key for the dropdown choice label
      // `query` - function(queryBuilder) that applies filter criteria
      addFilterChoice({
        type, name, label, query
      }) {
        if (type !== 'action' && type !== 'status') {
          throw new Error(`addFilterChoice: type must be "action" or "status", got "${type}"`);
        }
        self.filterChoiceRegistry[type][name] = {
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
          cutoff.getDate() - (self.options.recentDays || 30)
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
            _id: 1,
            type: 1,
            aposLocale: 1
          },
          { name: 'recentlyEditedLookup' }
        );
      },
      addOwnFilterChoices() {
        self.addFilterChoice({
          type: 'action',
          name: 'created',
          label: 'apostrophe:recentlyEditedActionCreated',
          query(queryBuilder) {
            queryBuilder.and({ createdAt: { $gte: self.getCutoffDate() } });
          }
        });
        self.addFilterChoice({
          type: 'action',
          name: 'published',
          label: 'apostrophe:recentlyEditedActionPublished',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $gte: self.getCutoffDate() } });
          }
        });
        self.addFilterChoice({
          type: 'action',
          name: 'submitted',
          label: 'apostrophe:recentlyEditedActionSubmitted',
          query(queryBuilder) {
            queryBuilder.and({ 'submitted.at': { $gte: self.getCutoffDate() } });
          }
        });
        self.addFilterChoice({
          type: 'action',
          name: 'localized',
          label: 'apostrophe:recentlyEditedActionLocalized',
          query(queryBuilder) {
            queryBuilder.and({ localizedAt: { $gte: self.getCutoffDate() } });
          }
        });
        self.addFilterChoice({
          type: 'status',
          name: 'live',
          label: 'apostrophe:live',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $exists: true } });
          }
        });
        self.addFilterChoice({
          type: 'status',
          name: 'draft',
          label: 'apostrophe:draft',
          query(queryBuilder) {
            queryBuilder.and({ lastPublishedAt: { $exists: false } });
          }
        });
        self.addFilterChoice({
          type: 'status',
          name: 'modified',
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
        self.addFilterChoice({
          type: 'status',
          name: 'submitted',
          label: 'apostrophe:recentlyEditedStatusSubmitted',
          query(queryBuilder) {
            queryBuilder.and({ 'submitted.at': { $exists: true } });
          }
        });
        self.addFilterChoice({
          type: 'status',
          name: 'archived',
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
          .sort({
            updatedAt: -1,
            _id: 1
          });
      },
      // Inject the manager API projection into req.query before the
      // parent processes it via applyBuildersSafely. If the client
      // already sends a projection (e.g. { _id: 1 } for select-all),
      // it takes precedence. This avoids unnecessarily data round-tripping.
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
          rollingWindowDays: self.options.recentDays,
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
          launder(value) {
            const allowed = new Set([
              ...self.managedTypeNames,
              '@apostrophecms/any-page-type',
              '@apostrophecms/piece-type'
            ]);
            const raw = Array.isArray(value)
              ? self.apos.launder.strings(value)
              : [ self.apos.launder.string(value) ].filter(Boolean);
            return raw.filter(v => allowed.has(v));
          },
          finalize() {
            const value = query.get('_docType');
            if (!value || !value.length) {
              return;
            }
            const resolved = [];
            for (const v of value) {
              if (v === '@apostrophecms/any-page-type') {
                resolved.push(...self.managedPageTypeNames);
              } else if (v === '@apostrophecms/piece-type') {
                resolved.push(...self.managedPieceTypeNames);
              } else {
                resolved.push(v);
              }
            }
            if (resolved.length) {
              query.and({ type: { $in: [ ...new Set(resolved) ] } });
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
            const value = self.apos.launder.string(locale);
            if (value && self.apos.i18n.locales[value]) {
              return value;
            }
            return null;
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
            return self.filterChoiceRegistry.status[laundered] ? laundered : null;
          },
          prefinalize() {
            const value = query.get('_status');
            const status = self.filterChoiceRegistry.status[value];
            if (status?.query) {
              status.query(query);
            }
          },
          choices() {
            return Object.entries(
              self.filterChoiceRegistry.status
            ).map(([ value, config ]) => ({
              value,
              label: config.label
            }));
          }
        },
        _action: {
          def: null,
          launder(action) {
            const laundered = self.apos.launder.string(action);
            return self.filterChoiceRegistry.action[laundered] ? laundered : null;
          },
          prefinalize() {
            const value = query.get('_action');
            const action = self.filterChoiceRegistry.action[value];
            if (action?.query) {
              action.query(query);
            }
          },
          choices() {
            return Object.entries(
              self.filterChoiceRegistry.action
            ).map(([ value, config ]) => ({
              value,
              label: config.label
            }));
          }
        }
      }
    };
  }
};
