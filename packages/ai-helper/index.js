const fs = require('fs');
const path = require('path');

module.exports = {
  options: {
    // Default providers for text and image generation
    textProvider: 'openai',
    imageProvider: 'openai',
    // Legacy option support
    textMaxTokens: 1000,
    // Usage tracking - can be set via option or
    // APOS_AI_HELPER_LOG_USAGE env var
    // When true, usage data is logged to the console
    // for cost tracking and auditing
    logUsage: process.env.APOS_AI_HELPER_LOG_USAGE === 'true' || false,
    // Usage storage - when true,
    // usage data is permanently stored in MongoDB
    // separate from logUsage to allow console logging
    // without database bloat
    storeUsage: process.env.APOS_AI_HELPER_STORE_USAGE === 'true' || false
  },

  async init(self) {
    // Storage for registered providers
    self.providers = new Map();

    // Initialize usage storage collection if enabled
    if (self.options.storeUsage) {
      self.aposAiHelperUsage = self.apos.db.collection('aposAiHelperUsage');
      await self.aposAiHelperUsage.createIndex(
        { createdAt: -1 },
        { name: 'createdAt_-1' }
      );

      // Index for per-user usage timelines
      await self.aposAiHelperUsage.createIndex(
        {
          userId: 1,
          createdAt: -1
        },
        { name: 'userId_1_createdAt_-1' }
      );
      self.apos.util.log('AI Helper usage storage enabled');
    }

    // Initialize usage tracking if enabled
    if (self.options.logUsage) {
      self.apos.util.log('AI Helper usage tracking enabled');
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
       * Log AI usage to console for monitoring and debugging
       * @param {Object} req - Request object
       * @param {Object} data - Usage data to log
       * @param {string} data.type - 'text' or 'image'
       * @param {string} data.provider - Provider name
       * @param {string} data.model - Model used
       * @param {string} data.prompt - User prompt
       * @param {Object} [data.usage] - Token usage data
       * @param {Object} [data.metadata] - Additional metadata
       */
      logUsage(req, data) {
        if (!self.options.logUsage) {
          return;
        }

        const username = req.user?.username || 'unknown';
        const {
          type, provider, prompt, metadata
        } = data;

        console.log(`\n[AI Usage] ${type} generation by ${username}:`);
        console.log({
          type,
          provider,
          ...metadata,
          prompt: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt
        });
      },

      /**
       * Store AI usage to MongoDB for permanent audit trail
       * @param {Object} req - Request object
       * @param {Object} data - Usage data to store
       * @param {string} data.type - 'text' or 'image'
       * @param {string} data.provider - Provider name
       * @param {string} data.prompt - User prompt
       * @param {Object} [data.metadata] - Additional metadata (usage, model, etc.)
       */
      async storeUsage(req, data) {
        if (!self.options.storeUsage) {
          return;
        }

        const {
          type, provider, prompt, metadata = {}
        } = data;

        const document = {
          _id: self.apos.util.generateId(),
          userId: req.user._id,
          username: req.user.username || req.user._id,
          createdAt: new Date(),
          type,
          provider,
          prompt,
          ...metadata
        };

        try {
          await self.aposAiHelperUsage.insertOne(document);
        } catch (e) {
          // Log error but don't fail the request
          self.apos.util.error('Failed to store AI usage:', e);
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
