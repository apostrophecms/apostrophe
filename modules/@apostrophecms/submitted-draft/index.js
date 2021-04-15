// A virtual "piece type" that provides a way to manage
// all submitted drafts, both pieces and pages. Supports
// most write operations, passing them through to the
// appropriate manager for the document in question

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    quickCreate: false,
    label: 'Submitted Draft',
    pluralLabel: 'Submitted Drafts',
    managerHasNewButton: false
  },
  columns: {
    add: {
      title: {
        label: 'Title',
        component: 'AposCellButton'
      },
      type: {
        label: 'Type',
        // TODO need to push the choices somehow
        component: 'AposCellType'
      },
      'submitted.at': {
        label: 'Submitted'
      },
      'submitted.by': {
        label: 'Proposed By',
        component: 'AposCellDate'
      },
      lastPublishedAt: {
        label: 'Published',
        // TODO not a thing yet
        component: 'AposBooleanCellButton'
      },
      // Automatically hidden if none of the pieces
      // actually have a URL
      _url: {
        label: 'Link',
        component: 'AposCellLink'
      }
    },
    remove: [ 'updatedAt' ]
  },
  methods(self) {
    return {
      insert(req, piece, options) {
        throw new Error('Virtual piece type, should never be inserted');
      },
      update(req, piece, options) {
        // Virtual piece type, find the proper manager and use it
        const manager = self.apos.doc.getManager(piece.type);
        return manager.update(req, piece, options);
      },
      publish(req, piece, options) {
        // Virtual piece type, find the proper manager and use it
        const manager = self.apos.doc.getManager(piece.type);
        return manager.update(req, piece, options);
      },
      delete(req, piece, options) {
        // Virtual piece type, find the proper manager and use it
        const manager = self.apos.doc.getManager(piece.type);
        return manager.delete(req, piece, options);
      },
      revertDraftToPublished(req, piece, options) {
        // Virtual piece type, find the proper manager and use it
        const manager = self.apos.doc.getManager(piece.type);
        return manager.revertDraftToPublished(req, piece, options);
      }
    };
  },
  extendMethods(self) {
    return {
      find(_super, req, criteria, options) {
        return _super(req, criteria, options).type(null).and({
          submitted: {
            exists: 1
          }
        });
      }
    };
  }
};
