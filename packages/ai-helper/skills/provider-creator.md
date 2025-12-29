# AI Provider Creator (ApostropheCMS)

## Purpose

This guide defines the contract for adding a new AI provider to
`@apostrophecms/ai-helper`.

Use it when integrating enterprise or self-hosted AI services such as:
- AWS Bedrock
- Azure OpenAI
- private or on-prem LLM gateways

The goal is consistent behavior across all providers.

---

## When to Use This

Use this guide if you are:
- Adding a provider not shipped with the package
- Wrapping a hosted AI service with non-OpenAI semantics
- Supporting regulated or enterprise environments

If possible, follow the structure of the existing providers:
- `modules/@apostrophecms/ai-helper-openai`
- `modules/@apostrophecms/ai-helper-anthropic`
- `modules/@apostrophecms/ai-helper-gemini`

---

## Module Structure

Your provider module should follow this structure:

```javascript
module.exports = {
  options: {
    // API key configuration
    apiKey: process.env.APOS_YOUR_PROVIDER_KEY || null,
    // Default models and settings
    textModel: 'your-text-model',
    textMaxTokens: 1000,
    // Image settings (if supported)
    imageModel: 'your-image-model',
    imageCount: 1,
    imageSize: '1024x1024' // or aspectRatio for Gemini-style providers
  },

  async init(self) {
    // Validate API key unless in mock mode
    if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
      throw new Error(
        'Configure the `apiKey` option for Your Provider' +
        ` in the "${self.__meta.name}" module or` +
        ' export APOS_YOUR_PROVIDER_KEY environment variable.'
      );
    }

    // Register this provider with ai-helper
    self.apos.modules['@apostrophecms/ai-helper'].registerProvider(self, {
      name: 'your-provider',
      label: 'Your Provider Name',
      text: true,              // Supports text generation
      image: false,            // Supports image generation
      imageVariation: false    // Supports image variations/edits
    });
  },

  methods(self) {
    return {
      // Implement required methods based on capabilities
      async generateText(req, prompt, options = {}) { /* ... */ },
      async generateImage(req, prompt, options = {}) { /* ... */ },
      async generateImageVariation(req, existing, prompt, options = {}) { /* ... */ }
    };
  }
};
```

---

## Required Methods

### Text Generation (Required if `text: true`)

**Method Signature:**
```javascript
async generateText(req, prompt, options = {})
```

**Parameters:**
- `req` - Apostrophe request object with user context
- `prompt` - User's text generation prompt
- `options.maxTokens` - Maximum tokens to generate (from config or override)
- `options.model` - Model to use (from config or override)
- `options.systemPrompt` - System instructions to guide generation

**Return Format:**
```javascript
{
  content: string,        // The generated text
  metadata: {
    usage: {              // Token usage (if available)
      prompt_tokens: number,
      completion_tokens: number,
      total_tokens: number
    },
    model: string,        // Model identifier used
    // Additional provider-specific fields as needed
    stop_reason: string,
    created: number,
    system_fingerprint: string
  }
}
```

**System Prompt Handling:**

Different providers use different approaches for system prompts:

```javascript
// OpenAI-style (system message in messages array)
const body = {
  messages: [
    { role: 'system', content: options.systemPrompt || 'You are a helpful AI assistant.' },
    { role: 'user', content: prompt }
  ]
};

// Anthropic-style (separate system field)
const body = {
  system: options.systemPrompt || 'You are a helpful AI assistant.',
  messages: [{ role: 'user', content: prompt }]
};

// Gemini-style (system_instruction object)
const body = {
  system_instruction: {
    parts: [{ text: options.systemPrompt || 'You are a helpful AI assistant.' }]
  },
  contents: [{ parts: [{ text: prompt }] }]
};
```

