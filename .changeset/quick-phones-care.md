---
"apostrophe": patch
---

- The `productionSourceMaps` option is now fully supported in both Vite and Webpack. Previously this feature did not work fully in Vite, and was not supported with Webpack.
- If you want production sourcemaps to be created but not actually uploaded for the public, you can use the new `productionSourceDir` option to specify an alternate
  location where the `@apostrophecms/asset:build` task should copy them. This does not complete the job of actually connecting those sourcemaps with your browser or
  other application. Most people will not need this option.
