const fs = require('fs');
const path = require('path');

module.exports = {
  init() {
    if (!(process.env.APOS_OPENAI_KEY || process.env.APOS_AI_HELPER_MOCK)) {
      // We do not document the mock because it is for internal testing
      throw new Error('APOS_OPENAI_KEY must be set in your environment');
    }
  },
  i18n: {
    aposAiHelper: {
      browser: true
    }
  },
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  options: {
    textModel: 'gpt-5.1',
    textMaxTokens: 1000,
    imageModel: 'gpt-image-1-mini'
  },
  methods(self) {
    return {
      checkPermissions(req) {
        // If the user cannot edit at least one content type, they have
        // no business talking to the AI
        if (!Object.keys(self.apos.modules).some(type => self.apos.permission.can(req, 'edit', type))) {
          throw self.apos.error('forbidden');
        }
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
