function getImageData(imageRelationship) {
  if (!imageRelationship?.[0]) {
    return null;
  }

  const img = imageRelationship[0];
  const attachment = img.attachment;

  if (!attachment?._urls) {
    return null;
  }

  return {
    url: attachment._urls.original || attachment._urls.full,
    alt: img.alt || attachment.title || '',
    width: attachment.width,
    height: attachment.height,
    _urls: attachment._urls
  };
}

module.exports = {
  getImageData
};
