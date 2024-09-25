const postcss = require('postcss');

module.exports = function (source) {
  const schema = {
    title: 'Media to Container Queries Loader options',
    type: 'object',
    properties: {
      debug: {
        type: 'boolean'
      },
      transform: {
        anyOf: [
          { type: 'null' },
          { instanceof: 'Function' }
        ]
      }
    }
  };
  const options = this.getOptions(schema);

  const mediaQueryRegex = /@media\s*(all|print|screen(?: and | or )?)?([^{]+)[^{]*{([\s\S]*?})\s*(\\n)*}/g;

  const convertToContainerQuery = (mediaFeature, content) => {
    // NOTE: container query does not work with the combo
    // - min-width, max-width, min-height, max-height
    // - lower than, lower than equal, greater than, greater than equal
    const DESCRIPTORS = [
      'min-width',
      'max-width',
      'min-height',
      'max-height'
    ];
    const OPERATORS = [
      '>',
      '>=',
      '<',
      '<='
    ];

    const containerFeature = typeof options.transform === 'function'
      ? options.transform(mediaFeature)
      : mediaFeature;

    if (
      options.debug &&
      DESCRIPTORS.some(descriptor => containerFeature.includes(descriptor)) &&
      OPERATORS.some(operator => containerFeature.includes(operator))
    ) {
      console.warn('[mediaToContainerQueryLoader] Unsupported media query', containerFeature);
    }

    return `@container ${containerFeature} {${content}}`;
  };

  // Prepend container query to media queries
  const modifiedSource = source.replace(mediaQueryRegex, (match, mediaType, mediaFeature, content) => {
    if (
      mediaType === 'print' ||
      (
        mediaType !== undefined &&
        ([ 'all', 'screen' ].some(media => mediaType.includes(media))) === false
      )
    ) {
      return match;
    }

    const containerQuery = convertToContainerQuery(mediaFeature, content);

    const root = postcss.parse(match.replaceAll(/\\[frntv]/g, ''));
    root.walkRules(rule => {
      const newRule = rule.clone();
      newRule.selectors = newRule.selectors.map(selector => {
        if (selector.startsWith('body')) {
          return selector.replace('body', 'body:not([data-device-preview-mode])');
        }

        return `body:not([data-device-preview-mode]) ${selector}`;
      });

      rule.replaceWith(newRule);
    });

    return `${root.toString()} ${containerQuery}`;
  });

  return modifiedSource;
};
