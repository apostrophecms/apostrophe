// High-level conveniences for working with documents in Apostrophe
// on the front end, so that developers need only know the document
// type they want and do not have to look up modal names in module
// configuration etc.

export default () => {
  // Create or edit a document. `type` must be the document type, or
  // `@apostrophecms/page`.
  //
  // `_id` should be the `_id` of the existing document to edit; leave
  // blank to create a new document.
  //
  // `copyOf` is an optional, existing document from which properties should be copied.
  //
  // On success, returns the new or updated document. If the modal is cancelled,
  // `undefined` is returned. Be sure to `await` the result.
  apos.doc.edit = async ({
    type,
    _id,
    copyOf
  }) => {
    if (!type) {
      throw new Error('You must specify the type of document to edit.');
    }
    if (apos.page.validPageTypes.includes(type)) {
      type = '@apostrophecms/page';
    }
    const modal = apos.modules[type]?.components?.editorModal;
    if (!modal) {
      throw new Error(`${type} is not a valid piece or page type, or cannot be edited`);
    }
    return apos.modal.execute(modal, {
      moduleName: type,
      docId: _id,
      copyOf
    });
  };
  // If you don't care about the returned value, you can emit an
  // 'edit' apostrophe event with the same object you would pass to
  // apos.doc.edit().
  apos.bus.$on('edit', apos.doc.edit);
};
