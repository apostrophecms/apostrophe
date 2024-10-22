module.exports = (self, entrypoint) => {
  return {
    getSourceFiles(meta) {
      const predicates = entrypoint.outputs.reduce((acc, type) => {
        acc[type] = (file, entry) => {
          return file.startsWith(`${entrypoint.name}/`) && file.endsWith(`.${type}`);
        };
        return acc;
      }, {});

      return self.apos.asset.findSourceFiles(
        meta,
        predicates
      );
    },
    async getOutput(sourceFiles) {
      throw new Error(`"getOutput" is not supported for entrypoint type: ${entrypoint.type}`);
    }
  };
};
