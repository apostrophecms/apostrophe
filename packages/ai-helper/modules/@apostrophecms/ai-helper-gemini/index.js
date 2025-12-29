const fs = require('node:fs');

module.exports = {
  options: {
    // API key - set via option or APOS_GEMINI_KEY env var
    apiKey: process.env.APOS_GEMINI_KEY || null,
    textModel: 'gemini-2.5-flash-lite',
    textMaxTokens: 1000,
    imageModel: 'gemini-2.5-flash-image',
    imageCount: 1,
    imageAspectRatio: '1:1'
  },

  async init(self) {
    if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
      throw new Error(
        'Configure the `apiKey` option for the Gemini provider' +
        ` in the "${self.__meta.name}" module or` +
        ' export APOS_GEMINI_KEY environment variable.'
      );
    }

    // Register this provider with the ai-helper module
    self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
      name: 'gemini',
      label: 'Google Gemini',
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
       * @param {string} [options.systemPrompt] - System prompt to guide the model
       * @returns {Promise<string>} Generated text
      */
      async generateText(req, prompt, options = {}) {
        const maxTokens = options.maxTokens || self.options.textMaxTokens;
        const model = options.model || self.options.textModel;

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

        // Standard Gemini generateContent endpoint
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        // Retry logic for transient failures
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await self.apos.http.post(url, {
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': self.options.apiKey
              },
              body
            });

            const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!content) {
              throw self.apos.error('error', 'No content returned from Gemini');
            }

            return {
              content,
              metadata: {
                ...(result.usageMetadata && { usage: result.usageMetadata }),
                ...(result.modelVersion && { model: result.modelVersion })
              }
            };

          } catch (e) {
            lastError = e;

            // Enhance error message for common Google API issues
            const msg = e.body?.error?.message || e.message;

            // Log for debugging
            console.error(`Gemini request failed (attempt ${attempt}/3):`, msg);

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
            console.log(`Retrying Gemini request (attempt ${attempt + 1}/3)...`);
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
       * @param {string} [options.imageAspectRatio] - Image size
       * @param {number} [options.imageCount] - Number of images to generate
       * @param {string} [options.imageModel] - Model to use
       * @returns {Promise<Array<Object>>} Array of standardized image objects
       */
      async generateImage(req, prompt, options = {}) {
        // Gemini supports specific aspect ratios, but we default to square
        const aspectRatio = options.imageAspectRatio || self.options.imageAspectRatio || '1:1';
        const imageCount = options.imageCount || self.options.imageCount || 1;
        const model = options.imageModel || self.options.imageModel;

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

        // Gemini generateContent endpoint
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        // Gemini returns one image per request,
        // so make multiple requests for multiple images
        const allImages = [];

        // Track aggregate usage across all API calls
        let aggregateUsage = null;

        try {
          for (let i = 0; i < imageCount; i++) {
            const result = await self.apos.http.post(url, {
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': self.options.apiKey
              },
              body
            });

            const content = result?.candidates?.[0]?.content;
            const imageData = content?.parts?.[0]?.inlineData;

            if (!imageData?.data) {
              throw self.apos.error('error', 'No image data returned from Gemini');
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

            // Transform Gemini response to standardized format
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

          // Add aggregate usage to all images so route can use images[0] for total cost
          if (aggregateUsage) {
            allImages.forEach(img => {
              img.metadata.usage = aggregateUsage;
            });
          }

          return allImages;

        } catch (e) {
          const msg = e.body?.error?.message || e.message;
          console.error('Gemini Image Error:', msg);
          // Handle common 400s (safety filters, bad request)
          if (e.status === 400) {
            throw self.apos.error('invalid', `Gemini Request Invalid: ${msg}`);
          }
          throw self.apos.error('error', `Gemini API Error: ${msg}`);
        }
      },

      /**
      * Generate variations of an existing image
      * @param {Object} req - Apostrophe request object
      * @param {Object} existing - The existing image record from database
      * @param {string} prompt - the variant prompt
      * @param {Object} options - Generation options
      * @param {number} [options.imageCount] - Number of variations to generate
      * @param {string} [options.imageAspectRatio] - Image size
      * @param {string} [options.imageModel] - Model to use
      * @returns {Promise<Array<Object>>} Array of standardized image objects
      */
      async generateImageVariation(req, existing, prompt, options = {}) {
        const aspectRatio = options.imageAspectRatio || self.options.imageAspectRatio || '1:1';
        const count = options.imageCount || self.options.imageCount || 1;
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

        // Gemini returns one image per request,
        // so make multiple requests for multiple variations
        const allImages = [];

        // Track aggregate usage across all API calls
        let aggregateUsage = null;

        try {
          for (let i = 0; i < count; i++) {
            const result = await self.apos.http.post(url, {
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': self.options.apiKey
              },
              body
            });

            const content = result?.candidates?.[0]?.content;
            const imageData = content?.parts?.[0]?.inlineData;

            if (!imageData?.data) {
              throw self.apos.error('error', 'No image data returned from Gemini');
            }

            // Accumulate usage across all API calls
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

            // Transform Gemini response to standardized format
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

          // Add aggregate usage to all images so route can use images[0] for total cost
          if (aggregateUsage) {
            allImages.forEach(img => {
              img.metadata.usage = aggregateUsage;
            });
          }

          return allImages;

        } catch (e) {
          const msg = e.body?.error?.message || e.message;
          console.error('Gemini Image Error:', msg);
          // Handle common 400s (safety filters, bad request)
          if (e.status === 400) {
            throw self.apos.error('invalid', `Gemini Request Invalid: ${msg}`);
          }
          throw self.apos.error('error', `Gemini API Error: ${msg}`);
        }
      }
    };
  }
};
