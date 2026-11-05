// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({
  widget, options, manager, user
}) {
  if (widget.aposPlaceholder && manager.options.placeholderUrl) {
    return (
      <div
        data-apos-video-widget
        data-apos-video-url={manager.options.placeholderUrl}
      ></div>
    );
  }
  if (widget.aposPlaceholder) {
    return null;
  }
  const className = options?.className || manager.options.className;
  // oembed repopulates me
  if (widget.video) {
    return (
      <div
        className={className || undefined}
        data-apos-video-widget
        data-apos-video-url={widget.video.url ?? ''}
      ></div>
    );
  }
  if (user) {
    const errorClass = manager.options.className;
    return (
      <p className={errorClass ? `${errorClass} ${errorClass}--error` : undefined}>No video selected</p>
    );
  }
  return null;
}
