// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ widget, options, manager }, { __t }) {
  const className = options?.className || manager?.options?.className;
  const file = widget._file?.[0];
  return (
    <div className={className || undefined}>
      {file
        ? <a href={file._url ?? ''} download>{file.title}</a>
        : __t('apostrophe:noFileSelected')}
    </div>
  );
}
