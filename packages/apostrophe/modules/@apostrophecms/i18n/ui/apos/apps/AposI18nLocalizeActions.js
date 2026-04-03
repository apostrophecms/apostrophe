export default () => {
  let once = false;

  apos.util.onReady(() => {
    if (once) {
      return;
    }
    once = true;

    apos.bus.$on('localize-open-document', openDocument);
    apos.bus.$on('localize-manage-documents', manageDocuments);
  });

  function openDocument(data) {
    if (!data) {
      return;
    }
    if (data._url) {
      window.open(data._url, '_blank');
      return;
    }
    const docModuleName = data.slug?.startsWith('/')
      ? '@apostrophecms/page'
      : data.type;
    if (!apos.modules[docModuleName]) {
      return;
    }
    const editorComponent = apos.modules[docModuleName]?.components?.editorModal || 'AposDocEditor';
    apos.modal.execute(editorComponent, {
      moduleName: docModuleName,
      docId: data._id,
      locale: data.locale
    });
  }

  function manageDocuments(data) {
    if (!data) {
      return;
    }
    apos.bus.$emit('admin-menu-click', {
      itemName: '@apostrophecms/recently-edited:manager',
      props: {
        initialFilters: {
          _action: [ 'localized' ],
          _locale: data.locales || []
        }
      }
    });
  }
};
