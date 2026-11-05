// The JSX version of `outerLayout.html`, used when the `jsx` option of
// @apostrophecms/template is set. Override it at project level to change
// the outer chrome. Its props are the blocks of `outerLayoutBase.jsx`, and
// all of them pass through to it unless you replace them.
export default function (_data, { Extend }) {
  return <Extend templateName='outerLayoutBase.jsx' />;
}
