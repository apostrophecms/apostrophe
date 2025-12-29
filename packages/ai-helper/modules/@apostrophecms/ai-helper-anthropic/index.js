module.exports = {
  options: {
    // API key - can be set via option or APOS_ANTHROPIC_KEY env var
    apiKey: process.env.APOS_ANTHROPIC_KEY || null,
    // Default model
    textModel: 'claude-sonnet-4-20250514',
    // Default text generation settings
    textMaxTokens: 1000
  },

  async init(self) {
    // Validate configuration (unless in mock mode)
    if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
      throw new Error(
        'Configure the `apiKey` option for the Anthropic provider' +
        ` in the "${self.__meta.name}" module or` +
        ' export APOS_ANTHROPIC_KEY environment variable.'
      );
    }

    // Register this provider with the ai-helper module
    self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
      name: 'anthropic',
      label: 'Anthropic (Claude)',
      text: true,
      image: false,
      imageVariation: false
    });
  },

  methods(self) {
    return {
      /**
       * Generate text from a prompt
       * @param {Object} req - Apostrophe request object
       * @param {string} prompt - The text prompt
       * @param {Object} options - Generation options
       * @param {number} [options.maxTokens] - Maximum tokens to generate
       * @param {string} [options.model] - Model to use
       * @param {string} [options.systemPrompt] - System prompt to guide the model
       * @returns {Promise<Object>} {content: string, metadata: object}
       */
      async generateText(req, prompt, options = {}) {
        const maxTokens = options.maxTokens || self.options.textMaxTokens;
        const model = options.model || self.options.textModel;

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
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await self.apos.http.post('https://api.anthropic.com/v1/messages', {
              headers: {
                'x-api-key': self.options.apiKey,
                'anthropic-version': '2023-06-01'
              },
              body
            });

            const content = result?.content?.[0]?.text;

            if (!content) {
              throw self.apos.error('error', 'No content returned from Anthropic');
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
            lastError = e;

            // Log for debugging
            console.error(`Anthropic request failed (attempt ${attempt}/3):`, e.message);

            // Don't retry on client errors (bad request, auth issues, etc.)
            if (e.status === 400 || e.status === 401 || e.status === 403) {
              e.userMessage = 'Invalid request. Please check your prompt and try again.';
              throw e;
            }

            // Don't retry on content policy violations
            if (e.userMessage) {
              throw e;
            }

            // Don't retry on last attempt
            if (attempt === 3) {
              e.userMessage = 'AI service temporarily unavailable. Please try again in a moment.';
              throw e;
            }

            // Wait before retrying (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            console.log(`Retrying Anthropic request (attempt ${attempt + 1}/3)...`);
          }
        }

        lastError.userMessage = 'AI service temporarily unavailable. Please try again in a moment.';
        throw lastError;
      }
    };
  }
};
