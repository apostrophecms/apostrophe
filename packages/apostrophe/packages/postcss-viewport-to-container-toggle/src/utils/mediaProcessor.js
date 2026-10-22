/**
 * Creates a media query processor to handle media queries
 * and convert them into container queries.
 *
 * @param {Object} options - Configuration options for the processor.
 * @param {Function} options.transform - A custom function to transform media queries.
 * @returns {Object} An object containing methods to process media queries.
 */
const createMediaProcessor = ({ transform }) => {

  /**
   * Converts a single comparison into a min/max format.
   *
   * @param {string} value - The value to compare, e.g., `500px`.
   * @param {string} property - The property being compared, e.g., `width`.
   * @param {string} operator - The comparison operator, e.g., `>=`, `<=`.
   * @returns {string} The converted comparison in min/max format.
   */
  const convertComparison = (value, property, operator) => {
    // Simple lookup table for operator conversion
    const operatorMap = {
      '>=': 'min',
      '<=': 'max',
      '>': value => `min-${property}: calc(${value} + 0.02px)`,
      '<': value => `max-${property}: calc(${value} - 0.02px)`
    };

    if (typeof operatorMap[operator] === 'function') {
      return operatorMap[operator](value);
    }

    return `${operatorMap[operator]}-${property}: ${value}`;
  };

  /**
   * Converts a media query range syntax into min/max format.
   *
   * @param {string} feature - The media query condition to convert.
   * @returns {string} The condition converted into min/max format.
   */
  const convertRangeSyntax = (feature) => {
    // Split on 'and' to process each condition independently
    const conditions = feature.trim().split(' and ').map(cond => cond.trim());

    const convertedConditions = conditions.map(cond => {
      // Full range: (100px <= width <= 200px) or (100px < width < 200px)
      const fullRangeMatch = cond.match(
        /(?<min>\d+[a-z%]*)\s*(?<minOp>[<>]=?)\s*(?<property>[a-z-]+)\s*(?<maxOp>[<>]=?)\s*(?<max>\d+[a-z%]*)/
      );
      if (fullRangeMatch) {
        const {
          min,
          minOp,
          property,
          maxOp,
          max
        } = fullRangeMatch.groups;
        const minCondition = convertComparison(min, property, minOp === '<=' ? '>=' : minOp === '>=' ? '<=' : minOp === '<' ? '>' : '<');
        const maxCondition = convertComparison(max, property, maxOp);
        return `${minCondition}) and (${maxCondition}`;
      }

      // Single comparison: (width >= 100px) or (width < 200px)
      const singleComparisonMatch = cond.match(
        /(?<property>[a-z-]+)\s*(?<operator>[<>]=?)\s*(?<value>\d+[a-z%]*)/
      ) || cond.match(
        /(?<value>\d+[a-z%]*)\s*(?<operator>[<>]=?)\s*(?<property>[a-z-]+)/
      );

      if (singleComparisonMatch) {
        let {
          property,
          operator,
          value
        } = singleComparisonMatch.groups;

        // If the number comes first (we matched the second pattern)
        if (/^\d/.test(property)) {
          // Swap property and value
          [ property, value ] = [ value, property ];

          // Map the operator to its inverse
          const operatorMap = {
            '>=': '<=',
            '<=': '>=',
            '>': '<',
            '<': '>'
          };

          operator = operatorMap[operator] || operator;
        }
        return `(${convertComparison(value, property, operator)})`;
      }

      // Handle standard media feature formats with colon
      if (cond.includes(':')) {
        return cond;
      }

      return cond;
    });

    return convertedConditions.join(' and ');
  };

  /**
   * Splits media query parameters into individual conditions.
   *
   * @param {string} params - The media query string to split.
   * @returns {string[]} An array of individual media conditions.
   */
  const splitMediaConditions = (params) => {
    return params.split(',').map(condition => condition.trim());
  };

  /**
   * Check if a condition is screen/all related (vs print)
   *
   * @param {string} condition - The media condition string to check.
   * @returns {boolean} Returns true if the condition is related to `screen` or `all`.
   */
  const isScreenCondition = (condition) => {
    return (
      !condition.includes('print') &&
      (condition.includes('screen') ||
      condition.includes('all') ||
      !/(all|screen|print)/.test(condition))
    );
  };

  /**
   * Check if a condition includes query conditions like min/max width or height.
   *
   * @param {string} condition - The media condition string to check.
   * @returns {boolean} Returns true if the condition includes query-related properties.
   */
  const hasQueryConditions = (condition) => {
    return /min-|max-|width|height|orientation/.test(condition);
  };

  /**
   * Cleans a media condition by removing keywords
   * like `only`, `screen`, `all`, and `print`.
   *
   * @param {string} condition - The media condition string to clean.
   * @returns {string} The cleaned condition.
   */
  const cleanMediaCondition = (condition) => {
    return condition
      .replace(/(only\s*)?(all|screen|print)(,)?(\s)*(and\s*)?/g, '')
      .trim();
  };

  /**
   * Extracts media conditions from a rule, including nested conditions.
   *
   * @param {Object} atRule - The PostCSS `@media` rule to process.
   * @returns {string[]} An array of cleaned media conditions.
   */
  const getMediaConditions = (atRule) => {
    const conditions = [];

    // First check this level's conditions
    const mediaConditions = splitMediaConditions(atRule.params);

    for (const condition of mediaConditions) {
      if (isScreenCondition(condition)) {
        if (hasQueryConditions(condition)) {
          const cleaned = cleanMediaCondition(condition);
          if (cleaned) {
            conditions.push(cleaned);
          }
        }
      }
    }

    // Then process any nested media queries
    atRule.walkAtRules('media', (nested) => {
      const nestedConditions = splitMediaConditions(nested.params);

      for (const condition of nestedConditions) {
        if (isScreenCondition(condition)) {
          if (hasQueryConditions(condition)) {
            const cleaned = cleanMediaCondition(condition);
            if (cleaned) {
              conditions.push(cleaned);
            }
          }
        }
      }
    });

    if (conditions.length > 1) {
      return [ conditions.filter(Boolean).join(' and ') ];
    }

    return conditions.filter(Boolean);
  };

  /**
   * Converts an array of media conditions into container query conditions.
   *
   * @param {string[]} conditions - An array of media conditions to convert.
   * @returns {string|null} A string containing the container query conditions.
   */
  const convertToContainerConditions = (conditions) => {
    if (!conditions.length) {
      return null;
    }

    // Join all conditions with 'and'
    const combinedCondition = conditions.filter(Boolean).join(' and ');

    let containerQuery = typeof transform === 'function'
      ? transform(combinedCondition)
      : combinedCondition;

    // Convert range syntax if needed
    containerQuery = convertRangeSyntax(containerQuery);

    // Ensure proper parentheses
    if (!containerQuery.startsWith('(')) {
      containerQuery = `(${containerQuery}`;
    }
    if (!containerQuery.endsWith(')')) {
      containerQuery = `${containerQuery})`;
    }

    return containerQuery.trim();
  };

  return {
    getMediaConditions,
    convertToContainerConditions
  };
};

module.exports = createMediaProcessor;
