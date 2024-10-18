module.exports = (self, entrypoint) => {
  // See `asset.getEntrypointManger()` for the interface documentation.
  return {
    // Get the source files for entrypoint.
    // See `apos.asset.findSourceFiles()` for the return format documentation.
    getSourceFiles(meta, { composePath }) {
      const predicates = (entrypoint.inputs || [ 'js', 'scss' ])
        .reduce((acc, type) => {
          acc[type] = (file, entry) => file === `${entrypoint.name}/index.${type}`;
          return acc;
        }, {});

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
    getOutput(sourceFiles) {
      const output = (Object.entries(sourceFiles))
        .reduce((acc, [ type, files ]) => {
          switch (type) {
            case 'js':
              acc[type] = self.apos.asset.getImportFileOutput(files, {
                requireDefaultExport: true,
                invokeApps: true,
                importSuffix: 'App',
                enumerateImports: true
              });
              break;
            case 'scss':
              acc[type] = self.apos.asset.getImportFileOutput(files, {
                importName: false
              });
              break;
            default:
              acc[type] = self.apos.asset.getImportFileOutput(files);
              break;
          }
          return acc;
        }, {});

      output.prologue = entrypoint.prologue ?? '';
      return output;
    }
  };
};