**Example Implementation:**
```javascript
async generateText(req, prompt, options = {}) {
  const maxTokens = options.maxTokens || self.options.textMaxTokens;
  const model = options.model || self.options.textModel;

  const body = {
    // Adapt to your provider's API format
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: options.systemPrompt || 'You are a helpful AI assistant.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  // Include retry logic for transient failures (see reference implementations)
  const result = await self.apos.http.post('https://api.your-provider.com/v1/chat', {
    headers: {
      Authorization: `Bearer ${self.options.apiKey}`
    },
    body
  });

  const content = result?.choices?.[0]?.message?.content;

  if (!content) {
    throw self.apos.error('error', 'No content returned from provider');
  }

  return {
    content,
    metadata: {
      usage: result.usage,
      model: result.model,
      // Include any other relevant metadata
    }
  };
}
```

---

### Image Generation (Required if `image: true`)

**Method Signature:**
```javascript
async generateImage(req, prompt, options = {})
```

**Parameters:**
- `req` - Apostrophe request object
- `prompt` - Image description/generation prompt
- `options.imageCount` - Number of images to generate
- `options.imageSize` - Image dimensions (e.g., '1024x1024')
- `options.imageAspectRatio` - Aspect ratio (e.g., '1:1', '16:9') for Gemini-style
- `options.imageQuality` - Quality level
- `options.imageModel` - Model to use

**Return Format:**
```javascript
[
  {
    type: 'url' | 'base64',    // How image data is provided
    data: string,               // URL string or base64 string
    metadata: {
      usage: {                  // Token/cost usage (if available)
        prompt_tokens: number,
        total_tokens: number
      },
      model: string,            // Model used
      mimeType: string,         // For base64 images
      size: string,             // e.g., '1024x1024'
      aspectRatio: string,      // e.g., '1:1'
      // Additional provider-specific fields
    }
  },
  // ... more images if imageCount > 1
]
```

**Usage Accumulation for Multiple API Calls:**

If your provider requires multiple API calls to generate multiple images (like Gemini), you must accumulate usage statistics:

```javascript
async generateImage(req, prompt, options = {}) {
  const count = options.imageCount || self.options.imageCount || 1;
  const allImages = [];
  let aggregateUsage = null;

  for (let i = 0; i < count; i++) {
    const result = await self.apos.http.post(/* your API call */);
    
    // Accumulate usage across all calls
    if (result.usage) {
      if (!aggregateUsage) {
        aggregateUsage = { ...result.usage };
      } else {
        aggregateUsage.prompt_tokens = 
          (aggregateUsage.prompt_tokens || 0) + (result.usage.prompt_tokens || 0);
        aggregateUsage.completion_tokens = 
          (aggregateUsage.completion_tokens || 0) + (result.usage.completion_tokens || 0);
        aggregateUsage.total_tokens = 
          (aggregateUsage.total_tokens || 0) + (result.usage.total_tokens || 0);
      }
    }

    allImages.push({
      type: 'base64',
      data: result.image_data,
      metadata: {
        model: result.model,
        mimeType: 'image/png'
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
}
```

---

### Image Variation (Required if `imageVariation: true`)

**Method Signature:**
```javascript
async generateImageVariation(req, existing, prompt, options = {})
```

**Parameters:**
- `req` - Apostrophe request object
- `existing` - The existing image record from database
- `prompt` - Variation instructions (may be empty for generic reinterpretation)
- `options.imageCount` - Number of variations to generate
- `options.imageSize` / `options.imageAspectRatio` - Size settings
- `options.imageModel` - Model to use

**Image Fetching:**

Use the image module's helper to fetch the existing image:

```javascript
const imageModule = self.apos.image;
const imagePath = await imageModule.aiHelperFetchImage(req, existing);
```

**Return Format:** Same as `generateImage()` - array of standardized image objects

**Example Implementation:**
```javascript
async generateImageVariation(req, existing, prompt, options = {}) {
  const count = options.imageCount || self.options.imageCount || 1;
  
  // Build variation prompt
  let variationPrompt;
  if (prompt) {
    variationPrompt = `Using the provided image, please modify it as following: ${prompt}`;
  } else {
    variationPrompt = 'Using the provided image, please provide a creative reinterpretation with different style, colors, composition, or details.';
  }

  // Fetch the existing image
  const imageModule = self.apos.image;
  const imagePath = await imageModule.aiHelperFetchImage(req, existing);
  
  // Convert to format required by your provider
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  // Make API calls and return standardized format
  // (Follow same pattern as generateImage with usage accumulation)
}
```

