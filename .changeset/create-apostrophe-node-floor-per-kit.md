---
"create-apostrophe": minor
---

The installer now checks that your Node.js version can run the starter kit you pick. Apostrophe + Astro kits need Node.js 24 or newer, because recent Astro releases require a newer Node.js 22 release than many people have. On an older version, the guided installer says so at the build question and preselects Apostrophe Standalone, which still runs on Node.js 22. If you choose Apostrophe + Astro anyway, it explains how to upgrade (for example, `nvm install 24`) and asks again. Unattended installs (`--unattended`) stop before cloning with the same message, plus the exact `--kit` flag for the matching Apostrophe Standalone kit, and report the new `unsupported_node` telemetry code. A guided install refused this way sends no telemetry, because consent has not been asked yet.
