/**
 * Utility functions for handling attachments and image related data.
 */

const MISSING_ATTACHMENT_URL = '/images/missing-icon.svg';

/**
 * Get the actual attachment object from either a full image object or direct attachment
 * @param {Object} attachmentObject - Either a full image object or direct attachment
 * @returns {Object|null} The attachment object
 */
function getAttachment(attachmentObject) {
  if (!attachmentObject) return null;

  // If it's a full image object (has _fields), get its attachment
  if (attachmentObject._fields) {
    return attachmentObject.attachment;
  }

  // If it's already an attachment or has nested attachment
  return attachmentObject.attachment || attachmentObject;
}

/**
 * Check if attachment has multiple size variants
 * @param {Object} attachmentObject - Either a full image object or direct attachment
 * @returns {boolean} True if the attachment has multiple sizes
 */
function isSized(attachmentObject) {
  const attachment = getAttachment(attachmentObject);
  if (!attachment) return false;

  if (attachment._urls && typeof attachment._urls === 'object') {
    return Object.keys(attachment._urls).length > 1;
  }

  return false;
}

/**
 * Get focal point coordinates from attachment or image, or return default value if invalid
 * @param {Object} attachmentObject - Either a full image object or direct attachment
 * @param {string} [defaultValue='center center'] - Default value to return if no valid focal point
 * @returns {string} String with focal point for styling (e.g., "50% 50%") or default value if invalid
 */
function getFocalPoint(attachmentObject, defaultValue = 'center center') {
  if (!attachmentObject) return defaultValue;

  // Check _fields if it's from a relationship
  if (attachmentObject._fields &&
      typeof attachmentObject._fields.x === 'number' &&
      attachmentObject._fields.x !== null &&
      typeof attachmentObject._fields.y === 'number' &&
      attachmentObject._fields.y !== null) {
    return `${attachmentObject._fields.x}% ${attachmentObject._fields.y}%`;
  }

  // Check attachment object directly if it's a direct attachment
  const attachment = getAttachment(attachmentObject);
  if (attachment &&
      typeof attachment.x === 'number' && 
      attachment.x !== null && 
      typeof attachment.y === 'number' && 
      attachment.y !== null) {
    return `${attachment.x}% ${attachment.y}%`;
  }

  return defaultValue;
}

/**
 * Get the width from the image object, using crop dimensions if available,
 * otherwise falling back to original image dimensions
 * @param {object} imageObject - Image object from ApostropheCMS
 * @returns {number|undefined} The width of the image
 */
function getWidth(imageObject) {
  // Use cropped width from _fields if available
  if (imageObject?._fields?.width !== undefined && imageObject._fields.width !== null) {
    return imageObject._fields.width;
  }
  // Fall back to original image width
  return imageObject?.attachment?.width;
}

/**
 * Get the height from the image object, using crop dimensions if available,
 * otherwise falling back to original image dimensions
 * @param {object} imageObject - Image object from ApostropheCMS
 * @returns {number|undefined} The height of the image
 */
function getHeight(imageObject) {
  // Use cropped height from _fields if available
  if (imageObject?._fields?.height !== undefined && imageObject._fields.height !== null) {
    return imageObject._fields.height;
  }
  // Fall back to original image height
  return imageObject?.attachment?.height;
}

/**
 * Get the crop parameters from the image object's _fields
 * @param {Object} imageObject - The full image object from ApostropheCMS
 * @returns {Object|null} The crop parameters or null if no crop exists
 */
function getCrop(imageObject) {
  // Check for crop parameters in _fields
  if (imageObject?._fields &&
      typeof imageObject._fields.left === 'number' &&
      typeof imageObject._fields.top === 'number' &&
      typeof imageObject._fields.width === 'number' &&
      typeof imageObject._fields.height === 'number') {
    return {
      left: imageObject._fields.left,
      top: imageObject._fields.top,
      width: imageObject._fields.width,
      height: imageObject._fields.height
    };
  }

  return null;
}

