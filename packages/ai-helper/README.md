# @apostrophecms/ai-helper

AI-powered content generation for Apostrophe CMS 3.x using pluggable AI providers.

## Features

- 🤖 Generate images from text prompts
- ✍️ Generate rich text content from prompts
- 🔌 Pluggable provider architecture
- 🎯 Mix and match providers (e.g., Claude for text, DALL-E for images)

## Installation

### 1. Install the module
```bash
npm install @apostrophecms/ai-helper
```

All providers (OpenAI, Anthropic, Gemini) are bundled with the main package.

### 2. Configure in your project (defaults shown)
```javascript
// app.js
module.exports = {
  modules: {
    // Core AI helper module
    '@apostrophecms/ai-helper': {
      // Which providers to use
      textProvider: 'openai',    // 'openai', 'anthropic', or 'gemini'
      imageProvider: 'openai',   // 'openai' or 'gemini'
      // Optional: override text generation token limit
      textMaxTokens: 1000
    },

    // OpenAI provider
    '@apostrophecms/ai-helper-openai': {
      apiKey: process.env.APOS_OPENAI_KEY,  // or export APOS_OPENAI_KEY env var
      textModel: 'gpt-5.1',
      imageModel: 'gpt-image-1-mini'
      size: '1024x1024',
      imageQuality: 'medium'
    },

    // Anthropic provider
    '@apostrophecms/ai-helper-anthropic': {
      apiKey: process.env.APOS_ANTHROPIC_KEY,    // or export APOS_ANTHROPIC_KEY env var
      textModel: 'claude-sonnet-4-20250514'
    },

    // Gemini provider
    '@apostrophecms/ai-helper-gemini': {
      apiKey: process.env.APOS_GEMINI_KEY,       // or export APOS_GEMINI_KEY env var
      textModel: 'gemini-2.5-flash-lite',
      imageModel: 'gemini-2.5-flash-image',
      aspectRatio: '1:1'
    }
  }
};
```

**Note:** You only need to register and configure the providers you plan to use. Each provider requires its own API key.

### 3. Configure rich text widgets
```javascript
// In any area configuration
someArea: {
  widgets: {
    '@apostrophecms/rich-text': {
      toolbar: [ 'styles', 'bold' ],
      insert: [ 'ai' ],  // Enable AI text generation
      styles: [
        { name: 'Heading', tag: 'h2' },
        { name: 'Subheading', tag: 'h3' },
        { name: 'Paragraph', tag: 'p' }
      ]
    }
  }
}
```

### 4. (Optional) Configure security headers for images
```javascript
// modules/@apostrophecms/security-headers/index.js
// Only needed if you use the security-headers module
module.exports = {
  options: {
    policies: {
      ai: {
        'img-src': '*.blob.core.windows.net'  // OpenAI image URLs
      }
    }
  }
};
```

## Usage

### Image Generation

1. Add an image widget to your page
2. Click "Browse" to open the media manager
3. Click the 🤖 robot button in the upper right
4. Enter a description and click "Generate"
5. Review the generated image(s) (1 is the default)
6. Click "Select" to import to media library, "Variants" for variations, or "Delete"

**Note:** Generated images expire after 1 hour if not imported.

### Text Generation

> [!NOTE]
> Generated content may include headings, bullet lists, bold, italic, and other markdown formatting. Make sure your rich-text-widget toolbar includes the formatting options you want to preserve (e.g., `toolbar: [ 'styles', 'bold', 'italic', 'bulletList', 'orderedList' ]`). Unsupported formatting will be stripped when inserted.

1. In a rich text widget, press `/` at the start of a line
2. Choose "Generate Text"
3. Enter your prompt (be specific!)
4. Click "Generate"

**Tips:**
- Specify a word count: "Write 200 words about..."
- Request specific formats: "Write a bulleted list of..."
- Ask for headings: "Write an article with 3 sections about..."

## Mixed Providers

Use different providers for text and images:
```javascript
modules: {
  '@apostrophecms/ai-helper': {
    textProvider: 'anthropic',   // Claude for text
    imageProvider: 'gemini'      // Gemini for images
  },
  '@apostrophecms/ai-helper-anthropic': {
    apiKey: process.env.APOS_ANTHROPIC_KEY
  },
  '@apostrophecms/ai-helper-gemini': {
    apiKey: process.env.APOS_GEMINI_KEY,
    aspectRatio: '16:9'  // Gemini uses aspectRatio instead of size
  }
}
```

## Creating Custom Providers

See [Creating Custom Providers](./custom-providers.md) for a guide on building your own AI provider modules.

## Available Providers

### Bundled Providers

All of these providers are included with `@apostrophecms/ai-helper` - no separate installation needed.

- **@apostrophecms/ai-helper-openai**
  - Text generation (GPT models)
  - Image generation (GPT Image models)
  - Image variations
  - Uses `size` parameter (e.g., '1024x1024')

- **@apostrophecms/ai-helper-anthropic**
  - Text generation (Claude models)

- **@apostrophecms/ai-helper-gemini**
  - Text generation (Gemini models)
  - Image generation (Gemini Image models)
  - Image variations
  - Uses `aspectRatio` parameter (e.g., '1:1', '16:9', '9:16')

## License

MIT