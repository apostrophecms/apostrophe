# AI Provider Creator (ApostropheCMS)

**Purpose:** Define contract for custom AI providers integrating with `@apostrophecms/ai-helper`

## Scope & Non-Goals

This contract defines the **minimum required behavior** for AI providers
integrating with `@apostrophecms/ai-helper`.

> **Streaming responses are not currently supported.**
> Providers must return complete results for text and image generation.
> Partial or incremental responses will be ignored.

Support for streaming may be added in a future major version.

**Use for:** AWS Bedrock, Azure OpenAI, private LLM gateways, custom models

**Reference implementations:** See bundled providers in `modules/@apostrophecms/ai-helper/providers/`

---

## Two Implementation Patterns

Both patterns follow the same principle: **register a factory function**, not an instantiated provider. The AI Helper core calls your factory during activation.

### Module Pattern (Recommended)
Self-contained, full lifecycle access, reusable across projects.
```javascript
// modules/@my-org/ai-helper-bedrock/index.js

/**
 * Bedrock provider factory
 * @param {Object} apos - Apostrophe instance
 * @param {Object} textOptions - Text generation options
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Provider object
 */
const bedrockFactory = (apos, textOptions = {}, imageOptions = {}) => {
  const apiKey = textOptions.apiKey || process.env.BEDROCK_API_KEY;
  const textModel = textOptions.textModel || 'anthropic.claude-v2';
  const textMaxTokens = textOptions.textMaxTokens || 1000;
  const textRetries = textOptions.textRetries || 3;

  // Warn about invalid options
  const validTextOptions = ['apiKey', 'textModel', 'textMaxTokens', 'textRetries'];
  const invalidOpts = Object.keys(textOptions).filter(k => !validTextOptions.includes(k));
  if (invalidOpts.length > 0) {
    apos.util.warn(`Bedrock provider received invalid options: ${invalidOpts.join(', ')}`);
  }

  return {
    name: 'bedrock',
    label: 'AWS Bedrock',
    capabilities: {
      text: true,
      image: false,
      imageVariation: false
    },

    validate() {
      if (!apiKey && !process.env.APOS_AI_HELPER_MOCK) {
        throw new Error(
          'Bedrock provider requires an API key. ' +
          'Set it via textProviderOptions.apiKey or export BEDROCK_API_KEY environment variable.'
        );
      }
    },

    async generateText(req, prompt, options = {}) {
      const maxTokens = options.maxTokens || textMaxTokens;
      const retries = options.textRetries || textRetries;
      const model = options.model || textModel;

      // Mock mode support
      if (process.env.APOS_AI_HELPER_MOCK) {
        return {
          content: '# Sample Content\n\nThis is mock content for testing.',
          metadata: {
            model: 'mock-model',
            usage: {
              prompt_tokens: Math.ceil(prompt.length / 4),
              completion_tokens: 250,
              total_tokens: Math.ceil(prompt.length / 4) + 250
            }
          }
        };
      }

      // Real implementation with retry logic
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // PSEUDOCODE: AWS Bedrock requests require AWS SDK + SigV4 signing.
          // This example shows response handling only, not a real endpoint.
          const result = await apos.http.post('https://example-bedrock-endpoint.invalid', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: {
              model,
              max_tokens: maxTokens,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              system: options.systemPrompt || 'You are a helpful AI assistant.'
            }
          });

          const content = result?.content?.[0]?.text;

          if (!content) {
            throw apos.error('error', 'No content returned from Bedrock');
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
          apos.util.error(`Bedrock request failed (attempt ${attempt}/${retries}):`, e.message);

          // Don't retry on client errors
          if (e.status === 400 || e.status === 401 || e.status === 403) {
            throw e;
          }

          // Don't retry on last attempt
          if (attempt === retries) {
            throw e;
          }

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          apos.util.info(`Retrying Bedrock request (attempt ${attempt + 1}/${retries})...`);
        }
      }
    }
  };
};

module.exports = {
  async init(self) {
    // Register the factory function with AI Helper
    const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
    
    aiHelper.registerProvider('bedrock', {
      factory: bedrockFactory,
      label: 'AWS Bedrock',
      capabilities: {
        text: true,
        image: false,
        imageVariation: false
      }
    });
  }
};
```

