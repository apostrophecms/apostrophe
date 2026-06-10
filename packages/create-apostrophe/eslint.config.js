import apostrophe from 'eslint-config-apostrophe';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  apostrophe,
  {
    // Architectural boundary: the headless layers must not depend on the UI.
    // core/ and telemetry/ may not import anything under ui/.
    files: [ 'src/core/**/*.js', 'src/telemetry/**/*.js' ],
    rules: {
      'no-restricted-imports': [ 'error', {
        patterns: [ {
          group: [ '**/ui', '**/ui/**' ],
          message: 'core/ and telemetry/ must not import from ui/ (UI/logic boundary).'
        } ]
      } ]
    }
  }
]);
