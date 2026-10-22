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
export function getFocalPoint(attachmentObject: object, defaultValue?: string): string;
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
export function getWidth(imageObject: object): number | undefined;
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
export function getHeight(imageObject: object): number | undefined;
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
export function getAttachmentUrl(imageObject: object, options?: {
    size?: string;
    missingIcon?: string;
}): string;
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
export function getAttachmentSrcset(attachmentObject: object, options?: {
    sizes?: Array<{
        name: string;
        width: number;
        height?: number;
    }>;
}): string;