**Enable in app.js:**
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@my-org/ai-helper-bedrock': {},
    '@apostrophecms/ai-helper': {
      options: {
        textProvider: 'bedrock',
        textProviderOptions: {
          apiKey: process.env.BEDROCK_API_KEY,
          textModel: 'anthropic.claude-v2',
          textMaxTokens: 2000
        }
      }
    }
  }
});
```

**How it works:**
1. Your module registers the factory function during `init()`
2. AI Helper stores the factory and metadata
3. When `textProvider: 'bedrock'` is configured, AI Helper calls your factory with the options
4. Your factory returns the instantiated provider
5. AI Helper calls `validate()` and uses the provider for text generation

---

### Factory Pattern
Lightweight, minimal overhead, follows bundled provider pattern. Good for simple integrations.
```javascript
// lib/providers/bedrock.js

/**
 * Bedrock provider factory
 * @param {Object} apos - Apostrophe instance
 * @param {Object} textOptions - Text generation options
 * @param {Object} imageOptions - Image generation options
 * @returns {Object} Provider object
 */
module.exports = (apos, textOptions = {}, imageOptions = {}) => {
  const apiKey = textOptions.apiKey || process.env.BEDROCK_API_KEY;
  const textModel = textOptions.textModel || 'anthropic.claude-v2';
  const textMaxTokens = textOptions.textMaxTokens || 1000;
  const textRetries = textOptions.textRetries || 3;

  return {
    name: 'bedrock',
    label: 'AWS Bedrock',
    capabilities: {
      text: true,
      image: false,
      imageVariation: false
    },

    validate() {
      if (!apiKey && !process.env.APOS_AI_HELPER_MOCK) {
        throw new Error('Bedrock provider requires an API key.');
      }
    },

    async generateText(req, prompt, options = {}) {
      // Same implementation as module pattern
      // ...
    }
  };
};
```

**Register in your project-level module:**
```javascript
// modules/my-custom-module/index.js
const bedrockFactory = require('../../lib/providers/bedrock');

module.exports = {
  async init(self) {
    const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
    
    // Register the factory function (not an instance!)
    aiHelper.registerProvider('bedrock', {
      factory: bedrockFactory,
      label: 'AWS Bedrock',
      capabilities: {
        text: true,
        image: false,
        imageVariation: false
      }
    });
  }
};
```

**Enable in app.js:**
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    'my-custom-module': {},
    '@apostrophecms/ai-helper': {
      options: {
        textProvider: 'bedrock',
        textProviderOptions: {
          apiKey: process.env.BEDROCK_API_KEY
        }
      }
    }
  }
});
```

**Key difference from module pattern:**
- Factory is in a separate file (`lib/providers/`)
- Registration happens in an existing module
- No separate npm package needed
- Good for one-off integrations

---

## Critical Architectural Concepts

### Why Register Factories, Not Instances?

**Two-phase system benefits:**

1. **No wasted instantiation** - Unused providers aren't created
2. **Clean separation** - Registration (metadata) vs activation (instantiation)
3. **Consistent interface** - All providers receive the same options from `textProviderOptions` / `imageProviderOptions`
4. **Fail fast** - Configuration errors caught during activation, not at generation time

**What happens when:**
```javascript
// Registration phase (during init)
aiHelper.registerProvider('bedrock', {
  factory: bedrockFactory,  // Just storing the function
  label: 'AWS Bedrock',
  capabilities: { text: true }
});

// Activation phase (after all modules loaded)
// Only if textProvider: 'bedrock' or imageProvider: 'bedrock'
const provider = factoryInfo.factory(apos, textOpts, imageOpts);
provider.validate();  // Fail fast if misconfigured
```

