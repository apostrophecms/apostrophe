---
"apostrophe": minor
---

Added `apos.ai`, a provider-agnostic AI API for text generation with tool calling, image generation and background jobs. Feature code is written once, against one normalized surface: switching between Anthropic, OpenAI, Google or any OpenAI-compatible service is a configuration change, not a rewrite. It is opt-in - no provider and no key are configured out of the box.

- `@apostrophecms/ai`: the engine - normalized request and result shapes, a tool registry, an agent loop, effort levels, retries and a mock mode for tests.
- `@apostrophecms/ai-adapter-anthropic`: Anthropic (Claude) support, via the Messages API.
- `@apostrophecms/ai-adapter-openai`: OpenAI support, via the Responses and Images APIs.
- `@apostrophecms/ai-adapter-openai-compatible`: support for any Chat Completions service (Groq, Mistral, OpenRouter, Ollama, vLLM and friends) with no adapter code of your own.
- `@apostrophecms/ai-adapter-google`: Google (Gemini) support, text and images through one API.

Supporting changes, useful on their own:

- Notifications: a notification sent with `bus: true` is a pure event carrier - it is never rendered, and its `event` is emitted on `apos.bus` in exactly one browser tab, then dismissed. The options object may be passed in place of the message.
- Jobs: cooperative cancellation (`reporting.isCanceling()`, a `cancel` route and a `cancelled` status), an `expireAfter` option that expires job records from the database, `userId` ownership that restricts the status and cancel routes, a `notifications: false` option for callers with their own progress transport, and the error of a failed job recorded on its document.
- Schema: `apos.schema.extract()` returns the content of a doc or widget as a flat array of text and image items with dot paths, selected by the new `extractable` policy on field types and schema fields.
- Widgets: widget managers implement `extract()`, defaulting to a walk of their own schema; rich text and image widgets contribute their content directly, and `extractable` is accepted as a widget type option.
