/**
 * Custom render functions for fields with nuanced data structures
 * @param {object} field - the original schema field
 * @param {*} value - the value of the schema field
 * @returns {{ field: object, rule: string }}
 *  - object containing the (un)modified field and CSS rules
 */
module.exports = {
  box: function(field, value) {
    let rule;
    const {
      property, unit, important
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
        parts.push(`${property}-${side}: ${val}${unit}${important ? ' !important' : ''};`);
      }
      rule = parts.join(' ');
    }

    field.important = false;
    return {
      field,
      rule
    };
  }
};