**Common mistake:**
```javascript
// ❌ WRONG - Calling factory during registration
const provider = bedrockFactory(self.apos, {}, {});
aiHelper.registerProvider('bedrock', {
  factory: provider,  // This is an instance, not a factory!
  // ...
});
```

This breaks because:
- Provider is instantiated even if never used
- Can't receive options from `textProviderOptions` / `imageProviderOptions`
- Validation happens at wrong time

**Correct approach:**
```javascript
// ✅ RIGHT - Registering the factory function
aiHelper.registerProvider('bedrock', {
  factory: bedrockFactory,  // Function reference
  label: 'AWS Bedrock',
  capabilities: { text: true }
});
```

## Required Signatures

### Options Handling

The `options` object is intentionally flexible and provider-specific.

Providers should:
- Accept relevant options when provided
- Ignore unknown options gracefully
- Warn (but not throw) on invalid configuration keys

### Text Generation
```javascript
async generateText(req, prompt, options = {})
```

**Parameters:**
- `options.maxTokens` - Max tokens to generate
- `options.model` - Model to use
- `options.systemPrompt` - System instructions

**Returns:**
```js
{
  content: string,
  metadata?: {
    usage?: object,
    model?: string,
    // provider-specific fields allowed
  }
}
```
**Notes**:
- content should ideally be Markdown, but plain text is acceptable
- Formatting expectations are enforced by the system prompt, not the provider
- metadata is optional but strongly recommended for usage tracking

**System Prompt Examples:**
```javascript
// OpenAI: system message in array
messages: [
  { role: 'system', content: options.systemPrompt || 'You are a helpful AI assistant.' },
  { role: 'user', content: prompt }
]

// Anthropic: separate system field
system: options.systemPrompt || 'You are a helpful AI assistant.',
messages: [{ role: 'user', content: prompt }]

// Gemini: system_instruction object
system_instruction: {
  parts: [{ text: options.systemPrompt || 'You are a helpful AI assistant.' }]
},
contents: [{ parts: [{ text: prompt }] }]
```

### Image Generation
```javascript
async generateImage(req, prompt, options = {})
```

**Parameters:**
- `options.imageCount` - Number of images
- `options.imageSize` - Dimensions (e.g., '1024x1024')
- `options.imageAspectRatio` - Ratio (e.g., '1:1', '16:9')
- `options.imageQuality` - Quality level
- `options.imageModel` - Model to use

Providers may generate images using a single API call or multiple parallel calls. If multiple calls are made, usage **must be aggregated** and attached to all images.

**Returns:**
```javascript
[
  {
    type: 'url' | 'base64',
    data: string,  // URL or base64 string
    metadata: {
      usage: {
        prompt_tokens: number,
        total_tokens: number
      },
      model: string,
      mimeType: string,  // for base64
      size: string,      // or aspectRatio
    }
  }
]
```

### Image Variation
```javascript
async generateImageVariation(req, existing, prompt, options = {})
```
**Notes**:
- Providers may return one or more variant images
- The number of variants is controlled by `options.imageCount`
- Providers should reuse the same standardized image return format as `generateImage`
- Usage must be aggregated if multiple API calls are made

**Fetch existing image:**
```javascript
const imageModule = apos.image;
const imagePath = await imageModule.aiHelperFetchImage(req, existing);
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString('base64');
```

**Build variation prompt:**
```javascript
let variationPrompt;
if (prompt) {
  variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
} else {
  variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
}
```

---

## Critical Rules

### 1. Usage Aggregation for Multi-Image Generation
**If your provider makes multiple API calls for multiple images, MUST accumulate usage:**

