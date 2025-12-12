---
"apostrophe": patch
---

- The `productionSourceMaps` option is now fully supported in both Vite and Webpack. Previously this feature did not work fully in Vite, and was not supported with Webpack. Enabling this feature completes the task of making sourcemaps fully available in the browser in production.
- If you want production sourcemaps to be created but not actually uploaded for the public, you can combine `productionSourceMaps: true` with the new `productionSourceMapsDir` option to specify an alternate location where the `@apostrophecms/asset:build` task should place them. By using this option, you take responsibility for delivering the sourcemaps to their final home. Creating and/or erasing the folder between builds is also up to you. Most people will not need this option.
