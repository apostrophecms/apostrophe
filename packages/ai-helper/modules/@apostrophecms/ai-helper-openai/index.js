const fs = require('node:fs');
const FormData = require('form-data');

module.exports = {
  options: {
    // API key - can be set via option or APOS_OPENAI_KEY env var
    apiKey: process.env.APOS_OPENAI_KEY || null,
    // Default models
    textModel: 'gpt-5.1',
    // Default text generation settings
    textMaxTokens: 1000,
    imageModel: 'gpt-image-1-mini',
    imageSize: '1024x1024',
    imageQuality: 'medium',
    imageCount: 1
  },

  async init(self) {
    // Validate configuration (unless in mock mode)
    if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
      throw new Error(
        'Configure the `apiKey` option for the OpenAI provider' +
        ` in the "${self.__meta.name}" module or` +
        ' export APOS_OPENAI_KEY environment variable.'
      );
    }

    // Register this provider with the ai-helper module
    self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
      name: 'openai',
      label: 'OpenAI',
      text: true,
      image: true,
      imageVariation: true
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
       * @returns {Promise<string>} Generated text
      */
      async generateText(req, prompt, options = {}) {
        const maxTokens = options.maxTokens || self.options.textMaxTokens;
        const model = options.model || self.options.textModel;

        const body = {
          messages: [
            {
              role: 'system',
              content: options.systemPrompt || 'You are a helpful AI assistant.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model,
          max_completion_tokens: maxTokens
        };

        // Retry logic for transient failures
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await self.apos.http.post('https://api.openai.com/v1/chat/completions', {
              headers: {
                Authorization: `Bearer ${self.options.apiKey}`
              },
              body
            });

            const message = result?.choices?.[0]?.message;
            const content = message?.content;
            const refusal = message?.refusal;

            if (refusal) {
              // Don't retry refusals
              const error = self.apos.error('invalid', `OpenAI refused: ${refusal}`);
              error.userMessage = 'Content policy violation. Please try a different prompt.';
              throw error;
            }

            if (!content) {
              throw self.apos.error('error', 'No content returned from OpenAI');
            }

            return {
              content,
              metadata: {
                usage: result.usage,
                model: result.model,
                ...(
                  result.system_fingerprint && {
                    system_fingerprint: result.system_fingerprint
                  }),
                ...(result.created && { created: result.created })
              }
            };

          } catch (e) {
            lastError = e;

            // Log for debugging
            console.error(`OpenAI request failed (attempt ${attempt}/3):`, e.message);

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
            console.log(`Retrying OpenAI request (attempt ${attempt + 1}/3)...`);
          }
        }

        lastError.userMessage = 'AI service temporarily unavailable. Please try again in a moment.';
        throw lastError;
      },

      /**
       * Generate images from a prompt
       * @param {Object} req - Apostrophe request object
       * @param {string} prompt - The image description
       * @param {Object} options - Generation options
       * @param {string} [options.userPrompt] - the generation prompt
       * @param {number} [options.imageCount] - Number of images to generate
       * @param {string} [options.imageSize] - Image size
       * @param {string} [options.imageQuality] - image resolution
       * @param {string} [options.imageModel] - Model to use
       * @returns {Promise<Array<Object>>} Array of standardized image objects
       */
      async generateImage(req, prompt, options = {}) {
        const count = options.imageCount || self.options.imageCount || 1;
        const size = options.imageSize || self.options.imageSize || '1024x1024';
        const imageQuality = options.imageQuality || self.options.imageQuality || 'medium';
        const model = options.imageModel || self.options.imageModel;

        const body = {
          prompt,
          n: count,
          size,
          quality: imageQuality,
          model
        };

        const result = await self.apos.http.post('https://api.openai.com/v1/images/generations', {
          headers: {
            Authorization: `Bearer ${self.options.apiKey}`
          },
          body
        });

        if (!result.data) {
          throw self.apos.error('error', 'No image data returned from OpenAI');
        }

        // Transform OpenAI response to standardized format
        return result.data.map(item => ({
          type: item.url ? 'url' : 'base64',
          data: item.url || item.b64_json,
          metadata: {
            ...(result.usage && { usage: result.usage }),
            ...(result.created && { created: result.created }),
            ...(result.model && { model: result.model }),
            ...(result.size && { size: result.size }),
            ...(result.quality && { quality: result.quality }),
            ...(result.output_format && { output_format: result.output_format })
          }
        }));
      },

      /**
       * Generate variations of an existing image
       * @param {Object} req - Apostrophe request object
       * @param {Object} existing - The existing image record from database
       * @param {string} [prompt] - the variant prompt
       * @param {Object} options - Generation options
       * @param {number} [options.imageCount] - Number of variations to generate
       * @param {string} [options.imageSize] - Image size
       * @param {string} [options.imageQuality] - image resolution
       * @param {string} [options.imageModel] - Model to use
       * @returns {Promise<Array<Object>>} Array of standardized image objects
       */
      async generateImageVariation(req, existing, prompt, options = {}) {
        const count = options.imageCount || self.options.imageCount || 1;
        const size = options.imageSize || self.options.imageSize;
        const imageQuality = options.imageQuality || self.options.imageQuality;
        const model = options.imageModel || self.options.imageModel;

        // Build the variation prompt
        let variationPrompt;
        if (prompt) {
          variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
        } else {
          variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
        }

        // Fetch and prepare the image
        const imageModule = self.apos.image;
        const imagePath = await imageModule.aiHelperFetchImage(req, existing);

        const formData = new FormData();
        formData.append('image', fs.createReadStream(imagePath));
        formData.append('prompt', variationPrompt);
        formData.append('n', count);
        formData.append('size', size);
        formData.append('quality', imageQuality);
        formData.append('model', model);

        const result = await self.apos.http.post('https://api.openai.com/v1/images/edits', {
          headers: {
            Authorization: `Bearer ${self.options.apiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        if (!result.data) {
          throw self.apos.error('error', 'No image data returned from OpenAI');
        }

        // Transform OpenAI response to standardized format
        return result.data.map(item => ({
          type: item.url ? 'url' : 'base64',
          data: item.url || item.b64_json,
          metadata: {
            ...(result.usage && { usage: result.usage }),
            ...(result.created && { created: result.created }),
            ...(result.model && { model: result.model }),
            ...(result.size && { size: result.size }),
            ...(result.quality && { quality: result.quality }),
            ...(result.output_format && { output_format: result.output_format })
          }
        }));
      }
    };
  }
};
