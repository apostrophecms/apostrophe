/**
 * Anthropic (Claude) provider factory
 * @param {Object} apos - Apostrophe instance
 * @param {Object} textOptions - Text generation options
 * @returns {Object} Provider object
 */
module.exports = (apos, textOptions = {}) => {
  const apiKey = textOptions.apiKey || process.env.APOS_ANTHROPIC_KEY;
  const textModel = textOptions.textModel || 'claude-sonnet-4-20250514';
  const textMaxTokens = textOptions.textMaxTokens || 1000;
  const textRetries = textOptions.textRetries || 3;

  const validOptions = [
    'apiKey',
    'textModel',
    'textMaxTokens',
    'textRetries'
  ];
  const invalidOpts = Object.keys(textOptions).filter(k => !validOptions.includes(k));
  if (invalidOpts.length > 0) {
    apos.util.warn(`Anthropic provider received invalid options: ${invalidOpts.join(', ')}`);
  }

  return {
    name: 'anthropic',
    label: 'Anthropic (Claude)',
    capabilities: {
      text: true,
      image: false,
      imageVariation: false
    },

    /**
    * Validate provider configuration
    * @throws {Error} If required configuration is missing
    */
    validate() {
      if (!apiKey && !process.env.APOS_AI_HELPER_MOCK) {
        throw new Error(
          'Anthropic provider requires an API key. ' +
          'Set it via textProviderOptions.apiKey or export APOS_ANTHROPIC_KEY environment variable.'
        );
      }
    },

    /**
     * Generate text from a prompt
     * @param {Object} req - Apostrophe request object
     * @param {string} prompt - The text prompt
     * @param {Object} options - Generation options
     * @param {number} [options.maxTokens] - Maximum tokens to generate
     * @param {number} [options.textRetries] - Times to reattempt generation
     * @param {string} [options.model] - Model to use
     * @param {string} [options.systemPrompt] - System prompt to guide the model
     * @returns {Promise<Object>} {content: string, metadata: object}
     */
    async generateText(req, prompt, options = {}) {
      const maxTokens = options.maxTokens || textMaxTokens;
      const retries = options.textRetries || textRetries;
      const model = options.model || textModel;
      console.log('options', options);

      const body = {
        model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: options.systemPrompt || 'You are a helpful AI assistant.'
      };

      // Retry logic for transient failures
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const result = await apos.http.post('https://api.anthropic.com/v1/messages', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body
          });

          const content = result?.content?.[0]?.text;

          if (!content) {
            throw apos.error('error', 'No content returned from Anthropic');
          }

          return {
            content,
            metadata: {
              usage: result.usage,
              model: result.model,
              ...(result.stop_reason && { stop_reason: result.stop_reason })
            }
          };

        } catch (e) {

          apos.util.error(`Anthropic request failed (attempt ${attempt}/${retries}):`, e.message);

          if (e.status === 400 || e.status === 401 || e.status === 403) {
            throw e;
          }

          if (attempt === retries) {
            throw e;
          }

          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          apos.util.info(`Retrying Anthropic request (attempt ${attempt + 1}/${retries})...`);
        }
      }
    }
  };
};
