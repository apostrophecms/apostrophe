# AI Provider Creator (ApostropheCMS)

Create a **project-level** provider registration module + a provider **factory** for `@apostrophecms/ai-helper`.

This guide is optimized for an LLM to generate files.

---

## What you are generating

You will generate **two files**:

1. **Provider factory file** (ESM)

* Exports a function that returns a provider object (text/image methods + optional `validate`).

2. **Provider registration module** (ESM Apostrophe module)

* Extends `registerProviders()` and calls `self.registerProvider(...)` to register the factory.

> Note: `@apostrophecms/ai-helper` is CommonJS internally, but **project-level code examples here are ESM**.

---

## Core behavior you must match

### Two-phase provider flow

1. **Registration phase**
   You register provider factories with metadata using:

* `self.registerProvider(name, factory, capabilities)`

2. **Activation phase**
   `@apostrophecms/ai-helper` instantiates only the providers named in project options and (optionally) calls `provider.validate()`.

### Capabilities: source of truth

Capabilities are taken from the **registration metadata** (the `capabilities` argument to `registerProvider`), not from any `provider.capabilities` property.

Capabilities shape:

```js
{
  text: boolean,
  image: boolean,
  imageVariation: boolean
}
```

### validate(): optional

`validate()` is optional. If you provide it, it will be called at activation time **unless** mock mode is enabled (`APOS_AI_HELPER_MOCK`).

---

## Where the files live (recommended)

* Provider factory: `lib/ai-providers/<provider-name>.js`
* Registration module: `modules/<provider-name>-provider/index.js`

---

## Step 1 — Create the provider factory (ESM)

Create `lib/ai-providers/<provider-name>.js`

### Factory signature (required)

```js
export default function createProvider(apos, textOptions = {}, imageOptions = {}) {
  return {
    // optional
    validate() {},

    // optional depending on capabilities
    async generateText(req, prompt, options) {},
    async generateImage(req, prompt, options) {},
    async generateImageVariation(req, image, prompt, options) {}
  };
}
```

### Method return formats (required)

#### Text

`generateText()` must resolve to:

```js
{
  content: "string",
  metadata: {
    model: "string?",
    usage: {
      inputTokens: number?,
      outputTokens: number?
    }
  }
}
```

#### Images

`generateImage()` and `generateImageVariation()` must resolve to an **array** of:

```js
[
  {
    type: "png" | "jpg" | "webp" | "gif",
    data: "<base64 string>",   // base64 of the image bytes
    metadata: {
      model: "string?",
      usage: {
        inputTokens: number?,
        outputTokens: number?
      }
    }
  }
]
```

> If your upstream API returns a URL or binary data, you must convert it to base64 and return the standardized object(s).

### Error rules (recommended, not enforced)

* Prefer `throw apos.error(code, message)` so callers can classify errors.
* Recommended codes:

  * `invalid` (bad input/options)
  * `forbidden` (auth/permission)
  * `notfound` (model/asset missing)
  * `error` (generic)
* Messages can be developer-facing; UI should map codes to i18n strings.

### Retry rules (recommended)

* Retry: network errors, timeouts, 408, 429, 5xx
* Do not retry: 400, 401, 403 (and other non-transient 4xx)

---

## Step 2 — Create the provider registration module (ESM)

Create `modules/<provider-name>-provider/index.js`

This module’s job is only to **register** the provider factory under a unique name.

```js
import createProvider from '../../lib/ai-providers/<provider-name>.js';

export default {
  improve: '@apostrophecms/ai-helper',

  extendMethods(self) {
    return {
      registerProviders(_super) {
        _super();

        self.registerProvider(
          '<providerName>',       // the name used in project options
          createProvider,         // factory(apos, textOptions, imageOptions) => provider
          {
            text: true,           // set to true if provider supports text
            image: true,          // set to true if provider supports image generation
            imageVariation: true  // set true only if provider supports variations/edits
          }
        );
      }
    };
  }
};
```

### Override behavior (required knowledge)

If a project registers a provider with the same name as a built-in provider, it **replaces** that provider for activation purposes.

---

## Step 3 — Enable the registration module in the project (ESM)

In your project’s `app.js` (ESM), include the module:

```js
export default {
  modules: {
    '<provider-name>-provider': {}
  }
};
```

---

## Step 4 — Configure `@apostrophecms/ai-helper` to use it (ESM)

In `app.js`, configure the provider name(s) and options:

```js
export default {
  modules: {
    '@apostrophecms/ai-helper': {
      options: {
        // pick names registered via registerProvider(...)
        textProvider: '<providerName>',
        imageProvider: '<providerName>',

        // passed into the provider factory as:
        // createProvider(apos, textProviderOptions, imageProviderOptions)
        textProviderOptions: {
          // provider-specific
        },
        imageProviderOptions: {
          // provider-specific
        }
      }
    },

    '<provider-name>-provider': {}
  }
};
```

> `textProviderOptions` and `imageProviderOptions` are provider-defined. Your factory must read these and/or environment variables.

---

## Minimal template you can emit (copy/paste)

### `lib/ai-providers/<provider-name>.js`

```js
export default function createProvider(apos, textOptions = {}, imageOptions = {}) {
  const { apiKey } = textOptions;

  return {
    validate() {
      if (!process.env.APOS_AI_HELPER_MOCK && !apiKey) {
        throw apos.error('invalid', 'Missing required apiKey for <providerName>.');
      }
    },

    async generateText(req, prompt, options = {}) {
      // TODO call upstream API
      return {
        content: 'TODO',
        metadata: {
          model: options.model,
          usage: {}
        }
      };
    }
  };
}
```

### `modules/<provider-name>-provider/index.js`

```js
import createProvider from '../../lib/ai-providers/<provider-name>.js';

export default {
  improve: '@apostrophecms/ai-helper',
  extendMethods(self) {
    return {
      registerProviders(_super) {
        _super();
        self.registerProvider('<providerName>', createProvider, {
          text: true,
          image: false,
          imageVariation: false
        });
      }
    };
  }
};
```
