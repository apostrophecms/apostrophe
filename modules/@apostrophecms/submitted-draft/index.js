// A virtual "piece type" that provides a way to manage
// all submitted drafts, both pieces and pages. Supports
// most write operations, passing them through to the
// appropriate manager for the document in question

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    quickCreate: false,
    label: 'apostrophe:submittedDraft',
    pluralLabel: 'Submitted Drafts',
    canCreate: false,
    showDismissSubmission: true,
    showArchive: false,
    showDiscardDraft: false,
    // Never mention this type at all in the permissions interface,
    // not even on a list of typical piece types
    showPermissions: false
  },
  columns: {
    add: {
      title: {
        label: 'apostrophe:title',
        component: 'AposCellButton'
      },
      type: {
        label: 'apostrophe:type',
        // TODO need to push the choices somehow
        component: 'AposCellType'
      },
      'draft:submitted.at': {
        label: 'apostrophe:submitted',
        component: 'AposCellLastEdited'
      },
      'draft:submitted.by': {
        label: 'apostrophe:user',
        component: 'AposCellBasic'
      }
    },
    remove: [ 'updatedAt', 'visibility' ],
    order: [ 'title', 'type', 'draft:submitted.at', 'draft:submitted.by' ]
  },

  fields: {
    add: {
      _type: {
        label: 'apostrophe:type',
        type: 'select',
        // Patched later
        choices: []
      }
    }
  },

  filters: {
    add: {
      _type: {
        label: 'apostrophe:type'
      }
    }
  },

  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        patchTypeField() {
          const typeField = self.schema.find(field => field.name === '_type');
          const managers = Object.values(self.apos.doc.managers);
          typeField.choices = managers.filter(manager => manager.isLocalized() && !manager.options.autopublish).map(manager => ({
            label: manager.options.label || manager.name || manager.__meta.name,
            value: manager.name || manager.__meta.name
          }));
        }
      }
    };
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
        return manager.publish(req, piece, options);
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
      },
      addToAdminBar() {
        self.apos.adminBar.add(
          `${self.__meta.name}:manager`,
          self.pluralLabel,
          {
            action: 'edit',
            type: self.name
          },
          {
            component: 'AposSubmittedDraftIcon',
            contextUtility: true,
            tooltip: 'Submitted Drafts'
          }
        );
      }
    };
  },
  icons: {
    'tray-full-icon': 'TrayFull'
  },
  extendMethods(self) {
    return {
      find(_super, req, criteria, options) {
        const query = _super(req, criteria, options).type(null).and({
          submitted: {
            $exists: 1
          }
        });
        if (!self.apos.permission.can(req, 'publish', self.name)) {
          query.and({
            'submitted.byId': req.user && req.user._id
          });
        }
        return query;
      }
    };
  },
  queries(self, query) {
    return {
      builders: {
        _type: {
          def: null,
          launder(type) {
            return self.apos.launder.string(type);
          },
          finalize() {
            const state = query.get('_type');
            if (state) {
              query.and({
                type: state
              });
            }
          },
          async choices() {
            const values = await query.toDistinct('type');
            return values.map(name => {
              const manager = self.apos.doc.getManager(name);
              return {
                value: name,
                label: (manager && manager.options.label) || name
              };
            });
          }
        }
      }
    };
  }
};
