/**
 * Creates a unit converter for transforming viewport units into container query units.
 * Includes special handling for typography-related properties and expressions.
 *
 * @param {Object} options - Configuration options for the unit converter.
 * @param {Object} options.units - A mapping of viewport units (e.g., `vw`, `vh`)
 * to container query units (e.g., `cqw`, `cqh`).
 * @returns {Object} An object containing methods for
 * unit conversion and typography handling.
 */
const createUnitConverter = ({ units }) => {
  // Special typography-specific unit mappings
  const TYPOGRAPHY_UNITS = {
    ...units,
    vmin: 'cqi', // Use container query inline size for typography
    vmax: 'cqb' // Use container query block size for typography
  };

  /**
   * Parses and converts `clamp()` expressions to use container query units.
   *
   * @param {string} value - The CSS value containing a `clamp()` expression.
   * @returns {string} The converted value with container query units.
   */
  const parseClampExpression = (value) => {
    const clampRegex = /clamp\(((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g;
    return value.replace(clampRegex, (match, expression) => {
      const parts = expression.split(',').map(part => {
        part = part.trim();
        if (part.includes('calc(')) {
          part = parseCalcExpression(part);
        }
        return convertUnitsInExpression(part);
      });
      return `clamp(${parts.join(', ')})`;
    });
  };

  /**
   * Parses and converts `calc()` expressions to use container query units.
   *
   * @param {string} value - The CSS value containing a `calc()` expression.
   * @returns {string} The converted value with container query units.
   */
  const parseCalcExpression = (value) => {
    const calcRegex = /calc\(((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g;
    return value.replace(calcRegex, (match, expression) => {
      return `calc(${convertUnitsInExpression(expression)})`;
    });
  };

  /**
   * Converts viewport units in a CSS expression to container query units.
   *
   * @param {string} expression - The CSS expression containing viewport units.
   * @param {boolean} [isTypography=false] - Whether to use
   * typography-specific unit mappings.
   * @returns {string} The converted expression with container query units.
   */
  const convertUnitsInExpression = (expression, isTypography = false) => {
    // Determine which unit mappings to use
    const unitMappings = isTypography ? TYPOGRAPHY_UNITS : units;

    // Handle fluid typography patterns first
    expression = expression.replace(
      /(\d*\.?\d+)vw\s*\+\s*(\d*\.?\d+)rem/g,
      (match, vw, rem) => `${rem}rem + ${vw}cqw`
    );

    // Convert standard units
    return Object.entries(unitMappings).reduce((acc, [ unit, containerUnit ]) => {
      const unitRegex = new RegExp(`(\\d*\\.?\\d+)${unit}`, 'g');
      return acc.replace(unitRegex, `$1${containerUnit}`);
    }, expression);
  };

  /**
   * Processes typography-specific values by converting units and parsing expressions.
   *
   * @param {string} value - The typography-related CSS value to process.
   * @returns {string} The processed value with container query units.
   */
  const processTypographyValue = (value) => {
    let processed = value;

    if (value.includes('clamp(')) {
      processed = parseClampExpression(processed);
    }

    if (processed.includes('calc(')) {
      processed = parseCalcExpression(processed);
    }

    // Use typography-specific unit conversion
    processed = convertUnitsInExpression(processed, true);

    return processed;
  };

  /**
   * Checks if a CSS property is typography-related.
   *
   * @param {string} prop - The name of the CSS property to check.
   * @returns {boolean} Returns true if the property is
   * typography-related, otherwise false.
   */
  const isTypographyProperty = (prop) => {
    return [
      'font-size',
      'line-height',
      'letter-spacing',
      'word-spacing',
      'text-indent',
      'margin-top',
      'margin-bottom',
      'padding-top',
      'padding-bottom'
    ].includes(prop);
  };

  return {
    units,
    parseClampExpression,
    parseCalcExpression,
    convertUnitsInExpression,
    processTypographyValue,
    isTypographyProperty
  };
};

module.exports = createUnitConverter;
