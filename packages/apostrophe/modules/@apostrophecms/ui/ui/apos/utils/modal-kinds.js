// The kind of each modal on the stack, keyed by the component name the modal
// store keeps on its entry: `editor`, `manager` and so on (see `useScreen`).
// A kind is a name, or a function of the stack entry returning one, which
// may look at the entry's props to tell one use of a component from another
// (a manager opened for a relationship field is a chooser). A project names
// its own modals' kinds from an app with
// `apos.modal.kinds.add(componentName, kind)`; the last registration wins.
// A modal nobody registered is `other`.

const kinds = new Map();

export const modalKinds = {
  add(componentName, kind) {
    kinds.set(componentName, kind);
  },
  get(entry) {
    const kind = kinds.get(entry?.componentName);
    return ((typeof kind === 'function') ? kind(entry) : kind) || 'other';
  }
};

const core = {
  AposDocEditor: 'editor',
  AposWidgetEditor: 'widgetEditor',
  AposArrayEditor: 'arrayEditor',
  AposDocsManager: chooserOr('manager'),
  AposPagesManager: chooserOr('pageTree'),
  AposMediaManager: chooserOr('mediaManager'),
  AposRecentlyEditedManager: 'recentlyEdited',
  AposDocVersions: 'versions',
  AposI18nLocalize: 'localize',
  AposSettingsManager: 'settings'
};
for (const [ componentName, kind ] of Object.entries(core)) {
  modalKinds.add(componentName, kind);
}

function chooserOr(kind) {
  return entry => (entry.props?.relationshipField ? 'chooser' : kind);
}
