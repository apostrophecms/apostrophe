export default () => {
  if (apos.i18n.crossDomainClipboard) {
    localStorage.setItem('aposWidgetClipboard', apos.i18n.crossDomainClipboard);
  }
};
