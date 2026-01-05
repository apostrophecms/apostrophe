const fs = require('fs');
const path = require('path');

// Import provider factories
const openaiProvider = require('./providers/openai');
const anthropicProvider = require('./providers/anthropic');
const geminiProvider = require('./providers/gemini');

module.exports = {
  options: {
    // Default providers for text and image generation
    textProvider: 'openai',
    imageProvider: 'openai',
    // Provider-specific options
    textProviderOptions: {},
    imageProviderOptions: {},
    // Legacy option support (BC)
    textModel: null,
    imageModel: null,
    textMaxTokens: 1000
  },

  async init(self) {
    // Storage for registered providers
    self.providers = new Map();

    const textOpts = { ...self.options.textProviderOptions };
    const imageOpts = { ...self.options.imageProviderOptions };

    if (self.options.textModel) {
      self.apos.util.warn(
        'The "textModel" option is deprecated. ' +
        'Use "textProviderOptions.textModel" instead.'
      );
      textOpts.textModel = self.options.textModel;
    }
    if (self.options.imageModel) {
      self.apos.util.warn(
        'The "imageModel" option is deprecated. ' +
        'Use "imageProviderOptions.imageModel" instead.'
      );
      imageOpts.imageModel = self.options.imageModel;
    }
    if (self.options.textMaxTokens) {
      self.apos.util.warn(
        'The "textMaxTokens" option is deprecated. ' +
        'Use "textProviderOptions.textMaxTokens" instead.'
      );
      textOpts.textMaxTokens = self.options.textMaxTokens;
    }
    const textProvider = self.options.textProvider;
    const imageProvider = self.options.imageProvider;

    // Register bundled providers
    self.registerProvider(openaiProvider(
      self.apos,
      textProvider === 'openai' ? textOpts : {},
      imageProvider === 'openai' ? imageOpts : {}
    ));

    self.registerProvider(anthropicProvider(
      self.apos,
      textProvider === 'anthropic' ? textOpts : {}
    ));

    self.registerProvider(geminiProvider(
      self.apos,
      textProvider === 'gemini' ? textOpts : {},
      imageProvider === 'gemini' ? imageOpts : {}
    ));

    // Validate configured providers
    if (!process.env.APOS_AI_HELPER_MOCK) {
      const textProviderInfo = self.providers.get(self.options.textProvider);
      if (!textProviderInfo) {
        throw new Error(
          `Text provider "${self.options.textProvider}" is not registered. ` +
          `Available providers: ${Array.from(self.providers.keys()).join(', ')}`
        );
      }
      if (!textProviderInfo.capabilities.text) {
        throw new Error(
          `Provider "${self.options.textProvider}" does not support text generation`
        );
      }

      // Check image provider
      const imageProviderInfo = self.providers.get(self.options.imageProvider);
      if (!imageProviderInfo) {
        throw new Error(
          `Image provider "${self.options.imageProvider}" is not registered. ` +
          `Available providers: ${Array.from(self.providers.keys()).join(', ')}`
        );
      }
      if (!imageProviderInfo.capabilities.image) {
        throw new Error(
          `Provider "${self.options.imageProvider}" does not support image generation`
        );
      }

      const providersToValidate = new Set([
        self.options.textProvider,
        self.options.imageProvider
      ]);

      for (const providerName of providersToValidate) {
        const providerInfo = self.providers.get(providerName);
        if (providerInfo?.provider.validate) {
          providerInfo.provider.validate();
        }
      }
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

  methods(self) {
    return {
      /**
       * Register an AI provider
       * @param {Object} provider -
       * Provider object with name, label, capabilities, and methods
       */
      registerProvider(provider) {
        const {
          name,
          label,
          capabilities = {}
        } = provider;

        if (!name) {
          throw new Error('Provider must have a name');
        }

        if (self.providers.has(name)) {
          throw new Error(`Provider "${name}" is already registered`);
        }

        // Validate that the provider implements required methods
        if (capabilities.text && typeof provider.generateText !== 'function') {
          throw new Error(`Provider "${name}" claims text support but doesn't implement generateText()`);
        }

        if (capabilities.image && typeof provider.generateImage !== 'function') {
          throw new Error(`Provider "${name}" claims image support but doesn't implement generateImage()`);
        }

        if (capabilities.imageVariation && typeof provider.generateImageVariation !== 'function') {
          throw new Error(`Provider "${name}" claims imageVariation support but doesn't implement generateImageVariation()`);
        }

        self.providers.set(name, {
          provider,
          label,
          capabilities
        });

        self.apos.util.info('ai-helper:provider-registered', {
          name,
          label
        });
      },

      /**
       * Get a registered provider by name
       * @param {string} name - Provider name
       * @returns {Object} Provider info
       */
      getProvider(name) {
        const providerInfo = self.providers.get(name);

        if (!providerInfo) {
          const available = Array.from(self.providers.keys()).join(', ');
          throw self.apos.error('notfound',
            `AI provider "${name}" not found. Available providers: ${available || 'none'}`
          );
        }

        return providerInfo;
      },

      /**
       * Get the configured text provider
       * @returns {Object} Provider info and capabilities
       */
      getTextProvider() {
        const providerName = self.options.textProvider;
        const providerInfo = self.getProvider(providerName);

        if (!providerInfo.capabilities.text) {
          throw self.apos.error('invalid',
            `Provider "${providerName}" does not support text generation`
          );
        }

        return providerInfo.provider;
      },

      /**
       * Get the configured image provider
       * @returns {Object} Provider info and capabilities
       */
      getImageProvider() {
        const providerName = self.options.imageProvider;
        const providerInfo = self.getProvider(providerName);

        if (!providerInfo.capabilities.image) {
          throw self.apos.error('invalid',
            `Provider "${providerName}" does not support image generation`
          );
        }

        return providerInfo.provider;
      },

      /**
       * List all registered providers
       * @returns {Array} Array of provider info
       */
      listProviders() {
        return Array.from(self.providers.entries()).map(([name, info]) => ({
          name,
          label: info.label,
          capabilities: info.capabilities
        }));
      },

      /**
       * Check if user has permission to use AI features
       */
      checkPermissions(req) {
        // If the user cannot edit at least one content type, they have
        // no business talking to the AI
        if (!Object.keys(self.apos.modules).some(type =>
          self.apos.permission.can(req, 'edit', type)
        )) {
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
};
