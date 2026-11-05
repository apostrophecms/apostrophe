// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ widget }, { Area }) {
  return <Area doc={widget} name='content' />;
}
