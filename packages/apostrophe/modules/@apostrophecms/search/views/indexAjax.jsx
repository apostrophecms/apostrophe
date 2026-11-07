// The JSX version of `indexAjax.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ docs }, { Template }) {
  return <Template templateName='@apostrophecms/search:results.jsx' docs={docs} />;
}
