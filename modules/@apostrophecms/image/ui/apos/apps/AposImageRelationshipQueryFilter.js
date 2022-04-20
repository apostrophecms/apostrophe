export default () => {
  const queryOptions = [ 'minSize' ];

  apos.bus.$on('piece-relationship-query', (query) => {
    const [ options = {} ] = apos.area?.widgetOptions || [];

    Object.entries(options).forEach(([ optName, optValue ]) => {
      if (queryOptions.includes(optName)) {
        query[optName] = optValue;
      }
    });

    return 'looool';
  });
};
