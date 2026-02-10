const fs = require('node:fs');
const FormData = require('form-data');

/**
 * OpenAI provider factory
 * @param {Object} apos - Apostrophe instance
 * @param {Object} textOptions - Text generation options
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Provider object
 */
module.exports = (apos, textOptions = {}, imageOptions = {}) => {
  const apiKey = textOptions.apiKey || imageOptions.apiKey || process.env.APOS_OPENAI_KEY;
  const textModel = textOptions.textModel || 'gpt-5.1';
  const textMaxTokens = textOptions.textMaxTokens || 1000;
  const textRetries = textOptions.textRetries || 3;
  const imageModel = imageOptions.imageModel || 'gpt-image-1-mini';
  const imageSize = imageOptions.imageSize || '1024x1024';
  const imageQuality = imageOptions.imageQuality || 'medium';
  const imageCount = imageOptions.imageCount || 1;

  const validTextOptions = [ 'apiKey', 'textModel', 'textMaxTokens', 'textRetries' ];
  const validImageOptions = [ 'apiKey', 'imageModel', 'imageSize', 'imageQuality', 'imageCount' ];

  const invalidTextOpts =
  Object.keys(textOptions).filter(k => !validTextOptions.includes(k));
  if (invalidTextOpts.length > 0) {
    apos.util.warn(
      `OpenAI provider received invalid textProviderOptions: ${invalidTextOpts.join(', ')}`
    );
  }

  const invalidImageOpts =
  Object.keys(imageOptions).filter(k => !validImageOptions.includes(k));
  if (invalidImageOpts.length > 0) {
    apos.util.warn(
      `OpenAI provider received invalid imageProviderOptions: ${invalidImageOpts.join(', ')}`
    );
  }

  return {
    name: 'openai',
    label: 'OpenAI',
    capabilities: {
      text: true,
      image: true,
      imageVariation: true
    },

    /**
    * Validate provider configuration
    * @throws {Error} If required configuration is missing
    */
    validate() {
      if (!apiKey && !process.env.APOS_AI_HELPER_MOCK) {
        throw new Error(
          'OpenAI provider requires an API key. ' +
          'Set it via textProviderOptions.apiKey, imageProviderOptions.apiKey, ' +
          'or export APOS_OPENAI_KEY environment variable.'
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
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const result = await apos.http.post('https://api.openai.com/v1/chat/completions', {
            headers: {
              Authorization: `Bearer ${apiKey}`
            },
            body
          });

          const message = result?.choices?.[0]?.message;
          const content = message?.content;
          const refusal = message?.refusal;

          if (refusal) {
            const error = apos.error('invalid', `OpenAI refused: ${refusal}`);
            error.refusal = true;
            throw error;
          }

          if (!content) {
            throw apos.error('error', 'No content returned from OpenAI');
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
          apos.util.error(`OpenAI request failed (attempt ${attempt}/${retries}):`, e.message);

          // Don't retry on client errors (bad request, auth issues, etc.)
          if (e.status === 400 || e.status === 401 || e.status === 403) {
            throw e;
          }

          // Don't retry on last attempt
          if (attempt === retries) {
            throw e;
          }

          // Wait before retrying (exponential backoff: 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          apos.util.info(`Retrying OpenAI request (attempt ${attempt + 1}/${retries})...`);
        }
      }
    },

    /**
     * Generate images from a prompt
     * @param {Object} req - Apostrophe request object
     * @param {string} prompt - The image description
     * @param {Object} options - Generation options
     * @param {number} [options.imageCount] - Number of images to generate
     * @param {string} [options.imageSize] - Image size
     * @param {string} [options.imageQuality] - image resolution
     * @param {string} [options.imageModel] - Model to use
     * @returns {Promise<Array<Object>>} Array of standardized image objects
     */
    async generateImage(req, prompt, options = {}) {
      const count = options.imageCount || imageCount;
      const size = options.imageSize || imageSize;
      const quality = options.imageQuality || imageQuality;
      const model = options.imageModel || imageModel;

      const body = {
        prompt,
        n: count,
        size,
        quality,
        model
      };

      const result = await apos.http.post('https://api.openai.com/v1/images/generations', {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body
      });

      if (!result.data) {
        throw apos.error('error', 'No image data returned from OpenAI');
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
      const count = options.imageCount || imageCount;
      const size = options.imageSize || imageSize;
      const quality = options.imageQuality || imageQuality;
      const model = options.imageModel || imageModel;

      // Build the variation prompt
      let variationPrompt;
      if (prompt) {
        variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
      } else {
        variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
      }

      // Fetch and prepare the image
      const imageModule = apos.image;
      const imagePath = await imageModule.aiHelperFetchImage(req, existing);

      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('prompt', variationPrompt);
      formData.append('n', count);
      formData.append('size', size);
      formData.append('quality', quality);
      formData.append('model', model);

      const result = await apos.http.post('https://api.openai.com/v1/images/edits', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!result.data) {
        throw apos.error('error', 'No image data returned from OpenAI');
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
};
