---
"@apostrophecms/vite": minor
---

Projects installed with pnpm's default settings now build. Previously the build only worked when the package manager hoisted Apostrophe's own dependencies to the project's `node_modules` (npm does, pnpm only with `public-hoist-pattern[]=*`). When an import in Apostrophe's or a module's UI code or stylesheets (Sass `@use`) can't be resolved from the project, it is now resolved from the dependencies of the package the code came from. Packages that several others depend on are also bundled once instead of once per dependent. Projects that build today are not affected: npm, yarn and hoisted pnpm builds produce identical output.