```javascript
async generateImage(req, prompt, options = {}) {
  const count = options.imageCount || imageCount;
  const allImages = [];
  let aggregateUsage = null;

  // Parallel requests recommended
  const requests = Array.from({ length: count }, () =>
    apos.http.post(url, { /* ... */ })
  );
  const results = await Promise.all(requests);

  for (const result of results) {
    // Accumulate usage
    if (result.usage) {
      if (!aggregateUsage) {
        aggregateUsage = { ...result.usage };
      } else {
        aggregateUsage.prompt_tokens = 
          (aggregateUsage.prompt_tokens || 0) + (result.usage.prompt_tokens || 0);
        aggregateUsage.total_tokens = 
          (aggregateUsage.total_tokens || 0) + (result.usage.total_tokens || 0);
      }
    }

    allImages.push({
      type: 'base64',
      data: result.image_data,
      metadata: { model: result.model }
    });
  }

  // CRITICAL: Add aggregate to ALL images
  if (aggregateUsage) {
    allImages.forEach(img => {
      img.metadata.usage = aggregateUsage;
    });
  }

  return allImages;
}
```

### 2. Error Handling Pattern (i18n-friendly)

Providers must **not** embed user-facing strings (e.g. `e.userMessage`) because the AI Helper core is responsible for converting errors into translated UI messages.

Providers should:

- Throw standard JavaScript `Error` objects, or use `apos.error(code, message)`
- Use **error codes** that the AI Helper core can map to translated messages
- Avoid placing user-facing English text in errors

**Recommended error codes:**
- `invalid` — bad request (malformed prompt/options) or provider rejected the request
- `policy` — content policy violation / safety rejection (if detectable)
- `unavailable` — transient provider outage / timeouts / 5xx
- `error` — everything else (unexpected failures)

**Retry guidance:**
- Do **not** retry for `400/401/403` responses
- Retry transient failures (`429`, `408`, `5xx`, network errors) with backoff

### 3. Mock Mode Support
```javascript
validate() {
  if (!apiKey && !process.env.APOS_AI_HELPER_MOCK) {
    throw new Error('API key required');
  }
}

async generateText(req, prompt, options = {}) {
  if (process.env.APOS_AI_HELPER_MOCK) {
    return {
      content: 'Sample text...',
      metadata: {
        model: 'mock-model',
        usage: {
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: 250,
          total_tokens: Math.ceil(prompt.length / 4) + 250
        }
      }
    };
  }
  // Real implementation
}
```

---

## Common Gotchas

**❌ Each image has only its API call's usage** → Total cost understated
**✅ All images have aggregated usage** → Accurate cost tracking

**❌ Throwing user-facing English strings from providers** → breaks i18n
**✅ Throwing typed errors (`invalid`, `policy`, `unavailable`)** → core can translate consistently

**❌ Retrying client errors (400/401/403)** → Wastes time
**✅ Only retry transient failures** → Fast failure on bad requests

**❌ Sequential image generation** → Slow
**✅ Parallel with `Promise.all()`** → Fast

**❌ Hardcoded system prompts** → Inflexible
**✅ Accept `options.systemPrompt`** → Customizable per widget

**❌ Forgetting mock mode** → Can't test offline
**✅ Check `APOS_AI_HELPER_MOCK`** → Offline testing

---

## Testing Checklist

**Text:**
- [ ] Basic generation works
- [ ] System prompt respected
- [ ] Token limits enforced
- [ ] Metadata includes usage
- [ ] Retry logic works
- [ ] Mock mode works

**Images (if supported):**
- [ ] Single image works
- [ ] Multiple images work
- [ ] **Usage accumulates across calls**
- [ ] **All images have aggregate usage**
- [ ] URL and base64 formats work
- [ ] Variations work (if supported)
- [ ] Parallel requests used
- [ ] Mock mode works

**Integration:**
- [ ] Registers successfully
- [ ] Works as textProvider/imageProvider
- [ ] User-friendly error messages
- [ ] Works alongside other providers