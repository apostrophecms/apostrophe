const fs = require('node:fs');

/**
 * Google Gemini provider factory
 * @param {Object} apos - Apostrophe instance
 * @param {Object} textOptions - Text generation options
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Provider object
 */
module.exports = (apos, textOptions = {}, imageOptions = {}) => {
  const apiKey = textOptions.apiKey || imageOptions.apiKey || process.env.APOS_GEMINI_KEY;
  const textModel = textOptions.textModel || 'gemini-2.5-flash-lite';
  const textMaxTokens = textOptions.textMaxTokens || 1000;
  const textRetries = textOptions.textRetries || 3;
  const imageModel = imageOptions.imageModel || 'gemini-2.5-flash-image';
  const imageCount = imageOptions.imageCount || 1;
  const imageAspectRatio = imageOptions.imageAspectRatio || '1:1';

  const validTextOptions = [ 'apiKey', 'textModel', 'textMaxTokens', 'textRetries' ];
  const validImageOptions = [ 'apiKey', 'imageModel', 'imageCount', 'imageAspectRatio' ];

  const invalidTextOpts =
  Object.keys(textOptions).filter(k => !validTextOptions.includes(k));
  if (invalidTextOpts.length > 0) {
    apos.util.warn(
      `Gemini provider received invalid textProviderOptions: ${invalidTextOpts.join(', ')}`
    );
  }

  const invalidImageOpts =
  Object.keys(imageOptions).filter(k => !validImageOptions.includes(k));
  if (invalidImageOpts.length > 0) {
    apos.util.warn(
      `Gemini provider received invalid imageProviderOptions: ${invalidImageOpts.join(', ')}`
    );
  }

  return {
    name: 'gemini',
    label: 'Google Gemini',
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
          'Gemini provider requires an API key. ' +
          'Set it via textProviderOptions.apiKey or export APOS_GEMINI_KEY environment variable.'
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
        system_instruction: {
          parts: [ {
            text: options.systemPrompt || 'You are a helpful AI assistant.'
          } ]
        },
        contents: [ {
          parts: [ {
            text: prompt
          } ]
        } ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const result = await apos.http.post(url, {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body
          });

          const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!content) {
            throw apos.error('error', 'No content returned from Gemini');
          }

          return {
            content,
            metadata: {
              ...(result.usageMetadata && { usage: result.usageMetadata }),
              ...(result.modelVersion && { model: result.modelVersion })
            }
          };

        } catch (e) {
          const msg = e.body?.error?.message || e.message;

          apos.util.error(`Gemini request failed (attempt ${attempt}/${retries}):`, msg);

          if (e.status === 400 || e.status === 401 || e.status === 403) {
            throw e;
          }

          if (attempt === retries) {
            throw e;
          }

          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          apos.util.info(`Retrying Gemini request (attempt ${attempt + 1}/${retries})...`);
        }
      }
    },

    /**
     * Generate images from a prompt
     * @param {Object} req - Apostrophe request object
     * @param {string} prompt - The image description
     * @param {Object} options - Generation options
     * @param {number} [options.imageCount] - Number of images to generate
     * @param {string} [options.imageAspectRatio] - Image relative dimensions
     * @param {string} [options.imageModel] - Model to use
     * @returns {Promise<Array<Object>>} Array of standardized image objects
     */
    async generateImage(req, prompt, options = {}) {
      const aspectRatio = options.imageAspectRatio || imageAspectRatio;
      const count = options.imageCount || imageCount;
      const model = options.imageModel || imageModel;

      const body = {
        contents: [ {
          parts: [ {
            text: prompt
          } ]
        } ],
        generationConfig: {
          responseModalities: [ 'Image' ],
          imageConfig: {
            aspectRatio
          }
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      try {
        const requests = Array.from({ length: count }, () =>
          apos.http.post(url, {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body
          })
        );

        const results = await Promise.all(requests);

        // Process all results
        const allImages = [];
        let aggregateUsage = null;

        for (const result of results) {
          const content = result?.candidates?.[0]?.content;
          const imageData = content?.parts?.[0]?.inlineData;

          if (!imageData?.data) {
            throw apos.error('error', 'No image data returned from Gemini');
          }

          // Accumulate usage across all API calls
          if (result.usageMetadata) {
            if (!aggregateUsage) {
              aggregateUsage = { ...result.usageMetadata };
            } else {
              const usage = result.usageMetadata;
              aggregateUsage.promptTokenCount =
                (aggregateUsage.promptTokenCount || 0) + (usage.promptTokenCount || 0);
              aggregateUsage.candidatesTokenCount =
                (aggregateUsage.candidatesTokenCount || 0) +
                (usage.candidatesTokenCount || 0);
              aggregateUsage.totalTokenCount =
                (aggregateUsage.totalTokenCount || 0) + (usage.totalTokenCount || 0);
            }
          }

          allImages.push({
            type: 'base64',
            data: imageData.data,
            metadata: {
              ...(imageData.mimeType && { mimeType: imageData.mimeType }),
              ...(result.modelVersion && { model: result.modelVersion }),
              aspectRatio,
              provider: 'gemini'
            }
          });
        }

        // Add aggregate usage to all images
        if (aggregateUsage) {
          allImages.forEach(img => {
            img.metadata.usage = aggregateUsage;
          });
        }

        return allImages;

      } catch (e) {
        const msg = e.body?.error?.message || e.message;
        apos.util.error('Gemini Image Error:', msg);
        if (e.status === 400) {
          throw apos.error('invalid', `Gemini Request Invalid: ${msg}`);
        }
        throw apos.error('error', `Gemini API Error: ${msg}`);
      }
    },

    /**
     * Generate variations of an existing image
     * @param {Object} req - Apostrophe request object
     * @param {Object} existing - The existing image record from database
     * @param {string} [prompt] - the variant prompt
     * @param {Object} options - Generation options
     * @param {number} [options.imageCount] - Number of variations to generate
     * @param {string} [options.imageAspectRatio] - Image relative dimensions
     * @param {string} [options.imageModel] - Model to use
     * @returns {Promise<Array<Object>>} Array of standardized image objects
     */
    async generateImageVariation(req, existing, prompt, options = {}) {
      const aspectRatio = options.imageAspectRatio || imageAspectRatio;
      const count = options.imageCount || imageCount;
      const model = options.imageModel || imageModel;

      let variationPrompt;
      if (prompt) {
        variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
      } else {
        variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
      }

      const imageModule = apos.image;
      const imagePath = await imageModule.aiHelperFetchImage(req, existing);
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');

      const body = {
        contents: [ {
          parts: [ {
            text: variationPrompt
          },
          {
            inline_data: {
              mime_type: 'image/png',
              data: base64Image
            }
          } ]
        } ],
        generationConfig: {
          responseModalities: [ 'Image' ],
          imageConfig: {
            aspectRatio
          }
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      try {
        const requests = Array.from({ length: count }, () =>
          apos.http.post(url, {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body
          })
        );

        const results = await Promise.all(requests);

        const allImages = [];
        let aggregateUsage = null;

        for (const result of results) {
          const content = result?.candidates?.[0]?.content;
          const imageData = content?.parts?.[0]?.inlineData;

          if (!imageData?.data) {
            throw apos.error('error', 'No image data returned from Gemini');
          }

          if (result.usageMetadata) {
            if (!aggregateUsage) {
              aggregateUsage = { ...result.usageMetadata };
            } else {
              aggregateUsage.promptTokenCount =
                (aggregateUsage.promptTokenCount || 0) +
                (result.usageMetadata.promptTokenCount || 0);
              aggregateUsage.candidatesTokenCount =
                (aggregateUsage.candidatesTokenCount || 0) +
                (result.usageMetadata.candidatesTokenCount || 0);
              aggregateUsage.totalTokenCount =
                (aggregateUsage.totalTokenCount || 0) +
                (result.usageMetadata.totalTokenCount || 0);
            }
          }

          allImages.push({
            type: 'base64',
            data: imageData.data,
            metadata: {
              ...(imageData.mimeType && { mimeType: imageData.mimeType }),
              ...(result.modelVersion && { model: result.modelVersion }),
              aspectRatio
            }
          });
        }

        if (aggregateUsage) {
          allImages.forEach(img => {
            img.metadata.usage = aggregateUsage;
          });
        }

        return allImages;

      } catch (e) {
        const msg = e.body?.error?.message || e.message;
        apos.util.error('Gemini Image Error:', msg);
        if (e.status === 400) {
          throw apos.error('invalid', `Gemini Request Invalid: ${msg}`);
        }
        throw apos.error('error', `Gemini API Error: ${msg}`);
      }
    }
  };
};
