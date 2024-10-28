const path = require('node:path');
module.exports = (self, entrypoint) => {
  // See `asset.getEntrypointManger()` for the interface documentation.
  const predicates = (entrypoint.inputs || [ 'js', 'scss' ])
    .reduce((acc, type) => {
      acc[type] = (file, entry) => file === `${entrypoint.name}/index.${type}`;
      return acc;
    }, {});
  return {
    // Get the source files for entrypoint.
    // See `apos.asset.findSourceFiles()` for the return format documentation.
    getSourceFiles(meta, { composePath }) {
      return self.apos.asset.findSourceFiles(
        meta,
        predicates,
        {
          composePath,
          extraSources: entrypoint.sources,
          ignoreSources: entrypoint.ignoreSources
        }
      );
    },
    // Get the output data for an entrypoint. `sourceFiles` is in format compatible
    // with the output of `getSourceFiles()`. The return value is an object with the
    // same keys as `sourceFiles`, and the values are the output of getImportFileOutput().
    // Additionally, the return value has a `prologue` key that contains the prologue for the entrypoint.
    async getOutput(sourceFiles, { suppressErrors }) {
      const output = (Object.entries(sourceFiles))
        .reduce((acc, [ type, files ]) => {
          switch (type) {
            case 'js':
              acc[type] = self.apos.asset.getImportFileOutput(files, {
                suppressErrors,
                requireDefaultExport: true,
                invokeApps: true,
                importSuffix: 'App',
                enumerateImports: true
              });
              break;
            case 'scss':
              acc[type] = self.apos.asset.getImportFileOutput(files, {
                suppressErrors,
                importName: false
              });
              break;
            default:
              acc[type] = self.apos.asset.getImportFileOutput(files, { suppressErrors });
              break;
          }
          return acc;
        }, {});

      output.prologue = entrypoint.prologue ?? '';
      return output;
    },
    // Vote on whether a given source file is part of this entrypoint.
    match(relSourcePath, metaEntry) {
      const result = self.apos.asset.findSourceFiles(
        [ metaEntry ],
        predicates,
        {
          extraSources: entrypoint.sources,
          ignoreSources: entrypoint.ignoreSources
        }
      );
      const match = Object.values(result).flat()
        .some((file) => file.path === path.join(metaEntry.dirname, relSourcePath));

      return match;
    }
  };
};
