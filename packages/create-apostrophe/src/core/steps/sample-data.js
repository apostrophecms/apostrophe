// Step: import the kit's sample database dump + images into the freshly
// scaffolded project. Runs only for kits with `seedData: true`
// (the `*-demo-data` variants).
//
// **PLACEHOLDER — Phase 3.5 will fill this in.** The integration point is
// here so Phase 4's E2E matrix has a stable orchestrator shape; the body
// is intentionally a no-op pending the seam decision (core step vs
// kit-script delegate vs hybrid). See `docs/cli-modernization/phases/45-sample-data.md`
// for the options on the table and the decisions to lock.
//
// When the body lands:
//   - new FailStage 'sample_data' + errorCodes in src/telemetry/schema.js
//   - kit-registry manifest fields (dataUrl, dataChecksum, dataFormat),
//     OR a contract on the kit's `npm run import-sample-data` script.

/**
 * @param {{ projectDir: string, appRoot: string, kitId: string }} _opts
 * @returns {Promise<void>}
 */
export async function importSampleData(_opts) {
  // Intentionally empty. The orchestrator's `step('Importing sample
  // content', …)` wrapper renders the spinner + succeed line so the user
  // sees the step ran; until Phase 3.5 there is nothing to do.
}
