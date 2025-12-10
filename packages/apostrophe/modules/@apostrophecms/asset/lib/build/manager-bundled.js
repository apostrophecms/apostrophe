const path = require('node:path');
module.exports = (self, entrypoint) => {
  const predicates = entrypoint.outputs.reduce((acc, type) => {
    acc[type] = (file, entry) => {
      return file.startsWith(`${entrypoint.name}/`) && file.endsWith(`.${type}`);
    };
    return acc;
  }, {});

  return {
    getSourceFiles(meta) {
      return self.apos.asset.findSourceFiles(
        meta,
        predicates
      );
    },
    async getOutput(sourceFiles) {
      throw new Error(`"getOutput" is not supported for entrypoint type: ${entrypoint.type}`);
    },
    match(relSourcePath, metaEntry) {
      const result = self.apos.asset.findSourceFiles(
        [ metaEntry ],
        predicates
      );
      const match = Object.values(result).flat()
        .some((file) => file.path === path.join(metaEntry.dirname, relSourcePath));

      return match;
    }
  };
};
