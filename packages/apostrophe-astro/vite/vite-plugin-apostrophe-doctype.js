export function vitePluginApostropheDoctype(widgetsMapping, templatesMapping, onBeforeWidgetRender = null) {

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

          let hookImport = '';
          let hookExport = 'undefined';

          if (onBeforeWidgetRender) {
            const resolvedHookId = await this.resolve(onBeforeWidgetRender);
            if (resolvedHookId) {
              hookImport = `import onBeforeWidgetRenderHookFn from "${resolvedHookId.id}";`;
              hookExport = 'onBeforeWidgetRenderHookFn';
            }
          }

          return `import { default as widgets } from "${resolvedWidgetsId.id}";
          import { default as templates } from "${resolvedTemplatesId.id}";
          ${hookImport}
          export { widgets, templates };
          export const onBeforeWidgetRenderHook = ${hookExport};`
        }
      }
    },
  };
}