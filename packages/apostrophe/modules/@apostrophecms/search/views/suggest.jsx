// The JSX version of `suggest.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ docs }, { Template, __t }) {
  if (!(docs && docs.length)) {
    return null;
  }
  return (
    <>
      <h3>{__t('apostrophe:suggestionsHeader')}</h3>
      <Template templateName='@apostrophecms/search:results.jsx' docs={docs} />
    </>
  );
}
