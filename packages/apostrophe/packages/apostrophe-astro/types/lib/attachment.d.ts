/**
 * Get focal point coordinates from attachment or image, or return default value if invalid
 * @param {Object} attachmentObject - Either a full image object or direct attachment
 * @param {string} [defaultValue='center center'] - Default value to return if no valid focal point
 * @returns {string} String with focal point for styling (e.g., "50% 50%") or default value if invalid
 */
export function getFocalPoint(attachmentObject: any, defaultValue?: string): string;
/**
 * Get the width from the image object, using crop dimensions if available,
 * otherwise falling back to original image dimensions
 * @param {object} imageObject - Image object from ApostropheCMS
 * @returns {number|undefined} The width of the image
 */
export function getWidth(imageObject: object): number | undefined;
/**
 * Get the height from the image object, using crop dimensions if available,
 * otherwise falling back to original image dimensions
 * @param {object} imageObject - Image object from ApostropheCMS
 * @returns {number|undefined} The height of the image
 */
export function getHeight(imageObject: object): number | undefined;
/**
 * Get URL for an attachment with optional size
 * @param {Object} imageObject - The full image object from ApostropheCMS
 * @param {Object} [options={}] - Options object
 * @param {string} [options.size] - Size variant ('one-sixth', 'one-third',
 *  'one-half', 'two-thirds', 'full', 'max', 'original')
 * @param {string} [options.missingIcon] - Custom URL for missing attachment (optional)
 * @returns {string} The URL for the attachment
 */
export function getAttachmentUrl(imageObject: any, options?: {
    size?: string;
    missingIcon?: string;
}): string;
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
export function getAttachmentSrcset(attachmentObject: any, options?: {
    sizes?: any[];
}): string;
