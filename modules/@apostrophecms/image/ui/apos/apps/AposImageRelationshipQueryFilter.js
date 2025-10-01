export default () => {
  const queryOptions = [ 'minSize', 'aspectRatio' ];

  apos.bus.$on('piece-relationship-query', (query) => {
    const [ options = {} ] = apos.area.widgetOptions || [];
    console.log('options', options);

    queryOptions.forEach((optName) => {
      if (options[optName]) {
        query[optName] = options[optName];
      }
    });
    console.log('query', query);
  });
};
