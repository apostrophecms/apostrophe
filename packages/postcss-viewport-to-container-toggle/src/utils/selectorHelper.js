const createSelectorHelper = ({ modifierAttr }) => {
  const bodyRegex = /^body|^html.*\s+body|^html.*\s*>\s*body/;
  const tagRegex = /^\.|^#|^\[|^:/;

  /**
   * Strategic use of :where() - only wrap the added targeting attributes,
   * not the entire selector. This preserves the original selector's specificity
   * while adding minimal specificity for the targeting mechanism.
   */
  const wrapInWhere = (selector) => `:where(${selector})`;

  const addTargetToSelectors = (
    selector,
    target
  ) => {
    const updatedSelector = selector
      .split(',')
      .reduce((acc, part) => {
        const trimmed = part.trim();
        const isBodySelector = trimmed.match(bodyRegex);

        if (!isBodySelector) {
          acc.push(`${wrapInWhere(target)} ${trimmed}`);
        }

        const bodyLevelSelector = getBodyLevelSelector(trimmed, target, isBodySelector);
        if (bodyLevelSelector) {
          acc.push(bodyLevelSelector);
        }
        return acc;
      }, []);

    return updatedSelector.join(',\n  ');
  };

  const updateBodySelectors = (selector, targets) => {
    const updatedSelector = selector
      .split(',')
      .reduce((acc, part) => {
        const trimmed = part.trim();

        // Should we get body level selector here?
        if (!trimmed.match(bodyRegex)) {
          return [ ...acc, trimmed ];
        }

        const updatedPart = trimmed.replace(bodyRegex, '');

        // We replace each body selector with the target,
        // we keep the rest of the selector
        return [
          ...acc,
          ...targets.reduce((acc, target) => {
            return [
              ...acc,
              `${target}${updatedPart}`.trim()
            ];
          }, [])
        ];
      }, []);

    return updatedSelector.join(',\n  ');
  };

  const getBodyLevelSelector = (selector, target, isBodySelector) => {
    if (isBodySelector) {
      selector = selector.replace(bodyRegex, '');

      // Selector is a body without identifiers, we put style in the body directly
      // Don't wrap here since this IS the body being replaced
      if (!selector) {
        return target;
      }
    }

    // If selector starts by an identifier that is not a tag, we put it next to the body
    // in case the body has this identifier
    const noTagSelector = selector.match(tagRegex);
    if (noTagSelector) {
      // For body-level selectors, wrap only if it's not a body replacement
      const targetSelector = isBodySelector ? target : wrapInWhere(target);
      return `${targetSelector}${selector}`;
    }

    return null;
  };

  return {
    bodyRegex,
    addTargetToSelectors,
    updateBodySelectors
  };
};

module.exports = createSelectorHelper;
