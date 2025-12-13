const fs = require('node:fs');

module.exports = {
  options: {
    // API key - set via option or APOS_GEMINI_KEY env var
    apiKey: process.env.APOS_GEMINI_KEY || null,
    // Default Text Model (Gemini 2.5 Flash lite is fast and cheap)
    textModel: 'gemini-2.5-flash-lite',
    textMaxTokens: 1000,
    // Default Image Model (Gemini 2.5 Flash image is fast and cheap)
    imageModel: 'gemini-2.5-flash-image',
    imageCount: 1,
    aspectRatio: '1x1'
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
       * @returns {Promise<string>} Generated text
      */
      async generateText(req, prompt, options = {}) {
        const maxTokens = options.maxTokens || self.options.textMaxTokens;
        const model = options.model || self.options.textModel;

        const body = {
          system_instruction: {
            parts: [ {
              text: 'You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt. Do not include any meta-commentary, explanations, or offers to create additional versions. Output the content directly without preamble or postamble.'
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

            return content;

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
       * @param {string} [options.aspectRatio] - Image size
       * @param {number} [options.imageCount] - Number of images to generate
       * @param {string} [options.model] - Model to use
       * @returns {Promise<Array<string>>} Array of image URLs
       */
      async generateImage(req, prompt, options = {}) {
        // Gemini supports specific aspect ratios, but we default to square
        const aspectRatio = options.aspectRatio || self.options.aspectRatio || '1:1';
        const imageCount = options.imageCount || self.options.imageCount || 1;
        const model = options.model || self.options.imageModel;

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

            allImages.push({
              b64_json: imageData.data
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
       * @param {string} imagePath - Path to the source image file
       * @param {string} prompt - the variant prompt
       * @param {Object} options - Generation options
       * @param {number} [options.count] - Number of variations to generate
       * @param {string} [options.aspectRatio] - Image size
       * @param {string} [options.model] - Model to use
       * @returns {Promise<Array<string>>} Array of image URLs
       */
      async generateImageVariation(req, imagePath, prompt, options = {}) {
        const aspectRatio = options.aspectRatio || self.options.aspectRatio || '1:1';
        const count = options.count || 1;
        const model = options.model || self.options.imageModel;

        // Build the variation prompt
        let variationPrompt;
        if (prompt) {
          variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
        } else {
          variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
        }
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

            allImages.push({
              b64_json: imageData.data
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
