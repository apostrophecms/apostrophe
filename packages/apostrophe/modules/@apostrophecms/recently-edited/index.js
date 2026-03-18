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
    showPermissions: false,
    // 30-day window
    rollingWindowDays: 30,
    // Developer-configurable type exclusion
    excludeTypes: []
  },
  init(self) {
    self.enableBrowserData();
    self.addToAdminBar();
    self.addManagerModal();
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
      }
    };
  },
  icons: {
    'clock-outline-icon': 'ClockOutline'
  }
};
