const path = require('node:path');

module.exports = (self, entrypoint) => {
  const predicates = {
    components: (file, entry) => file.startsWith(`${entrypoint.name}/components/`) && file.endsWith('.vue'),
    tiptap: (file, entry) => file.startsWith(`${entrypoint.name}/tiptap-extensions/`) &&
      file.endsWith('.js'),
    apps: (file, entry) => file.startsWith(`${entrypoint.name}/apps/`) && file.endsWith('.js')
  };

  function getSourceFiles(meta, { composePath }) {
    const components = self.apos.asset.findSourceFiles(
      meta,
      {
        vue: predicates.components
      },
      {
        composePath,
        componentOverrides: true
      }
    );
    const tiptap = self.apos.asset.findSourceFiles(
      meta,
      {
        js: predicates.tiptap
      },
      { composePath }
    );
    const apps = self.apos.asset.findSourceFiles(
      meta,
      {
        js: predicates.apps
      },
      { composePath }
    );
    return {
      components: components.vue,
      tiptap: tiptap.js,
      apps: apps.js
    };
  }

  return {
    // Get the source files for the admin UI. `meta.input` is ignored for this entrypoint type.
    getSourceFiles,
    async getOutput(sourceFiles, { modules }) {
      const icons = await self.apos.asset.getAposIconsOutput(modules);
      const components = self.apos.asset.getImportFileOutput(sourceFiles.components, {
        registerComponents: true
      });
      const tiptap = self.apos.asset.getImportFileOutput(sourceFiles.tiptap, {
        registerTiptapExtensions: true
      });
      const apps = self.apos.asset.getImportFileOutput(sourceFiles.apps, {
        importSuffix: 'App',
        enumerateImports: true,
        invokeApps: true
      });
      return {
        prologue: entrypoint.prologue ?? '',
        icons,
        components,
        tiptap,
        apps
      };
    },
    match(relSourcePath, metaEntry) {
      const result = getSourceFiles([ metaEntry ], {});
      const match = Object.values(result).flat()
        .some((file) => file.path === path.join(metaEntry.dirname, relSourcePath));

      return match;
    }
  };
};
