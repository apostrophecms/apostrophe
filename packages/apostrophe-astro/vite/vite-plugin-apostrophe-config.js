export function vitePluginApostropheConfig(
  aposHost,
  forwardHeaders = null,
  viewTransitionWorkaround,
  includeResponseHeaders = null,
  excludeRequestHeaders = null
) {
  const virtualModuleId = "virtual:apostrophe-config";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  // Use includeResponseHeaders if provided, fallback to forwardHeaders for BC
  const headersToInclude = includeResponseHeaders || forwardHeaders;

  return {
    name: "vite-plugin-apostrophe-config",
    async resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return `
          export default {
            aposHost: ${JSON.stringify(aposHost)}
            ${headersToInclude ? `,
              includeResponseHeaders: ${JSON.stringify(headersToInclude)}` : ''
            }
            ${excludeRequestHeaders ? `,
              excludeRequestHeaders: ${JSON.stringify(excludeRequestHeaders)}` : ''
            }
            ${viewTransitionWorkaround ? `,
              viewTransitionWorkaround: true` : ''
            }
          }`
        ;
      }
    },
  };
};
