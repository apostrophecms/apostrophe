module.exports = (self, entrypoint) => {
  return {
    getSourceFiles(meta, { composePath }) {
      const predicates = (entrypoint.inputs || [ 'js', 'scss' ])
        .reduce((acc, type) => {
          acc[type] = null;
          return acc;
        }, {});

      return self.apos.asset.findSourceFiles(
        meta,
        predicates,
        {
          extraSources: entrypoint.sources,
          skipPredicates: true
        }
      );
    },
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
