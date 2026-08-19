// The engine's normalized vocabulary: the enum tables the core validates
// against and adapters translate into their provider dialects. Individual
// comparisons keep their string literal — these name the *set*.

// The image spend dial
const QUALITIES = Object.freeze([ 'low', 'medium', 'high' ]);

// The named aspect tokens and the conventional photo ratios they ground to
const NAMED_ASPECTS = Object.freeze({
  square: '1:1',
  portrait: '3:4',
  landscape: '4:3'
});

// The prompt-cache levels, besides false
const CACHE_POLICIES = Object.freeze([ 'short', 'long' ]);

// The roles a chat message may carry
const MESSAGE_ROLES = Object.freeze([ 'user', 'assistant', 'tool' ]);

// Content-part type → the message roles it is valid in
const PART_ROLES = Object.freeze({
  text: Object.freeze([ 'user', 'assistant' ]),
  image: Object.freeze([ 'user', 'assistant' ]),
  toolCall: Object.freeze([ 'assistant' ]),
  toolResult: Object.freeze([ 'tool' ])
});

// The finish reasons an adapter turn may report
const FINISH_REASONS = Object.freeze([
  'stop', 'toolCalls', 'length', 'refusal'
]);

// A tool's consequence class; scheduling and nesting rules derive from it
const TOOL_KINDS = Object.freeze([ 'query', 'action', 'agent' ]);

// What generate does with a transcript ending in unanswered tool calls
const PENDING_POLICIES = Object.freeze([ 'refuse', 'execute' ]);

// The options generate accepts
const GENERATE_OPTIONS = Object.freeze([
  'system', 'messages', 'tools', 'maxSteps', 'pending', 'toolInput',
  'schema', 'effort', 'provider', 'model', 'reasoning', 'maxTokens',
  'cache', 'signal', 'onMessage', 'onToolCall'
]);

// The options generateImage accepts
const IMAGE_OPTIONS = Object.freeze([
  'count', 'aspect', 'quality', 'images', 'provider', 'model', 'signal'
]);

// Doc types no AI action may touch, whatever the user's own permissions:
// accounts and permission grants, where a model's mistake is a privilege
// escalation. Not configurable, and deliberately every action, read
// included — a feature that needs user data ships a narrow tool for it
// rather than handing the model the doc.
// TODO: let modules register their own denied types, so the group type
// moves to the advanced permission module that owns it.
const DENIED_TYPES = Object.freeze([
  '@apostrophecms/user',
  '@apostrophecms-pro/advanced-permission-group'
]);

module.exports = {
  QUALITIES,
  NAMED_ASPECTS,
  CACHE_POLICIES,
  MESSAGE_ROLES,
  PART_ROLES,
  FINISH_REASONS,
  TOOL_KINDS,
  PENDING_POLICIES,
  GENERATE_OPTIONS,
  IMAGE_OPTIONS,
  DENIED_TYPES
};
