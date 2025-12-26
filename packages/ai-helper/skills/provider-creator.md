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

If possible, follow the structure of the existing providers.

---

## Provider Contract (Required)

A provider module **must** export the same public interface as the built-in
providers.

At minimum:
- a client factory
- text generation support
- capability metadata

If image generation or edits are supported, those methods must also be
implemented.

**Reference implementations:**
- `providers/openai`
- `providers/anthropic`
- `providers/gemini`

Do not invent a new interface unless absolutely required by the upstream API.

---

## Capabilities

Each provider must explicitly declare its supported capabilities, including:
- text generation
- multimodal input
- image generation or edits
- streaming support
- context / token limits

Never assume OpenAI-style behavior.
Disable features the upstream service does not support.

This is especially important for providers that wrap multiple model families
(e.g. AWS Bedrock).

---

## Error Handling

All provider errors must be normalized.

Rules:
- Do not expose raw SDK or HTTP errors
- Do not leak provider-specific internals
- Return clear, human-readable messages
- Preserve actionable information when possible (e.g. auth vs rate-limit)

Consumers of `ai-helper` should not need to know which provider is in use to
understand an error.

---

## Image Handling Notes

Some providers have strict image requirements.

- Use existing image helper utilities
- Do not reimplement image conversion logic
- Pay attention to format requirements (PNG, RGBA, base64, etc.)
- Fail gracefully when edits or variants are unsupported

---

## Testing Checklist

Before considering a provider complete, verify:
- basic text generation
- image generation or edits (if supported)
- authentication failures
- rate-limit handling
- malformed input
- parity with existing providers

---

## Final Rule

If a provider behaves differently from OpenAI, Anthropic, or Gemini,
**document why** and disable unsupported features rather than guessing.
