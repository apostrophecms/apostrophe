function getTags(data, apos) {
  const nodes = [];

  // Determine context (piece or page)
  const context = data.piece || data.page;
  if (!context) {
    return nodes;
  }

  // Set Open Graph URL
  const openGraphUrl = context._url;

  // Set Open Graph Title
  const openGraphTitle = context.openGraphTitle || context.title;

  // Set Open Graph Description
  const openGraphDescription = context.openGraphDescription;

  // Set Open Graph Type
  const openGraphType = context.openGraphType;

  // Set Open Graph Image
  let openGraphImagePath;
  if (context._openGraphImage) {
    const attachment = apos.image.first(context._openGraphImage);
    if (attachment) {
      openGraphImagePath = apos.attachment.url(attachment, { size: 'max' });
    }
  }

  // Create meta tags as node objects

  if (openGraphUrl) {
    nodes.push({
      name: 'meta',
      attrs: {
        property: 'og:url',
        content: openGraphUrl
      }
    });
  }

  nodes.push({
    name: 'meta',
    attrs: {
      property: 'og:type',
      content: openGraphType || 'website'
    }
  });

  if (openGraphTitle) {
    nodes.push({
      name: 'meta',
      attrs: {
        property: 'og:title',
        content: openGraphTitle
      }
    });
  }

  if (openGraphDescription) {
    nodes.push({
      name: 'meta',
      attrs: {
        property: 'og:description',
        content: openGraphDescription
      }
    });
  }

  if (openGraphImagePath) {
    nodes.push({
      name: 'meta',
      attrs: {
        property: 'og:image',
        content: openGraphImagePath
      }
    });
  }

  return nodes;
}

module.exports = {
  getTags
};
