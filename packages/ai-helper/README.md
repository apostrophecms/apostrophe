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

## ⚠️ Beta / Experimental Module <!-- omit in toc -->

**This module is experimental and will remain in beta status.** It provides early access to AI-powered content generation features in ApostropheCMS, but you should expect:

- **Functional but evolving**: Core features work well and are production-ready, but the UI/UX may not have the polish of finished ApostropheCMS modules
- **Active development**: Features and APIs may change as we refine the AI integration experience
- **Future migration**: Much of this functionality will eventually move into ApostropheCMS core as part of a comprehensive AI coordination system

**Who should use this module:**
- Developers comfortable with experimental features who want early access to AI capabilities
- Teams willing to provide feedback to help shape ApostropheCMS AI features
- Projects that can adapt to potential UI/API changes in future updates

**Stability note:** While the module is marked as beta, it is used in production environments. The "experimental" designation reflects ongoing UI refinement rather than fundamental instability.

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
  - [Mock Mode for Testing](#mock-mode-for-testing)
- [Usage](#usage)
  - [Generating Images](#generating-images)
  - [Generating Text](#generating-text)
- [Provider Configuration Options](#provider-configuration-options)
  - [OpenAI Provider](#openai-provider)
  - [Anthropic Provider](#anthropic-provider)
  - [Gemini Provider](#gemini-provider)
- [Mix and Match Providers](#mix-and-match-providers)
- [Bundled Providers](#bundled-providers)
- [Provider Metadata](#provider-metadata)
- [Custom AI Providers](#custom-ai-providers)
  - [Provider Architecture](#provider-architecture)
  - [Provider Registration](#provider-registration)
  - [Custom Provider Contract](#custom-provider-contract)
  - [Error Handling](#error-handling)
  - [Metadata](#metadata)
  - [Implementation Guidance](#implementation-guidance)
- [API Endpoints](#api-endpoints)
  - [List Registered Providers](#list-registered-providers)
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
    '@apostrophecms/ai-helper': {
      options: {
        // Choose which providers to use
        textProvider: 'openai',  // 'openai', 'anthropic', or 'gemini'
        imageProvider: 'openai',  // 'openai' or 'gemini'

        // Configure your text provider
        textProviderOptions: {
          apiKey: process.env.APOS_OPENAI_KEY,  // or export APOS_OPENAI_KEY
          textModel: 'gpt-5.1',
          textMaxTokens: 1000
        },

        // Configure your image provider
        imageProviderOptions: {
          apiKey: process.env.APOS_OPENAI_KEY,  // or export APOS_OPENAI_KEY
          imageModel: 'gpt-image-1-mini',
          imageSize: '1024x1024',
          imageQuality: 'medium',
          imageCount: 1
        }
      }
    }
  }
});
```
> **Note:** Providers are selected at application startup via `app.js` configuration.
> Switching providers at runtime via an admin UI is not currently supported.


**API Keys:**
Each provider requires its own API key. You can set them via:
- Environment variables: `APOS_OPENAI_KEY`, `APOS_ANTHROPIC_KEY`, `APOS_GEMINI_KEY`
- Configuration options: `textProviderOptions.apiKey` or `imageProviderOptions.apiKey`

> Note:
> You only need to provide keys for the services you will be using.

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

>**Default System Prompt (with guardrails):**
>```
>You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt. Do not include any meta-commentary, explanations, or offers to create additional versions. Output the content directly without preamble or postamble.
>```

Customize how the AI generates text by modifying the system prompt. This can be configured **globally** (affects all rich text widgets) or **per-area** (specific areas only). Note that any prompt passed to a widget in an area will override the prompt set globally.

**Precedence order:**
1. Per-area prompt
2. Global prompt
3. Default guardrails

**Global Configuration (in app.js):**
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@apostrophecms/rich-text-widget': {
      options: {
        customSystemPrompt: 'Write in a professional, technical tone suitable for enterprise documentation.',
        appendSystemPrompt: true  // Append to default guardrails instead of replacing
      }
    }
  }
});
```

**Per-Area Configuration:**
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
              // Customize AI behavior for this specific area
              customSystemPrompt: 'Write in a casual, conversational tone for blog content.',
              appendSystemPrompt: true
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

> **Tip:** Set `appendSystemPrompt: true` to keep the default guardrails (Markdown formatting, no meta-commentary) while adding your brand voice or style requirements. Per-area configuration overrides global settings.

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
**Note:** This is an example only. The exact `img-src` value depends on the AI provider and region you are using.

### Mock Mode for Testing

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

> **Note:** Mock mode metadata may not match actual provider responses exactly.

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

Each provider supports specific configuration parameters through `textProviderOptions` and `imageProviderOptions`:

### OpenAI Provider
```javascript
'@apostrophecms/ai-helper': {
  options: {
    textProvider: 'openai',
    imageProvider: 'openai',

    textProviderOptions: {
      apiKey: process.env.APOS_OPENAI_KEY,
      textModel: 'gpt-5.1', //  Text model to use
      textMaxTokens: 1000, //  Max tokens for text generation
      textRetries: 3 //  Times to reattempt generation on timeout
    },

    imageProviderOptions: {
      apiKey: process.env.APOS_OPENAI_KEY,
      imageModel: 'gpt-image-1-mini',  // Image model to use
      imageSize: '1024x1024',  // Image dimensions
      imageQuality: 'medium',  // 'low', 'medium', or 'high'
      imageCount: 1  //  Number of images to generate
    }
  }
}
```

### Anthropic Provider
```javascript
'@apostrophecms/ai-helper': {
  options: {
    textProvider: 'anthropic',

    textProviderOptions: {
      apiKey: process.env.APOS_ANTHROPIC_KEY,
      textModel: 'claude-sonnet-4-20250514',  // Claude model to use
      textMaxTokens: 1000,  // Max tokens for text generation
      textRetries: 3  // Times to reattempt generation on timeout
    }
  }
}
```

**Note:** Anthropic does not support image generation. Use OpenAI or Gemini for images.

### Gemini Provider
```javascript
'@apostrophecms/ai-helper': {
  options: {
    textProvider: 'gemini',
    imageProvider: 'gemini',

    textProviderOptions: {
      apiKey: process.env.APOS_GEMINI_KEY,
      textModel: 'gemini-2.5-flash-lite',  // Text model to use
      textMaxTokens: 1000,  // Max tokens for text generation
      textRetries: 3  // Times to reattempt generation on timeout
    },

    imageProviderOptions: {
      apiKey: process.env.APOS_GEMINI_KEY,
      imageModel: 'gemini-2.5-flash-image',   // Image model to use
      imageAspectRatio: '1:1',                // '1:1', '16:9', or '9:16'
      imageCount: 1                           // Number of images to generate
    }
  }
}
```

**Note:** Gemini uses `imageAspectRatio` instead of `imageSize`.

> The values shown are default values used for all generations. Future versions may support per-request options through the UI.

## Mix and Match Providers

Use different providers for text and images to optimize for cost, quality, or capability:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  modules: {
    '@apostrophecms/ai-helper': {
      options: {
        textProvider: 'anthropic',  // Use Claude for text generation
        imageProvider: 'gemini',  // Use Gemini for image generation

        textProviderOptions: {
          apiKey: process.env.APOS_ANTHROPIC_KEY,
          textModel: 'claude-sonnet-4-20250514'
        },

        imageProviderOptions: {
          apiKey: process.env.APOS_GEMINI_KEY,
          imageModel: 'gemini-2.5-flash-image',
          imageAspectRatio: '16:9'
        }
      }
    }
  }
});
```

**Note:** Provider switching is currently configured in `app.js`. A future admin UI may allow switching providers without code changes.

## Bundled Providers

All providers are included with `@apostrophecms/ai-helper` - no separate installation needed. They are implemented as lightweight factory functions and configured through `textProviderOptions` and `imageProviderOptions`.

**OpenAI** (`textProvider: 'openai'` / `imageProvider: 'openai'`)
- Text generation (GPT models)
- Image generation (GPT Image models)
- Image variations
- Uses `imageSize` parameter (e.g., '1024x1024')

**Anthropic** (`textProvider: 'anthropic'`)
- Text generation (Claude models)
- No image generation support

**Gemini** (`textProvider: 'gemini'` / `imageProvider: 'gemini'`)
- Text generation (Gemini models)
- Image generation (Gemini Image models)
- Image variations
- Uses `imageAspectRatio` parameter (e.g., '1:1', '16:9', '9:16')

## Provider Metadata

All providers return metadata with each generation, including:
- Model used
- Token counts and usage statistics
- Provider-specific details (stop reasons, timestamps, etc.)

**For text generation**, metadata is returned alongside the generated content in the API response. This allows you to capture usage information if needed for custom auditing or analytics at the project level.

**For image generation**, metadata is stored temporarily in the `aposAiHelperImages` collection as `providerMetadata` on each generated image. This data persists for 1 hour (until cleanup) or until the image is imported to your media library.

The module does not automatically log or persist this metadata beyond what's needed for operation. If you need detailed auditing, cost tracking, or analytics, you can extend the relevant modules to capture and process this data according to your requirements.

## Custom AI Providers

In addition to the bundled OpenAI, Anthropic, and Gemini providers, `@apostrophecms/ai-helper` supports **custom AI providers** for organizations that need to integrate enterprise platforms or internal AI services
(e.g. AWS Bedrock, Azure OpenAI, self-hosted models).

### Provider Architecture

The AI Helper uses a two-phase provider system:

1. **Registration** - Providers register their factory function and metadata (capabilities, label)
2. **Activation** - The core module instantiates only the providers actually configured for use

This means you can register multiple providers without the overhead of instantiating unused services.

### Provider Registration

Custom providers register a **factory function** along with metadata. The factory function
will be called by the core module during activation if the provider is configured for use.

Providers can be implemented either:

- As a **dedicated ApostropheCMS module**, or
- As a **factory function** registered during another module's initialization

Both patterns must register a factory function - the AI Helper core handles instantiation.

---

### Custom Provider Contract

Custom providers must implement a well-defined contract so the AI Helper can normalize behavior across different AI services.

> **Streaming responses are not currently supported.**
> Providers must return complete results for text and image generation.
> Partial or incremental responses will be ignored.

---

#### Provider Registration API

Providers register using `registerProvider(name, factoryInfo)`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique provider identifier (e.g. `"bedrock"`) |
| `factoryInfo.factory` | `function` | Factory function `(apos, textOpts, imageOpts) => provider` |
| `factoryInfo.label` | `string` | Human-readable name for admin UI |
| `factoryInfo.capabilities` | `object` | Declares supported features |

Example:
```javascript
aiHelper.registerProvider('bedrock', {
  factory: bedrockFactory,
  label: 'AWS Bedrock',
  capabilities: {
    text: true,
    image: false,
    imageVariation: false
  }
});
```

The factory function will be called with:
- `apos` - ApostropheCMS instance
- `textOpts` - Options from `textProviderOptions`
- `imageOpts` - Options from `imageProviderOptions`

If a custom provider registers using the same name as a bundled provider, it will override the bundled implementation.

---

#### Required Provider Properties

The provider object **returned by the factory** must include:

| Property | Type | Description |
|--------|------|-------------|
| `name` | `string` | Provider identifier (should match registration name) |
| `label` | `string` | Human-readable name |
| `capabilities` | `object` | Supported features |
| `validate` | `function` | Configuration validation method |

Plus methods for each declared capability (see below).

---

#### Required Methods

Providers must implement methods that correspond to their declared capabilities.

---

##### `validate()`

* Called during provider activation (after factory instantiation)
* Must throw an error if required configuration is missing
* Should be a no-op when `APOS_AI_HELPER_MOCK` is enabled

Used to:

* Verify API keys or credentials
* Validate required options
* Fail fast on misconfiguration

---

##### `generateText(req, prompt, options)`

**Required if `capabilities.text === true`**

* Generates text content from a prompt
* Must return the full generated result

Expected return shape:
```ts
{
  content: string,       // Markdown or HTML
  metadata?: object      // Usage, model, provider-specific data
}
```

---

##### `generateImage(req, prompt, options)`

**Required if `capabilities.image === true`**

* Generates one or more images from a prompt
* Must return complete image data

Expected return shape:
```ts
[
  {
    type: 'url' | 'base64',
    data: string,
    metadata?: object
  }
]
```

---

##### `generateImageVariation(req, image, prompt, options)`

**Required if `capabilities.imageVariation === true`**

* Generates a variant of an existing image based on an additional prompt or default

Expected return shape is the same as `generateImage`.

---

### Error Handling

* Providers should throw standard JavaScript `Error` objects
* The AI Helper will normalize errors into user-facing messages
* Provider-specific error details may be included in metadata when available

---

### Metadata

Providers may return provider-specific metadata, such as:

* Model name
* Token usage
* Stop reasons
* Timestamps or request IDs

Metadata is:

* Returned with text generation responses
* Temporarily stored for image generation (until import or cleanup)

---

### Implementation Guidance

Detailed implementation examples, testing guidance, and edge-case handling
are intentionally excluded from this README.

For full implementation details, see:

* **`provider-creator.md`** in this repository

This file can also be added to AI-assisted development tools
(e.g. Claude Projects, Cursor workspaces) to help generate
provider implementations safely and consistently.

## API Endpoints

### List Registered Providers

Query which AI providers are available for registration (whether currently active or not):
```javascript
const aiHelper = apos.modules['@apostrophecms/ai-helper'];
const providers = aiHelper.listRegisteredProviders();

console.log(providers);
// [
//   {
//     name: 'openai',
//     label: 'OpenAI',
//     capabilities: { text: true, image: true, imageVariation: true }
//   },
//   {
//     name: 'anthropic',
//     label: 'Anthropic (Claude)',
//     capabilities: { text: true, image: false, imageVariation: false }
//   },
//   {
//     name: 'gemini',
//     label: 'Google Gemini',
//     capabilities: { text: true, image: true, imageVariation: true }
//   }
// ]
```

This is useful for debugging provider registration, building admin UIs, or when creating custom providers that need to check what's already available.

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
- **Issues & Feedback**: [GitHub Issues](https://github.com/apostrophecms/apostrophe/issues) - Your feedback helps shape future AI features!

## License

MIT

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/ai-helper">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>