---

## Error Handling

All provider errors must be normalized for consistent UX.

**Rules:**
- Do not expose raw SDK or HTTP errors to users
- Set appropriate `error.userMessage` for display
- Don't retry on client errors (400, 401, 403)
- Don't retry on content policy violations
- Use exponential backoff for transient failures (3 attempts recommended)

**Example Pattern:**
```javascript
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const result = await self.apos.http.post(/* ... */);
    return result;
  } catch (e) {
    lastError = e;
    console.error(`Request failed (attempt ${attempt}/3):`, e.message);

    // Don't retry on client errors
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

    // Exponential backoff: 1s, 2s
    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    console.log(`Retrying request (attempt ${attempt + 1}/3)...`);
  }
}

lastError.userMessage = 'AI service temporarily unavailable. Please try again in a moment.';
throw lastError;
```

---

## Mock Mode Support

Support offline testing via `APOS_AI_HELPER_MOCK` environment variable:

```javascript
async init(self) {
  // Only validate API key if not in mock mode
  if (!self.options.apiKey && !process.env.APOS_AI_HELPER_MOCK) {
    throw new Error('API key required');
  }
  // ...
}

async generateText(req, prompt, options = {}) {
  // Mock mode returns sample data without API calls
  if (process.env.APOS_AI_HELPER_MOCK) {
    return {
      content: 'Sample generated text for testing...',
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
  
  // Real implementation...
}
```

---

## Testing Checklist

Before considering a provider complete, verify:

**Text Generation:**
- [ ] Basic text generation works
- [ ] System prompt is respected
- [ ] Token limits are enforced
- [ ] Metadata includes usage statistics
- [ ] Authentication failures handled
- [ ] Rate limit errors handled
- [ ] Content policy violations handled
- [ ] Mock mode works without API keys

**Image Generation (if supported):**
- [ ] Single image generation works
- [ ] Multiple images work (imageCount > 1)
- [ ] Usage statistics accumulate correctly across multiple API calls
- [ ] Both URL and base64 formats work
- [ ] Image variations/edits work
- [ ] Size/aspect ratio parameters respected
- [ ] Authentication failures handled
- [ ] Rate limit errors handled
- [ ] Mock mode returns placeholder images

**Integration:**
- [ ] Provider registers successfully with ai-helper
- [ ] Can be set as textProvider or imageProvider
- [ ] Works alongside other providers
- [ ] Errors display user-friendly messages
- [ ] Console logging works (APOS_AI_HELPER_LOG_USAGE)
- [ ] Database storage works (APOS_AI_HELPER_STORE_USAGE)

---

## Best Practices

**Parameter Naming:**
- Prefer provider-native parameter names in module options
- Map to provider API format in methods (don't force OpenAI semantics)
- Document differences from other providers in module README

**Usage Tracking:**
- Always include usage metadata when available from provider
- Accumulate usage across multiple API calls (for multi-image generation)
- Ensure first image in array contains total aggregated usage
- Include model identifier for cost calculation

**System Prompts:**
- Always accept `options.systemPrompt` parameter
- Provide sensible default if not specified
- Adapt to your provider's system prompt mechanism

**Image Formats:**
- Return 'url' type when provider gives URLs
- Return 'base64' type when provider gives base64 data
- Include mimeType in metadata for base64 images
- Let image module handle format conversions

---

## Final Rule

If your provider behaves differently from OpenAI, Anthropic, or Gemini:
1. **Document why** in your provider module
2. **Disable unsupported features** via capability flags
3. **Don't guess** - fail gracefully with clear errors
4. **Test thoroughly** - especially error cases and edge conditions