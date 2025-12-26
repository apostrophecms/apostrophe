const fs = require('fs');
const path = require('path');

module.exports = {
  options: {
    // Default providers for text and image generation
    textProvider: 'openai',
    imageProvider: 'openai',
    // Legacy option support
    textMaxTokens: 1000,
    // Debug logging for usage tracking
    logUsage: process.env.APOS_AI_HELPER_LOG_USAGE === 'true' || false
  },

  async init(self) {
    // Storage for registered providers
    self.providers = new Map();

    // Collection for text generation tracking
    self.aiHelperTextGenerations = self.apos.db.collection('aposAiHelperTextGenerations');
    await self.aiHelperTextGenerations.createIndex({
      userId: 1,
      timestamp: -1
    });
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
       * Register an AI provider module
       * @param {Object} provider - The provider module (self)
       * @param {Object} config - Provider configuration
       * @param {string} config.name - Unique provider name (e.g., 'openai', 'anthropic')
       * @param {string} config.label - Human-readable label
       * @param {boolean} [config.text] - Supports text generation
       * @param {boolean} [config.image] - Supports image generation
       * @param {boolean} [config.imageVariation] - Supports image variations
       */
      registerProvider(provider, config) {
        const {
          name,
          label,
          text = false,
          image = false,
          imageVariation = false
        } = config;

        if (!name) {
          throw new Error('Provider must have a name');
        }

        if (self.providers.has(name)) {
          throw new Error(`Provider "${name}" is already registered`);
        }

        // Validate that the provider implements required methods
        if (text && typeof provider.generateText !== 'function') {
          throw new Error(`Provider "${name}" claims text support but doesn't implement generateText()`);
        }

        if (image && typeof provider.generateImage !== 'function') {
          throw new Error(`Provider "${name}" claims image support but doesn't implement generateImage()`);
        }

        if (imageVariation && typeof provider.generateImageVariation !== 'function') {
          throw new Error(`Provider "${name}" claims imageVariation support but doesn't implement generateImageVariation()`);
        }

        self.providers.set(name, {
          module: provider,
          label,
          capabilities: {
            text,
            image,
            imageVariation
          }
        });

        self.apos.util.log(`AI provider registered: ${name} (${label})`);
      },

      /**
       * Get a registered provider by name
       * @param {string} name - Provider name
       * @returns {Object} Provider info
       */
      getProvider(name) {
        const provider = self.providers.get(name);

        if (!provider) {
          const available = Array.from(self.providers.keys()).join(', ');
          throw self.apos.error('notfound',
            `AI provider "${name}" not found. Available providers: ${available || 'none'}`
          );
        }

        return provider;
      },

      /**
       * Get the configured text provider
       * @returns {Object} Provider module and capabilities
       */
      getTextProvider() {
        const providerName = self.options.textProvider;
        const provider = self.getProvider(providerName);

        if (!provider.capabilities.text) {
          throw self.apos.error('invalid',
            `Provider "${providerName}" does not support text generation`
          );
        }

        return provider;
      },

      /**
       * Get the configured image provider
       * @returns {Object} Provider module and capabilities
       */
      getImageProvider() {
        const providerName = self.options.imageProvider;
        const provider = self.getProvider(providerName);

        if (!provider.capabilities.image) {
          throw self.apos.error('invalid',
            `Provider "${providerName}" does not support image generation`
          );
        }

        return provider;
      },

      /**
       * List all registered providers
       * @returns {Array} Array of provider info
       */
      listProviders() {
        return Array.from(self.providers.entries()).map(([ name, info ]) => ({
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
      },

      /**
       * Store text generation record
       * @param {Object} req - Request object
       * @param {string} prompt - The prompt used
       * @param {string} provider - Provider name
       * @param {Object} metadata - Generation metadata (usage, model, etc.)
       */
      async storeTextGeneration(req, prompt, provider, metadata) {
        await self.aiHelperTextGenerations.insertOne({
          userId: req.user._id,
          timestamp: new Date(),
          prompt,
          provider,
          ...metadata
        });
      }
    };
  },

  apiRoutes(self) {
    return {
      get: {
        /**
         * List all registered providers and current configuration
         * Useful for admin UI, debugging, and future provider switching
         */
        async providers(req) {
          // Require authenticated user
          if (!req.user) {
            throw self.apos.error('forbidden');
          }

          return {
            providers: self.listProviders(),
            configured: {
              text: self.options.textProvider,
              image: self.options.imageProvider
            }
          };
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
