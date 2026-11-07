// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ widget, options, manager }, { Component }) {
  const className = options?.className || manager?.options?.className;
  return (
    <div data-raw-html className={className || undefined}>
      <Component module='@apostrophecms/html-widget' name='render' {...widget} />
    </div>
  );
}
