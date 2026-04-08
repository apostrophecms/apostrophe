import {
  extractImageData,
  buildResponsiveImageRules,
  hexToRgba
} from './backgroundHelpers.mjs';

export default {
  /**
   * Custom render functions for fields with nuanced data structures
   * @param {import('./render.mjs').NormalizedField} field - the normalized schema field
   * @param {String} property - the currently interated CSS property to render
   * @returns {{ field: NormalizedField, rule: string }}
   */
  box: function ({ field, property }) {
    let rule;
    const {
      unit, important, value
    } = field;
    const {
      top, right, bottom, left
    } = value;
    const vals = [ top, right, bottom, left ];
    field.important = false;

    if (vals.every(v => v == null)) {
      rule = '';
    };

    if (vals.every(v => v === top && v != null)) {
      const normalizedProperty = property
        .replaceAll('-%key%', '')
        .replaceAll('%key%-', '');

      rule = `${normalizedProperty}: ${top}${unit}${important ? ' !important' : ''}`;
      return {
        field,
        rule
      };
    }

    const sides = {
      top,
      right,
      bottom,
      left
    };
    const parts = [];

    for (const [ side, val ] of Object.entries(sides)) {
      if (val == null) {
        continue;
      }

      const normalizedProperty = property.includes('%key%')
        ? property
          .replaceAll('-%key%', `-${side}`)
          .replaceAll('%key%-', `${side}-`)
        : `${property}-${side}`;

      parts.push(`${normalizedProperty}: ${val}${unit}${important ? ' !important' : ''}`);
    }

    rule = parts.join(';');

    return {
      field,
      rule
    };
  },

  background: function ({
    field, subfields, options
  }) {
    const varBase = field.raw.property || '--preset-bg';
    const bgType = subfields.backgroundType?.value || 'color';

    const PROCESSED = [
      'enabled', 'backgroundType',
      'color',
      'gradientStart', 'gradientEnd', 'gradientAngle',
      '_image',
      'overlay', 'overlayColor', 'overlayOpacity'
    ];

    // Color Mode
    if (bgType === 'color') {
      const color = subfields.color?.value;
      if (!color) {
        return {
          field,
          rules: [],
          processedFields: PROCESSED
        };
      }
      return {
        field,
        rules: [ `background-color: ${color}` ],
        processedFields: PROCESSED
      };
    }

    // Gradient Mode
    if (bgType === 'gradient') {
      const start = subfields.gradientStart?.value || '#000000';
      const end = subfields.gradientEnd?.value || '#ffffff';
      const angle = subfields.gradientAngle?.value ?? 180;
      const unit = subfields.gradientAngle?.unit || 'deg';
      return {
        field,
        rules: [ `background: linear-gradient(${angle}${unit}, ${start}, ${end})` ],
        processedFields: PROCESSED
      };
    }

    // Image Mode
    const rel = subfields._image?.value;
    const imageData = extractImageData(rel?.[0]?.attachment);
    if (!imageData) {
      return {
        field,
        rules: [],
        processedFields: PROCESSED
      };
    }

    const rules = [];

    // --- CSS Variable Export ---
    const responsive = buildResponsiveImageRules(
      `${varBase}-image`, imageData, options.imageSizes
    );
    rules.push(...responsive.rules);

    // --- Overlay ---
    const layers = [];
    const overlay = subfields.overlay?.value;
    const overlayColor = subfields.overlayColor?.value || '#000000';
    const overlayOpacity = (subfields.overlayOpacity?.value ?? 50) / 100;

    if (overlay && overlayColor) {
      const rgba = hexToRgba(overlayColor, overlayOpacity);
      rules.push(`${varBase}-overlay: linear-gradient(${rgba}, ${rgba})`);
      layers.push(`var(${varBase}-overlay-layer, var(${varBase}-overlay))`);
    }

    // --- Override Hook Reset ---
    // Reset inherited hook values so nested widgets aren't affected
    // by a parent's blur recipe setting these to `none`.
    rules.push(`${varBase}-image-layer: initial`);
    rules.push(`${varBase}-overlay-layer: initial`);

    // --- Image Layer ---
    const imageFallback =
      `var(${varBase}-image) center / cover no-repeat`;
    layers.push(`var(${varBase}-image-layer, ${imageFallback})`);

    // --- Composite background shorthand ---
    rules.push(`background: ${layers.join(', ')}`);

    return {
      field,
      rules,
      processedFields: PROCESSED,
      ...responsive.mediaRules.length > 0 && {
        mediaRules: responsive.mediaRules
      }
    };
  }
};
