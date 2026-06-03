/**
 * Attachment and image URL helpers.
 *
 * Pure utilities for working with ApostropheCMS attachment and image
 * objects. These helpers have no environment dependencies and work in
 * both server and client contexts.
 */

const MISSING_ATTACHMENT_URL = '/images/missing-icon.svg';

/**
 * Get the actual attachment object from either a full image object or
 * a direct attachment.
 *
 * @param {object} attachmentObject - Either a full image object (with `_fields`)
 *   or a direct attachment object.
 * @returns {object|null}
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
 * Check if attachment has multiple size variants.
 *
 * @param {object} attachmentObject - Either a full image object or direct attachment.
 * @returns {boolean} True if the attachment has multiple sizes.
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
 * Get focal point coordinates from an attachment or image object.
 *
 * Returns a CSS `object-position`-compatible string such as `"50% 75%"`.
 * Falls back to `defaultValue` when no valid focal point is found.
 *
 * @param {object} attachmentObject - Either a full image object or direct attachment.
 * @param {string} [defaultValue='center center'] - Value to return when no
 *   focal point is set.
 * @returns {string} Focal point string for use in CSS (e.g. `"50% 50%"`).
 *
 * @example
 * ```astro
 * ---
 * import { getFocalPoint } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <img style={`object-position: ${getFocalPoint(image)}`} ... />
 * ```
 */
export function getFocalPoint(attachmentObject, defaultValue = 'center center') {
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
 * Get the width from an image object.
 *
 * Uses crop dimensions from `_fields` when available, otherwise falls
 * back to the original attachment dimensions.
 *
 * @param {object} imageObject - Image object from ApostropheCMS.
 * @returns {number|undefined} The width in pixels, or `undefined` if unavailable.
 *
 * @example
 * ```astro
 * ---
 * import { getWidth } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <img width={getWidth(image)} ... />
 * ```
 */
export function getWidth(imageObject) {
  // Use cropped width from _fields if available
  if (imageObject?._fields?.width !== undefined && imageObject._fields.width !== null) {
    return imageObject._fields.width;
  }
  // Fall back to original image width
  return imageObject?.attachment?.width;
}

/**
 * Get the height from an image object.
 *
 * Uses crop dimensions from `_fields` when available, otherwise falls
 * back to the original attachment dimensions.
 *
 * @param {object} imageObject - Image object from ApostropheCMS.
 * @returns {number|undefined} The height in pixels, or `undefined` if unavailable.
 *
 * @example
 * ```astro
 * ---
 * import { getHeight } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <img height={getHeight(image)} ... />
 * ```
 */
export function getHeight(imageObject) {
  // Use cropped height from _fields if available
  if (imageObject?._fields?.height !== undefined && imageObject._fields.height !== null) {
    return imageObject._fields.height;
  }
  // Fall back to original image height
  return imageObject?.attachment?.height;
}

/**
 * Get the crop parameters from an image object's `_fields`.
 *
 * @param {object} imageObject - The full image object from ApostropheCMS.
 * @returns {{ left: number, top: number, width: number, height: number }|null}
 */
function getCrop(imageObject) {
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
 * Build the URL for an attachment with crop parameters and size.
 *
 * @param {string} baseUrl - The base URL for the attachment (without extension).
 * @param {{ left: number, top: number, width: number, height: number }|null} crop
 * @param {string} [size] - The size variant name.
 * @param {string} extension - The file extension.
 * @returns {string}
 */
function buildAttachmentUrl(baseUrl, crop, size, extension) {
  let url = baseUrl;

  if (crop) {
    url += `.${crop.left}.${crop.top}.${crop.width}.${crop.height}`;
  }

  if (size && size !== 'original') {
    url += `.${size}`;
  }

  url += `.${extension}`;
  return url;
}

/**
 * Get the URL for an attachment at an optional size variant.
 *
 * Handles the full-image object and direct attachment forms, crop
 * parameters from `_fields`, and the "just-edited" state where the
 * backend provides uncropped URLs.
 *
 * @param {object} imageObject - The full image object from ApostropheCMS.
 * @param {object} [options={}] - Options.
 * @param {string} [options.size='two-thirds'] - Size variant. One of:
 *   `'one-sixth'`, `'one-third'`, `'one-half'`, `'two-thirds'`,
 *   `'full'`, `'max'`, `'original'`.
 * @param {string} [options.missingIcon] - Custom URL for missing attachments.
 * @returns {string} The URL for the attachment.
 *
 * @example
 * ```astro
 * ---
 * import { getAttachmentUrl } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <img src={getAttachmentUrl(image, { size: 'full' })} />
 * ```
 */
export function getAttachmentUrl(imageObject, options = {}) {
  const attachment = getAttachment(imageObject);

  if (!attachment) {
    console.warn('Template warning: Missing attachment, using fallback icon');
    return options.missingIcon || MISSING_ATTACHMENT_URL;
  }

  const size = options.size || 'two-thirds';

  // During the just-edited state, _urls already contain crop parameters
  if (attachment._urls?.uncropped) {
    return attachment._urls[size] || attachment._urls.original;
  }

  const crop = getCrop(imageObject);

  // If no crop, use the pre-generated URL
  if (attachment._urls && !crop) {
    return attachment._urls[size] || attachment._urls.original;
  }

  // Derive the base URL from _urls if available
  let baseUrl;
  if (attachment._urls?.original) {
    baseUrl = attachment._urls.original.replace(`.${attachment.extension}`, '');
  }

  return buildAttachmentUrl(baseUrl, crop, size, attachment.extension);
}

/**
 * Generate a `srcset` string for an image attachment.
 *
 * Returns an empty string when the attachment has no multiple size
 * variants (e.g. SVG or PDF files).
 *
 * @param {object} attachmentObject - Either a full image object or direct attachment.
 * @param {object} [options={}] - Options.
 * @param {Array<{ name: string, width: number, height?: number }>} [options.sizes]
 *   Custom size descriptors. Defaults to the standard ApostropheCMS sizes.
 * @returns {string} A `srcset` attribute value, or `''` if not applicable.
 *
 * @example
 * ```astro
 * ---
 * import { getAttachmentSrcset } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <img srcset={getAttachmentSrcset(image)} sizes="(max-width: 600px) 100vw, 50vw" />
 * ```
 */
export function getAttachmentSrcset(attachmentObject, options = {}) {
  if (!attachmentObject || !isSized(attachmentObject)) {
    return '';
  }

  const defaultSizes = [
    { name: 'one-sixth', width: 190, height: 350 },
    { name: 'one-third', width: 380, height: 700 },
    { name: 'one-half', width: 570, height: 700 },
    { name: 'two-thirds', width: 760, height: 760 },
    { name: 'full', width: 1140, height: 1140 },
    { name: 'max', width: 1600, height: 1600 }
  ];

  const sizes = options.sizes || defaultSizes;

  return sizes
    .map(size => `${getAttachmentUrl(attachmentObject, { ...options, size: size.name })} ${size.width}w`)
    .join(', ');
}
