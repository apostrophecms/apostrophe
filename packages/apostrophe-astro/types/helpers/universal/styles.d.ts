/**
 * Widget styles helpers.
 *
 * Pure utilities for reading and merging ApostropheCMS style option
 * data (set via `@apostrophecms/styles`) from widget objects. These
 * helpers have no environment dependencies and work in both server
 * and client contexts.
 */
/**
 * Return the styles elements HTML string for a widget, or `null` if
 * none are configured.
 *
 * The returned value is safe to pass to Astro's `set:html` directive.
 *
 * @param {object} widget - The widget object from ApostropheCMS.
 * @returns {string|null}
 *
 * @example
 * ```astro
 * ---
 * import { stylesElements } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ---
 * <Fragment set:html={stylesElements(widget)} is:inline />
 * ```
 */
export function stylesElements(widget: object): string | null;
/**
 * Return a merged HTML attributes object combining the widget's
 * ApostropheCMS styles attributes with any caller-supplied overrides.
 *
 * Classes are merged and deduplicated. Styles are concatenated.
 * Any other attributes in `additionalAttrs` are merged in directly,
 * with `undefined`/`null` values omitted.
 *
 * @param {object} widget - The widget object from ApostropheCMS.
 * @param {object} [additionalAttrs={}] - Extra attributes to merge.
 * @param {string|string[]} [additionalAttrs.class] - Additional CSS classes.
 * @param {string} [additionalAttrs.style] - Additional inline style string.
 * @returns {object} Merged attributes object suitable for Astro spread (`{...attrs}`).
 *
 * @example
 * ```astro
 * ---
 * import { stylesAttributes } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * const attrs = stylesAttributes(widget, { class: 'my-extra-class' });
 * ---
 * <div {...attrs}><slot /></div>
 * ```
 */
export function stylesAttributes(widget: object, additionalAttrs?: {
    class?: string | string[];
    style?: string;
}): object;
