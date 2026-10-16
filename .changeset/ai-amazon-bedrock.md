---
"apostrophe": minor
---

The `apos.ai` Anthropic and OpenAI providers can now run on Amazon Bedrock: set `bedrockRegion` on the provider (e.g. `anthropic: { bedrockRegion: 'us-east-1' }`) and supply a Bedrock API key in `APOS_BEDROCK_KEY`. Claude keeps its usual low/medium/high models (Haiku 5.5, Sonnet 5.5, Opus 5.5). OpenAI uses the newest models Bedrock offers (GPT-6 Luna, GPT-5.6 Terra, GPT-6.1 Sol). Requests go through the region's cross-region inference profile by default; `bedrockProfile` chooses another, such as `global`. A provider's `apiKey` may now also be an async function, called before every request, so deployments using IAM credentials can mint short-term Bedrock tokens with `@aws/bedrock-token-generator`.
