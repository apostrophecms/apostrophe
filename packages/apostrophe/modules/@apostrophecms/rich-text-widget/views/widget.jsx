// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ widget, options, manager }) {
  const className = options?.className || manager?.options?.className;
  return (
    <div
      data-rich-text
      className={className || undefined}
      dangerouslySetInnerHTML={{ __html: widget.content }}
    />
  );
}
