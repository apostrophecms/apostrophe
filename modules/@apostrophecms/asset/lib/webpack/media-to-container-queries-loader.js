module.exports = function (source) {
  const schema = {
    title: 'Media to Container Queries Loader options',
    type: 'object',
    properties: {
      debug: {
        type: 'boolean',
      },
    },
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
      'max-height',
    ];
    const OPERATORS = [
      '>',
      '>=',
      '<',
      '<='
    ];

    if (
      options.debug &&
      DESCRIPTORS.some(descriptor => mediaFeature.includes(descriptor)) &&
      OPERATORS.some(operator => mediaFeature.includes(operator))
    ) {
      console.warn('[mediaToContainerQueryLoader] Unsupported media query', mediaFeature);
    }

    return `@container ${mediaFeature} \{${content}\}`
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

    return `${containerQuery} ${match}`;
  });

  return modifiedSource;
};
