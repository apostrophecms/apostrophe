// The JSX version of `widget.html` and the `render` fragment of
// `fragment.html`, used when the `jsx` option of @apostrophecms/template is
// set. `fragment.html` stays, for Nunjucks templates that import it. Keep
// the two in step; the parity tests compare them.
//
// Where the Nunjucks version joins a class name that may be missing to a
// suffix, it prints "false__caption", "undefined__link" and the like. So
// does this: the parity tests hold the two to the same output.

function Image({
  attachment, options, manager, contextOptions, helpers
}) {
  const attachments = helpers.modules['@apostrophecms/attachment'];
  const image = helpers.modules['@apostrophecms/image'];
  const className = options.className || manager.options.className;
  const dimensionAttrs = options.dimensionAttrs || manager.options.dimensionAttrs;
  const loadingType = options.loadingType || manager.options.loadingType;
  const size = options.size || manager.options.size || 'full';
  return (
    <img
      className={className || undefined}
      loading={loadingType || undefined}
      data-apos-test='image-widget'
      srcset={image.srcset(attachment) ?? ''}
      src={attachments.url(attachment, { size }) ?? ''}
      alt={attachment._alt || ''}
      width={(dimensionAttrs && attachment.width) ? (attachments.getWidth(attachment) ?? '') : undefined}
      height={(dimensionAttrs && attachment.height) ? (attachments.getHeight(attachment) ?? '') : undefined}
      sizes={(contextOptions && contextOptions.sizes) || undefined}
      style={attachments.hasFocalPoint(attachment)
        ? `object-position: ${attachments.focalPointToObjectPosition(attachment)}`
        : undefined}
    />
  );
}

function linked(widget, helpers) {
  const name = '_' + helpers.modules['@apostrophecms/util'].slugify(widget.linkTo);
  return widget[name]?.[0];
}

function linkUrl(widget, helpers) {
  if (widget.linkTo === '_url') {
    return widget.linkHref ?? '';
  }
  return linked(widget, helpers)?._url ?? '';
}

function linkTitle(widget, helpers) {
  if (widget.linkTo === '_url') {
    return widget.linkHrefTitle || widget.caption || '';
  }
  return widget.linkTitle || linked(widget, helpers)?.title || '';
}

function ImageWithLink({
  widget, attachment, options, manager, contextOptions, helpers
}) {
  const image = (
    <Image
      attachment={attachment}
      options={options}
      manager={manager}
      contextOptions={contextOptions}
      helpers={helpers}
    />
  );
  if (!widget.linkTo || (widget.linkTo === 'none')) {
    return image;
  }
  const className = options.className || manager.options.className;
  const target = widget.linkTarget?.[0];
  return (
    <a
      href={String(linkUrl(widget, helpers)).trim()}
      title={String(linkTitle(widget, helpers)).trim()}
      className={`${className}__link`}
      target={target ? String(target).trim() : undefined}
      rel={((target === '_blank') && (widget.linkTo === '_url')) ? 'noopener noreferrer' : undefined}
    >
      {image}
    </a>
  );
}

function figureStyle(options, manager) {
  if (options.inlineStyles === true) {
    return 'margin: 0;';
  }
  if ((options.inlineStyles !== false) && (manager.options.inlineStyles === true)) {
    return 'margin: 0;';
  }
  return '';
}

export default function ({
  widget, options = {}, manager = {}, contextOptions = {}
}, { helpers, __t }) {
  options = options || {};
  const attachment = helpers.modules['@apostrophecms/image'].first(widget._image);
  if (widget.aposPlaceholder && manager.options.placeholderUrl) {
    return (
      <img
        src={manager.options.placeholderUrl}
        alt={__t('apostrophe:imagePlaceholder')}
        className='image-widget-placeholder'
      />
    );
  }
  if (!attachment) {
    return null;
  }
  const className = options.className || manager.options.className;
  return (
    <figure
      className={className ? `${className}__wrapper` : undefined}
      style={figureStyle(options, manager)}
    >
      <ImageWithLink
        widget={widget}
        attachment={attachment}
        options={options}
        manager={manager}
        contextOptions={contextOptions}
        helpers={helpers}
      />
      {widget.caption && (
        <figcaption className={`${className}__caption`}>
          {widget.caption}
        </figcaption>
      )}
    </figure>
  );
}
