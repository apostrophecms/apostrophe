<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80" />

  <h1>AI Helper</h1>

  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20" />
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/ai-helper/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639" />
    </a>
  </p>
</div>

**Bring AI-powered content generation directly into your ApostropheCMS editing workflow.** Generate compelling text and stunning images from simple prompts, all without leaving the CMS. Choose your preferred AI provider (OpenAI, Anthropic Claude, or Google Gemini) or connect to enterprise AI services.

## Why AI Helper? <!-- omit in toc -->

- **⚡ Accelerate Content Creation**: Generate high-quality text and images in seconds, not hours
- **🎯 Stay in Your Workflow**: AI generation built directly into the rich text editor and media manager
- **🔌 Your Choice of AI Provider**: Use OpenAI, Anthropic Claude, or Google Gemini - switch anytime

### **Table of Contents**
- [Installation](#installation)
- [Configuration](#configuration)
  - [Enable AI Text Generation](#enable-ai-text-generation)
  - [(Optional) Customize System Prompt](#optional-customize-system-prompt)
  - [(Optional) Configure Security Headers](#optional-configure-security-headers)
- [Usage](#usage)
  - [Generating Images](#generating-images)
  - [Generating Text](#generating-text)
- [Provider Configuration Options](#provider-configuration-options)
  - [OpenAI Provider](#openai-provider)
  - [Anthropic Provider](#anthropic-provider)
  - [Gemini Provider](#gemini-provider)
- [Mix and Match Providers](#mix-and-match-providers)
- [Bundled Providers](#bundled-providers)
- [Optional Usage Tracking](#optional-usage-tracking)
  - [Database Storage (Permanent Audit Trail)](#database-storage-permanent-audit-trail)
  - [Console Logging (Development \& Debugging)](#console-logging-development--debugging)
  - [Using Both Together](#using-both-together)
  - [Mock Testing](#mock-testing)
- [API Endpoints](#api-endpoints)
  - [List Available Providers](#list-available-providers)
- [Custom AI Providers](#custom-ai-providers)
- [💎 Ready for Enterprise AI Features?](#-ready-for-enterprise-ai-features)
  - [🚀 Pro AI Features](#-pro-ai-features)
- [Need Help?](#need-help)
- [License](#license)


## Installation
To install the module, use the command line to run this command in an Apostrophe project's root directory:

```bash
npm install @apostrophecms/ai-helper
```

All providers (OpenAI, Anthropic, Gemini) are bundled with the main package - no separate installation needed.

## Configuration

Configure the AI helper module in your `app.js` file:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    // Core AI helper module
    '@apostrophecms/ai-helper': {
      // Choose which providers to use
      textProvider: 'openai',    // 'openai', 'anthropic', or 'gemini'
      imageProvider: 'openai',   // 'openai' or 'gemini'
      // Optional: override text generation token limit
      textMaxTokens: 1000
    },

    // OpenAI provider configuration
    '@apostrophecms/ai-helper-openai': {
      apiKey: process.env.APOS_OPENAI_KEY,  // or export APOS_OPENAI_KEY env var
      textModel: 'gpt-5.1',
      imageModel: 'gpt-image-1-mini',
      size: '1024x1024',
      imageQuality: 'medium'
    },

    // Anthropic (Claude) provider configuration
    '@apostrophecms/ai-helper-anthropic': {
      apiKey: process.env.APOS_ANTHROPIC_KEY,  // or export APOS_ANTHROPIC_KEY env var
      textModel: 'claude-sonnet-4-20250514'
    },

    // Google Gemini provider configuration
    '@apostrophecms/ai-helper-gemini': {
      apiKey: process.env.APOS_GEMINI_KEY,  // or export APOS_GEMINI_KEY env var
      textModel: 'gemini-2.5-flash-lite',
      imageModel: 'gemini-2.5-flash-image',
      aspectRatio: '1:1'  // or '16:9', '9:16'
    }
  }
});
```

You only need to register and configure the providers you plan to use. Each provider requires its own API key from the respective service.

### Enable AI Text Generation

Add the AI option to your rich text widget toolbar in any area configuration:

```javascript
// modules/article/index.js
export default {
  extend: '@apostrophecms/piece-type',
  fields: {
    add: {
      main: {
        type: 'area',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'styles', 'bold', 'italic', 'bulletList', 'orderedList' ],
              insert: [ 'ai' ],  // Enable AI text generation
              styles: [
                { name: 'Heading', tag: 'h2' },
                { name: 'Subheading', tag: 'h3' },
                { name: 'Paragraph', tag: 'p' }
              ]
            }
          }
        }
      }
    }
  }
};
```

### (Optional) Customize System Prompt

Customize how the AI generates text by modifying the system prompt in your rich text widget configuration:

```javascript
// modules/article/index.js
export default {
  extend: '@apostrophecms/piece-type',
  fields: {
    add: {
      main: {
        type: 'area',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'styles', 'bold', 'italic', 'bulletList', 'orderedList' ],
              insert: [ 'ai' ],
              // Customize AI behavior
              customSystemPrompt: 'Write in a professional, technical tone suitable for enterprise documentation.',
              appendSystemPrompt: true  // Append to default guardrails instead of replacing
            }
          }
        }
      }
    }
  }
};
```

**Options:**
- `customSystemPrompt` - Your custom instructions for the AI
- `appendSystemPrompt` - When `true`, appends your prompt to the default guardrails. When `false`, replaces them entirely.

**Default System Prompt (guardrails):**
```
You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt. Do not include any meta-commentary, explanations, or offers to create additional versions. Output the content directly without preamble or postamble.
```

**Use Cases:**
- **Brand Voice**: "Write in a casual, friendly tone with occasional humor"
- **Technical Content**: "Write in precise, technical language suitable for developers"
- **Marketing**: "Write persuasive, benefit-focused copy that drives action"
- **SEO**: "Include relevant keywords naturally while maintaining readability"

> **Tip:** Set `appendSystemPrompt: true` to keep the default guardrails (Markdown formatting, no meta-commentary) while adding your brand voice or style requirements.

### (Optional) Configure Security Headers

If using the `@apostrophecms/security-headers` module, add AI image sources:

```javascript
// modules/@apostrophecms/security-headers/index.js
export default {
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

### Generating Images

1. Add an image widget to your page
2. Click "Browse" to open the media manager
3. Click the 🤖 robot button in the upper right
4. Enter a description and click "Generate"
5. Review the generated image(s) (1 is the default)
6. Click "Select" to import to media library, "Variants" for variations, or "Delete"

**Note:** Generated images expire after 1 hour if not imported to your media library.

### Generating Text

> **Note:** Generated content may include headings, bullet lists, bold, italic, and other formatting. Make sure your rich text widget toolbar includes the formatting options you want to preserve (e.g., `toolbar: [ 'styles', 'bold', 'italic', 'bulletList', 'orderedList' ]`). Unsupported formatting will be stripped when inserted.

1. In a rich text widget, press `/` at the start of a line
2. Choose "Generate Text"
3. Enter your prompt (be specific!)
4. Click "Generate"

**Prompt Tips:**
- Specify a word count: "Write 200 words about sustainable packaging"
- Request specific formats: "Write a bulleted list of 5 benefits of..."
- Ask for structure: "Write an article with 3 sections about cloud migration"
- Include tone: "Write a friendly, conversational guide to..."

## Provider Configuration Options

Each provider supports specific configuration parameters that can be set in `app.js`:

### OpenAI Provider
```javascript
'@apostrophecms/ai-helper-openai': {
  apiKey: process.env.APOS_OPENAI_KEY,
  textModel: 'gpt-5.1',            // Text model to use
  textMaxTokens: 1000,             // Max tokens for text generation
  imageModel: 'gpt-image-1-mini',  // Image model to use
    imageCount: 1,                 // Number of images to generate
  imageSize: '1024x1024',          // Image dimensions
  imageQuality: 'medium'           // 'low', 'medium', or 'high'
}
```

### Anthropic Provider
```javascript
'@apostrophecms/ai-helper-anthropic': {
  apiKey: process.env.APOS_ANTHROPIC_KEY,
  textModel: 'claude-sonnet-4-20250514',  // Claude model to use
  textMaxTokens: 1000                      // Max tokens for text generation
}
```

### Gemini Provider
```javascript
'@apostrophecms/ai-helper-gemini': {
  apiKey: process.env.APOS_GEMINI_KEY,
  textModel: 'gemini-2.5-flash-lite',     // Text model to use
  textMaxTokens: 1000,                    // Max tokens for text generation
  imageModel: 'gemini-2.5-flash-image',   // Image model to use
  imageCount: 1,                          // Number of images to generate
  imageAspectRatio: '1:1'                 // '1:1', '16:9', or '9:16'
}
```

> **Note:** These are default values used for all generations. Future versions may support per-request options through the UI.

## Mix and Match Providers

Use different providers for text and images to optimize for cost, quality, or capability:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@apostrophecms/ai-helper': {
      textProvider: 'anthropic',   // Use Claude for text generation
      imageProvider: 'gemini'      // Use Gemini for image generation
    },
    '@apostrophecms/ai-helper-anthropic': {
      apiKey: process.env.APOS_ANTHROPIC_KEY
    },
    '@apostrophecms/ai-helper-gemini': {
      apiKey: process.env.APOS_GEMINI_KEY,
      aspectRatio: '16:9'  // Gemini uses aspectRatio instead of size
    }
  }
});
```

**Note:** Provider switching is currently configured in `app.js`. A future admin UI may allow switching providers without code changes.

## Bundled Providers

All providers are included with `@apostrophecms/ai-helper` - no separate installation needed.

**@apostrophecms/ai-helper-openai**
- Text generation (GPT models)
- Image generation (GPT Image models)
- Image variations
- Uses `size` parameter (e.g., '1024x1024')

**@apostrophecms/ai-helper-anthropic**
- Text generation (Claude models)

**@apostrophecms/ai-helper-gemini**
- Text generation (Gemini models)
- Image generation (Gemini Image models)
- Image variations
- Uses `aspectRatio` parameter (e.g., '1:1', '16:9', '9:16')

## Optional Usage Tracking

AI Helper provides two independent usage tracking options - both disabled by default:

### Database Storage (Permanent Audit Trail)

Store all AI generations in MongoDB for permanent cost analysis and auditing:
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@apostrophecms/ai-helper': {
      storeUsage: true,  // Enable database storage
      textProvider: 'openai',
      imageProvider: 'gemini'
    }
  }
});
```

Alternatively, enable via environment variable:
```bash
export APOS_AI_HELPER_STORE_USAGE=true
```

When enabled, all generations are stored in the `aposAiHelperUsage` MongoDB collection with:
- `userId` - User who generated the content
- `username` - Username for easier reporting
- `createdAt` - Generation timestamp (indexed)
- `type` - 'text' or 'image'
- `provider` - Provider name (e.g., 'OpenAI', 'Anthropic (Claude)')
- `prompt` - The generation prompt
- `model` - Model used (if available from provider)
- `usage` - Token/usage statistics (if available from provider)
- Additional provider-specific metadata

Query this collection directly for cost analysis and reporting based on your organization's needs.

### Console Logging (Development & Debugging)

Log AI usage to the console for real-time monitoring during development:
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@apostrophecms/ai-helper': {
      logUsage: true,  // Enable console logging
      textProvider: 'openai',
      imageProvider: 'gemini'
    }
  }
});
```

Alternatively, enable via environment variable:
```bash
export APOS_AI_HELPER_LOG_USAGE=true
```

When enabled, each generation logs details to the console:
```
[AI Usage] text generation by admin:
{
  type: 'text',
  provider: 'OpenAI',
  model: 'gpt-5.1',
  usage: { prompt_tokens: 45, completion_tokens: 234, total_tokens: 279 },
  prompt: 'Write an article about...'
}
```

### Using Both Together

Enable both for comprehensive tracking:
```javascript
'@apostrophecms/ai-helper': {
  storeUsage: true,   // Permanent database storage
  logUsage: true,     // Real-time console output
  textProvider: 'openai',
  imageProvider: 'gemini'
}
```

Or via environment variables:
```bash
export APOS_AI_HELPER_STORE_USAGE=true
export APOS_AI_HELPER_LOG_USAGE=true
```

### Mock Testing

For offline development and testing without API calls or costs:
```bash
export APOS_AI_HELPER_MOCK=true
```

When enabled:
- Text generation returns pre-defined sample content
- Image generation returns placeholder images
- No API keys required
- No external network calls made
- Instant responses for rapid iteration

> [!Note]
> The usage returned by a mock call may not match the actual info returned by any selected provider.

## API Endpoints

### List Available Providers

Query the available AI providers and current configuration:

```javascript
// GET /api/v1/@apostrophecms/ai-helper/providers
const response = await apos.http.get(
  `${apos.modules['@apostrophecms/ai-helper'].action}/providers`
);

console.log(response);
// {
//   providers: [
//     {
//       name: 'openai',
//       label: 'OpenAI',
//       capabilities: { text: true, image: true, imageVariation: true }
//     },
//     {
//       name: 'anthropic',
//       label: 'Anthropic (Claude)',
//       capabilities: { text: true, image: false, imageVariation: false }
//     },
//     {
//       name: 'gemini',
//       label: 'Google Gemini',
//       capabilities: { text: true, image: true, imageVariation: true }
//     }
//   ],
//   configured: {
//     text: 'openai',
//     image: 'gemini'
//   }
// }
```

This endpoint is useful for:
- Admin UI to show/switch providers
- Debugging provider registration
- Health checks
- Auto-generating documentation

## Custom AI Providers

Beyond the built-in OpenAI, Anthropic, and Gemini integrations, `@apostrophecms/ai-helper` supports custom AI providers.

This is useful for:
- **AWS Bedrock** - Use Amazon's managed AI services
- **Azure OpenAI** - Connect to Microsoft's enterprise OpenAI offering
- **Private AI Services** - Integrate with self-hosted or enterprise AI models
- **Custom LLMs** - Connect to specialized or fine-tuned models

Advanced users can implement additional providers by following the provider contract defined in `node_modules/@apostrophecms/ai-helper/skills/provider-creator.md`. The guide documents required exports, capability flags, error handling, and testing expectations to ensure consistent behavior across providers. You can copy this file into your AI code assistant's context folder (e.g., Claude Projects skills, Cursor workspace) to help with provider development.

## 💎 Ready for Enterprise AI Features?

**Love AI Helper but need advanced capabilities?** Upgrade to **ApostropheCMS Pro** to unlock AI-powered features that transform your content workflow:

### 🚀 Pro AI Features
- **🌍 AI-Powered Translation** - Automatically translate content into 100+ languages using DeepL, Google Translate, or Azure
- **🔍 AI SEO Assistant** - Generate optimized meta descriptions, titles, and content recommendations

**[Contact our team](https://apostrophecms.com/contact-us)** to learn about Pro licensing and enterprise AI capabilities.

---

## Need Help?

- **Documentation**: [ApostropheCMS Documentation](https://apostrophecms.com/docs/)
- **Community Support**: [Join our Discord](https://discord.com/invite/HwntQpADJr)
- **Professional Support**: [Contact us](https://apostrophecms.com/contact-us) for dedicated support packages
- **Issues**: [GitHub Issues](https://github.com/apostrophecms/apostrophe/issues)

## License

MIT

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/ai-helper">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>