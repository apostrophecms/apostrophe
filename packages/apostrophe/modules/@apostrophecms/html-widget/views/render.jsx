// The JSX version of `render.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ render, code }, { apos, __t }) {
  if (render === 'safeMode') {
    return __t('apostrophe:safeModeActive');
  }
  if (render) {
    return apos.template.safe(code);
  }
  return __t('apostrophe:refreshForRawHtml');
}
