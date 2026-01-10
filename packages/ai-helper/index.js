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
    // Storage for registered and active providers
    self.registeredProviders = new Map();
    self.activeProviders = new Map();

    // Register available providers (just metadata and factories)
    self.registerProviders();

    // Activate only the providers we're actually using
    await self.activateProviders();
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
       * Register available providers (metadata and factory functions only)
       * This method is intended to be extended to register custom providers
       */
      registerProviders() {
        // Register bundled providers
        self.registerProvider('openai', {
          factory: openaiProvider,
          label: 'OpenAI',
          capabilities: {
            text: true,
            image: true,
            imageVariation: true
          }
        });

        self.registerProvider('anthropic', {
          factory: anthropicProvider,
          label: 'Anthropic (Claude)',
          capabilities: {
            text: true,
            image: false,
            imageVariation: false
          }
        });

        self.registerProvider('gemini', {
          factory: geminiProvider,
          label: 'Google Gemini',
          capabilities: {
            text: true,
            image: true,
            imageVariation: true
          }
        });
      },

      /**
       * Activate only the providers that are actually configured for use
       */
      async activateProviders() {
        const textOpts = { ...self.options.textProviderOptions };
        const imageOpts = { ...self.options.imageProviderOptions };

        // Handle legacy options
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

        // Get unique providers that are actually being used
        const providersToActivate = new Set([
          self.options.textProvider,
          self.options.imageProvider
        ]);

        // Instantiate and validate only what we need
        for (const providerName of providersToActivate) {
          const factoryInfo = self.registeredProviders.get(providerName);

          if (!factoryInfo) {
            const available = Array.from(self.registeredProviders.keys()).join(', ');
            throw self.apos.error('notfound',
              `AI provider "${providerName}" not found. Available providers: ${available || 'none'}`
            );
          }

          // Call the factory function to instantiate the provider
          const provider = factoryInfo.factory(self.apos, textOpts, imageOpts);

          // Store the active provider
          self.activeProviders.set(providerName, {
            provider,
            label: factoryInfo.label,
            capabilities: factoryInfo.capabilities
          });

          // Validate the provider configuration
          if (!process.env.APOS_AI_HELPER_MOCK && provider.validate) {
            provider.validate();
          }

          self.apos.util.info('ai-helper:provider-activated', {
            name: providerName,
            label: factoryInfo.label
          });
        }
      },

      /**
       * Register a provider factory
       * @param {string} name - Provider name
       * @param {Object} factoryInfo - Factory information
       * @param {Function} factoryInfo.factory -
       * Factory function (apos, textOpts, imageOpts) => provider
       * @param {string} factoryInfo.label - Human-readable label
       * @param {Object} factoryInfo.capabilities - Supported features
       */
      registerProvider(name, factoryInfo) {
        if (!name) {
          throw new Error('Provider must have a name');
        }

        if (self.registeredProviders.has(name)) {
          throw new Error(`Provider "${name}" is already registered`);
        }

        const {
          factory,
          label,
          capabilities = {}
        } = factoryInfo;

        if (typeof factory !== 'function') {
          throw new Error(`Provider "${name}" must provide a factory function`);
        }

        if (!label) {
          throw new Error(`Provider "${name}" must have a label`);
        }

        // Store the factory information
        self.registeredProviders.set(name, {
          factory,
          label,
          capabilities
        });

        self.apos.util.info('ai-helper:provider-registered', {
          name,
          label
        });
      },

      /**
       * Get an activated provider by name
       * @param {string} name - Provider name
       * @returns {Object} Provider info
       */
      getProvider(name) {
        const providerInfo = self.activeProviders.get(name);

        if (!providerInfo) {
          const available = Array.from(self.activeProviders.keys()).join(', ');
          throw self.apos.error('notfound',
            `AI provider "${name}" not activated. Available providers: ${available || 'none'}`
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

        return providerInfo;
      },

      /**
       * Generate text using the configured provider
       * @param {Object} req - Request object
       * @param {string} prompt - Text prompt
       * @param {Object} options - Generation options
       * @returns {Promise<Object>} {content: string, metadata: object}
       */
      async generateText(req, prompt, options = {}) {
        const providerInfo = self.getTextProvider();
        return providerInfo.provider.generateText(req, prompt, options);
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

        return providerInfo;
      },

      /**
      * Generate images using the configured provider
      * @param {Object} req - Request object
      * @param {string} prompt - Image prompt
      * @param {Object} options - Generation options
      * @returns {Promise<Array>} Array of image objects
      */
      async generateImage(req, prompt, options = {}) {
        const providerInfo = self.getImageProvider();
        return providerInfo.provider.generateImage(req, prompt, options);
      },

      /**
 * Generate image variation using the configured provider
 * @param {Object} req - Request object
 * @param {Object} existing - Existing image record
 * @param {string} prompt - Variation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Array>} Array of image objects
 */
      async generateImageVariation(req, existing, prompt, options = {}) {
        const providerInfo = self.getImageProvider();

        // Check if provider supports variations
        if (!providerInfo.capabilities.imageVariation) {
          throw self.apos.error('invalid',
            `Provider "${self.options.imageProvider}" does not support image variations`
          );
        }

        return providerInfo.provider.generateImageVariation(
          req, existing, prompt, options
        );
      },

      /**
       * List all registered providers (whether active or not)
       * @returns {Array} Array of provider info
       */
      listRegisteredProviders() {
        return Array.from(self.registeredProviders.entries()).map(([ name, info ]) => ({
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
