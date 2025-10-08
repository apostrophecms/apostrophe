export default () => {
  const queryOptions = [ 'minSize', 'aspectRatio' ];

  apos.bus.$on('piece-relationship-query', (query) => {
    const [ options = {} ] = apos.area.widgetOptions || [];

    queryOptions.forEach((optName) => {
      if (options[optName]) {
        query[optName] = options[optName];
      }
    });
  });
};
