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

    if (vals.every(v => v == null)) {
      rule = '';
    };

    if (vals.every(v => v === top && v != null)) {
      rule = `${property}: ${top}${unit}${important ? ' !important' : ''};`;
    }

    const sides = {
      top,
      right,
      bottom,
      left
    };
    const parts = [];

    for (const [ side, val ] of Object.entries(sides)) {
      if (val != null) {
        parts.push(`${property}-${side}: ${val}${unit}${important ? ' !important' : ''}`);
      }
      rule = parts.join(';');
    }

    field.important = false;
    return {
      field,
      rule
    };
  }
};
