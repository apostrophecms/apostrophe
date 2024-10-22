module.exports = (self, entrypoint) => {
  return {
    // Get the source files for the admin UI. `meta.input` is ignored for this entrypoint type.
    getSourceFiles(meta, { composePath }) {
      const components = self.apos.asset.findSourceFiles(
        meta,
        {
          vue: (file, entry) => file.startsWith(`${entrypoint.name}/components/`) && file.endsWith('.vue')
        },
        {
          composePath,
          componentOverrides: true
        }
      );
      const tiptap = self.apos.asset.findSourceFiles(
        meta,
        {
          js: (file, entry) => file.startsWith(`${entrypoint.name}/tiptap-extensions/`) &&
              file.endsWith('.js')
        },
        { composePath }
      );
      const apps = self.apos.asset.findSourceFiles(
        meta,
        {
          js: (file, entry) => file.startsWith(`${entrypoint.name}/apps/`) && file.endsWith('.js')
        },
        { composePath }
      );
      return {
        components: components.vue,
        tiptap: tiptap.js,
        apps: apps.js
      };
    },
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
    }
  };
};
