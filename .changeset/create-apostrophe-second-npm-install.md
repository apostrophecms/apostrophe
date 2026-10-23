---
"create-apostrophe": patch
---

The installer now runs `npm install` a second time in each project folder. Without a lockfile, npm's first install of a fresh project isn't final: on macOS it leaves out `fsevents`, which `npm run dev` uses for file watching, and it can place a dependency where the next install moves it. The second run settles the project so a later `npm install` makes no changes. It takes a few seconds, and if it fails the install still succeeds.
