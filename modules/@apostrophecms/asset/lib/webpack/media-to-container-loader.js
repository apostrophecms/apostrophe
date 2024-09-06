module.exports = (source) => {
  const mediaQueryRegex = /@media\s*(all|print|screen(?: and | or )?)?([^{]+)\s*{/g;

  const convertToContainerQuery = (mediaFeature) => {
    return `@container ${mediaFeature}`
  };

  // Prepend container query to media queries
  const modifiedSource = source.replace(mediaQueryRegex, (match, mediaType, mediaFeature) => {
    const containerQuery = convertToContainerQuery(mediaFeature);

    console.log(containerQuery)
    return `${containerQuery}, ${match}`;
  });

  return modifiedSource;
};
