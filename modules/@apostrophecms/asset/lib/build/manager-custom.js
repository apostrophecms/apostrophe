const path = require('node:path');
module.exports = (self, entrypoint) => {
  const predicates = (entrypoint.inputs || [ 'js', 'scss' ])
    .reduce((acc, type) => {
      acc[type] = null;
      return acc;
    }, {});

  return {
    getSourceFiles(meta, { composePath }) {
      return self.apos.asset.findSourceFiles(
        meta,
        predicates,
        {
          extraSources: entrypoint.sources,
          skipPredicates: true
        }
      );
    },
    async getOutput(sourceFiles) {
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
    },
    match(relSourcePath, metaEntry) {
      const result = self.apos.asset.findSourceFiles(
        [ metaEntry ],
        predicates,
        {
          extraSources: entrypoint.sources,
          skipPredicates: true
        }
      );
      const match = Object.values(result).flat()
        .some((file) => file.path === path.join(metaEntry.dirname, relSourcePath));

      return match;
    }
  };
};
