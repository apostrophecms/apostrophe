# Creating Custom AI Providers

This guide shows you how to create a custom provider for `@apostrophecms/ai-helper`.

**Note:** The `@apostrophecms/ai-helper` package includes three bundled providers (OpenAI, Anthropic, Gemini). This guide is for creating additional community providers as separate npm packages.

## Overview

A provider is an Apostrophe module that:
1. Registers itself with `@apostrophecms/ai-helper`
2. Implements one or more generation methods
3. Can be configured independently

## Minimal Example

Here's a complete provider for Perplexity AI:
```javascript
// @apostrophecms/ai-helper-perplexity/index.js
module.exports = {
  options: {
    apiKey: process.env.APOS_PERPLEXITY_KEY || null,
    textModel: 'llama-3.1-sonar-large-128k-online',
    textMaxTokens: 1000
  },

  async init(self) {
    // Validate API key
    if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
      throw new Error(
        'Configure the `apiKey` option for the Perplexity provider' +
        ` in the "${self.__meta.name}" module or` +
        ' export APOS_PERPLEXITY_KEY environment variable.'
      );
    }
    
    // Register with ai-helper
    self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
      name: 'perplexity',
      label: 'Perplexity',
      text: true,         // Supports text generation
      image: false,       // Does not support images
      imageVariation: false
    });
  },
  
  methods(self) {
    return {
      async generateText(req, prompt, options = {}) {
        const maxTokens = options.maxTokens || self.options.textMaxTokens;
        const model = options.model || self.options.textModel;
        
        const body = {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens
        };
        
        const result = await self.apos.http.post('https://api.perplexity.ai/chat/completions', {
          headers: {
            'Authorization': `Bearer ${self.options.apiKey}`,
            'Content-Type': 'application/json'
          },
          body
        });
        const content = result?.choices?.[0]?.message?.content;
        if (!content) {
          throw self.apos.error('error', 'No content returned from Perplexity');
        }
        return content;
      }
    };
  }
};
```

## Provider Interface

### Registration

In your `init` method, call `registerProvider()`:
```javascript
self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
  name: 'your-provider-name',    // Unique identifier
  label: 'Your Provider Label',  // Display name
  text: true,                     // Implements generateText()?
  image: false,                   // Implements generateImage()?
  imageVariation: false           // Implements generateImageVariation()?
});
```

### Required Methods

Implement only the methods you declared support for:

**Note on Options:** Each provider can define its own option parameters. For example:
- **Text generation:** OpenAI uses `max_completion_tokens`, Anthropic uses `max_tokens`, Gemini uses `maxOutputTokens`
- **Image generation:** OpenAI uses `size` (e.g., '1024x1024') and `count`, Gemini uses `aspectRatio` (e.g., '1:1', '16:9') and `imageCount`
- Your provider can use whatever parameters make sense for your API

The core system passes the `options` object through to your methods unchanged, so you have full control over your provider's API.

#### `generateText(req, prompt, options)`

Generate text from a prompt.

**Parameters:**
- `req` - Apostrophe request object
- `prompt` - String prompt from user
- `options` - Object with optional, provider-specific parameters such as:
  - `model` - Model name override
  - `maxTokens` - Maximum tokens to generate (provider-specific naming/implementation)
  - Other provider-specific options

**Returns:** Promise<String> - Generated text (preferably Markdown)

#### `generateImage(req, prompt, options)`

Generate images from a prompt.

**Parameters:**
- `req` - Apostrophe request object
- `prompt` - String description from user
- `options` - Object with optional, provider-specific parameters such as:
  - `model` - Model name override
  - `count` or `imageCount` - Number of images to generate
  - `size` - Image dimensions (e.g., '1024x1024') - OpenAI style
  - `aspectRatio` - Image aspect ratio (e.g., '1:1', '16:9') - Gemini style
  - `userPrompt` - Additional user prompt text
  - Other provider-specific options

**Returns:** Promise<Array<Object>> - Array of image objects with either `url` or `b64_json` property

#### `generateImageVariation(req, imagePath, options)`

Generate variations of an existing image.

**Parameters:**
- `req` - Apostrophe request object
- `imagePath` - String path to source image file on disk
- `options` - Object with optional, provider-specific parameters such as:
  - `model` - Model name override
  - `count` - Number of variations to generate
  - `size` - Image dimensions - OpenAI style
  - `aspectRatio` - Image aspect ratio - Gemini style
  - `userPrompt` - Description of how to modify the image
  - Other provider-specific options

**Returns:** Promise<Array<Object>> - Array of image objects with either `url` or `b64_json` property

## Configuration

Users configure your provider in `app.js`:
```javascript
modules: {
  '@apostrophecms/ai-helper': {
    textProvider: 'your-provider-name'
  },
  '@apostrophecms/ai-helper-your-provider': {
    apiKey: process.env.YOUR_API_KEY,
    someOption: 'value'
  }
}
```

## Package.json
```json
{
  "name": "@apostrophecms/ai-helper-your-provider",
  "version": "1.0.0",
  "description": "Your Provider for @apostrophecms/ai-helper",
  "main": "index.js",
  "peerDependencies": {
    "@apostrophecms/ai-helper": "^1.0.0",
    "apostrophe": "^3.0.0"
  },
  "dependencies": {
    "your-sdk": "^1.0.0"
  }
}
```

## Testing

Support mock mode for testing without API calls:
```javascript
async init(self) {
  if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
    throw new Error('API key required');
  }

  // Skip API validation in mock mode
  if (!process.env.APOS_AI_HELPER_MOCK) {
    await self.validateApiKey();
  }

  // Register normally
  self.apos.modules['@apostrophecms/ai-helper'].registerProvider(/* ... */);
}
```

## Error Handling

Use Apostrophe's error system:
```javascript
if (!result) {
  throw self.apos.error('error', 'API returned no data');
}

if (response.status === 429) {
  throw self.apos.error('ratelimit', 'Rate limit exceeded');
}
```

## Full-Featured Example

For complete reference implementations, see the bundled providers in the main repository:
- @apostrophecms/ai-helper-openai (supports text, images, and variations)
- @apostrophecms/ai-helper-anthropic (supports text)
- @apostrophecms/ai-helper-gemini (supports text, images, and variations)

These are located in the `modules/@apostrophecms/` directory of the `@apostrophecms/ai-helper` package.

## Publishing

1. Create a GitHub repository
2. Publish to npm: `npm publish --access public`
3. Submit a PR to add your provider to the main README

## Questions?

Open an issue on the [@apostrophecms/ai-helper](https://github.com/apostrophecms/ai-helper) repository!