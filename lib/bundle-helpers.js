module.exports = {
  reBundle(moduleName, bundles, rebundleConfigs) {
    const rebundle = rebundleConfigs
      .filter(entry => entry.name === moduleName);
    let result = { ...bundles };

    for (const entry of rebundle) {
    // 1. CatchAll to "main", already bundled in the main build - skip.
      if (!entry.source && entry.main) {
        result = {};
        break;
      }
      // 2. CatchAll to a new bundle name, preserve merged options.
      if (!entry.source && !entry.main) {
        const options = Object.values(bundles)
          .reduce((all, opts) => ({
            ...all,
            ...opts
          }), {});
        result = { [entry.target]: options };
        break;
      }
      // 3. Rename a single bundle.
      if (entry.source) {
      // 3.1. ... But it's sent to the main build
        if (entry.main) {
          delete result[entry.source];
          continue;
        }
        // 3.2. rename it, preserve the options
        if (bundles[entry.source]) {
          result[entry.target] = { ...bundles[entry.source] };
          delete result[entry.source];
        }
      }
    }

    return result;
  }
};
