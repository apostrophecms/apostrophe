export function vitePluginApostropheDoctype(widgetsMapping, templatesMapping) {

  const virtualModuleId = "virtual:apostrophe-doctypes";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "vite-plugin-apostrophe-doctypes",
    async resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        /**
         * Handle registered doctypes
         */
        const resolvedWidgetsId = await this.resolve(widgetsMapping);
        const resolvedTemplatesId = await this.resolve(templatesMapping);
        /**
         * if the component cannot be resolved
         */
        if (!resolvedWidgetsId || !resolvedTemplatesId) {
          throw new Error(
            `Widget or Templates mapping is missing.`
          );
        } else {
          /**
           * if the component can be resolved, add it to the imports array
           */
          return `import { default as widgets } from "${resolvedWidgetsId.id}";
          import { default as templates } from "${resolvedTemplatesId.id}";
          export { widgets, templates }`
        }
      }
    },
  };
}