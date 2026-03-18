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
    rollingWindowDays: 30,
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
  async init(self) {
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
        }
      }
    };
  },
  methods(self) {
    return {
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
      async createIndexes() {
        await self.apos.doc.db.createIndex(
          {
            updatedAt: -1,
            type: 1,
            aposLocale: 1
          },
          { name: 'recentlyEditedLookup' }
        );
      }
    };
  },
  extendMethods(self) {
    return {
      find(_super, req, criteria, options) {
        const cutoff = new Date();
        cutoff.setDate(
          cutoff.getDate() - (self.options.rollingWindowDays || 30)
        );

        return _super(req, criteria, options)
          .type(null)
          .locale(null)
          .and({
            type: { $in: self.managedTypeNames },
            aposMode: 'draft',
            updatedAt: { $gte: cutoff }
          })
          .log(true)
          .sort({ updatedAt: -1 });
      },
      getBrowserData(_super, req) {
        const data = _super(req);
        return {
          ...data,
          managedTypes: self.managedTypes,
          batchOperations: [],
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
  icons: {
    'clock-outline-icon': 'ClockOutline'
  }
};