/**
 * Build the URL for an attachment with crop parameters and size
 * @param {string} baseUrl - The base URL for the attachment
 * @param {Object} crop - The crop parameters object
 * @param {string} [size] - The size variant name
 * @param {string} extension - The file extension
 * @returns {string} The complete URL with crop parameters
 */
function buildAttachmentUrl(baseUrl, crop, size, extension) {
  let url = baseUrl;

  // Add crop parameters if they exist
  if (crop) {
    url += `.${crop.left}.${crop.top}.${crop.width}.${crop.height}`;
  }

  // Add size if specified
  if (size && size !== 'original') {
    url += `.${size}`;
  }

  // Add extension
  url += `.${extension}`;

  return url;
}

/**
 * Get URL for an attachment with optional size
 * @param {Object} imageObject - The full image object from ApostropheCMS
 * @param {Object} [options={}] - Options object
 * @param {string} [options.size] - Size variant ('one-sixth', 'one-third', 
 *  'one-half', 'two-thirds', 'full', 'max', 'original')
 * @param {string} [options.missingIcon] - Custom URL for missing attachment (optional)
 * @returns {string} The URL for the attachment
 */
function getAttachmentUrl(imageObject, options = {}) {
  const attachment = getAttachment(imageObject);

  if (!attachment) {
    console.warn('Template warning: Missing attachment, using fallback icon');
    return options.missingIcon || MISSING_ATTACHMENT_URL;
  }

  // Get the requested size or default to 'full'
  const size = options.size || 'two-thirds';

  // Check if we're in the just-edited state (has uncropped URLs)
  if (attachment._urls?.uncropped) {
    // During the just-edited state, the main _urls already contain the crop parameters
    return attachment._urls[size] || attachment._urls.original;
  }

  // Get crop parameters from the image object's _fields
  const crop = getCrop(imageObject);

  // If we have _urls and no crop, use the pre-generated URL
  if (attachment._urls && !crop) {
    return attachment._urls[size] || attachment._urls.original;
  }

  // Derive the base URL path from _urls if available
  let baseUrl;
  if (attachment._urls?.original) {
    // Remove the extension from the original URL to get the base path
    baseUrl = attachment._urls.original.replace(`.${attachment.extension}`, '');
  }

  // Build the complete URL with crop parameters and size
  return buildAttachmentUrl(baseUrl, crop, size, attachment.extension);
}

/**
 * Generate a srcset for an image attachment
 * @param {Object} attachmentObject - Either a full image object or direct attachment
 * @param {Object} [options] - Options for generating the srcset
 * @param {Array} [options.sizes] - Array of custom size objects to override the default sizes
 * @param {string} options.sizes[].name - The name of the size (e.g., 'small', 'medium')
 * @param {number} options.sizes[].width - The width of the image for this size
 * @param {number} [options.sizes[].height] - The height of the image for this size (optional)
 * @returns {string} The srcset string
 */
function getAttachmentSrcset(attachmentObject, options = {}) {
  if (!attachmentObject || !isSized(attachmentObject)) {
    return '';
  }

  const defaultSizes = [
    { name: 'one-sixth', width: 190, height: 350 },
    { name: 'one-third', width: 380, height: 700 },
    { name: 'one-half', width: 570, height: 700 },
    { name: 'two-thirds', width: 760, height: 760 },
    { name: 'full', width: 1140, height: 1140 },
    { name: 'max', width: 1600, height: 1600}
  ];

  const sizes = options.sizes || defaultSizes;

  return sizes
    .map(size => `${getAttachmentUrl(attachmentObject, { ...options, size: size.name })} ${size.width}w`)
    .join(', ');
}

export {
  getFocalPoint,
  getWidth,
  getHeight,
  getAttachmentUrl,
  getAttachmentSrcset
};
