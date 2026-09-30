const t = require('../../test-lib/test.js');

(async function () {
  await t.create({
    root: module,
    modules: {
      '@apostrophecms/ai': {
        options: {
          providers: { openai: 'key' }
        }
      }
    }
  });
})();
