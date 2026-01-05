const marked = require('marked');

// Canned sample results for cheap & offline testing
const mockContent = '\n# Glamping Cats\n\n## The Feline Appeal\nGlamping cats have become increasingly popular in recent years, with many people choosing to include their cats in their glamping experience. Cats are incredibly adaptive and can quickly become accustomed to new environments with minimal stress. They can also make perfect glamping companions, as their intelligence and inquisitive nature ensure that they will quickly find ways to entertain themselves and those around them.\n\n## Glamping Must-Haves\nBefore taking your cat on a glamping vacation, make sure you are prepared. Consider bringing items such as litterbox, food dish, bedding material, and toys. Each of these items can help create an enjoyable and stress-free environment for your cat while glamping.\n\n## RV Luxuries\nRVs come equipped with a variety of amenities that make glamping with cats more enjoyable. Consider portable kennels and carriers for your cat, as well as waterproof mats and blankets for lounging. RV heating capabilities can also create a comfortable and safe environment for your cat, no matter the temperature outside. \n\n## All-Weather Fun\nGlamping with cats can provide opportunities for outdoor fun regardless of the weather. Rainy days can be spent cuddling cats inside, while sunny days can offer the adventure of roaming the outdoors. Glamping can also offer cats the opportunity to meet new people and explore new environments.\n\n## A Special Bond\nUltimately, glamping with cats can create a special bond between you and your pet. Cats tend to be incredibly social creatures and thrive off of human interaction. Glamping with cats offers the perfect opportunity to strengthen your relationship and appreciate the wonders of nature.';

module.exports = {
  improve: '@apostrophecms/rich-text-widget',
  options: {
    // Default system prompt with guardrails for text generation
    systemPrompt: 'You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt. Do not include any meta-commentary, explanations, or offers to create additional versions. Output the content directly without preamble or postamble.',
    // If true, append customSystemPrompt to default instead of replacing
    appendSystemPrompt: false,
    // Custom system prompt (replaces or appends to default based on appendSystemPrompt)
    customSystemPrompt: null
  },
  beforeSuperClass(self) {
    self.options.editorInsertMenu = {
      ...self.options.editorInsertMenu,
      ai: {
        icon: 'robot-icon',
        label: 'aposAiHelper:generateTextLabel',
        component: 'AposAiHelperTextDialog',
        description: 'aposAiHelper:generateTextDescription'
      }
    };
  },
  init(self) {
    const defaultOptions = self.options.defaultOptions;
    defaultOptions.insert ||= [];
    if (!defaultOptions.insert.includes('ai')) {
      defaultOptions.insert.push('ai');
    }
  },
  apiRoutes(self) {
    return {
      post: {
        async aiHelper(req) {
          console.log('req.body', req.body);
          try {
            const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
            aiHelper.checkPermissions(req);

            const prompt = self.apos.launder.string(req.body.prompt);
            const headingLevels = self.apos.launder.strings(req.body.headingLevels)
              .map(level => parseInt(level));

            if (!prompt.length) {
              throw self.apos.error('invalid');
            }

            // Generate content and metadata (mock or real)
            let content, metadata, providerName;

            if (process.env.APOS_AI_HELPER_MOCK) {
              content = mockContent;
              const promptTokens = Math.ceil(prompt.length / 4);
              const completionTokens = Math.ceil(content.length / 4);
              metadata = {
                model: 'mock-model',
                usage: {
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                  total_tokens: promptTokens + completionTokens
                }
              };
              providerName = 'Mock Provider';
            } else {
              const provider = aiHelper.getTextProvider();

              // Build system prompt in rich text widget
              let systemPrompt = self.options.systemPrompt;
              const customPrompt =
              req.body.customSystemPrompt || self.options.customSystemPrompt;
              const shouldAppend = req.body.appendSystemPrompt !== undefined
                ? req.body.appendSystemPrompt
                : self.options.appendSystemPrompt;

              if (customPrompt) {
                if (shouldAppend) {
                  systemPrompt = `${systemPrompt} ${customPrompt}`;
                } else {
                  systemPrompt = customPrompt;
                }
              }

              const result = await provider.generateText(req, prompt, {
                maxTokens: aiHelper.options.textMaxTokens,
                systemPrompt
              });

              content = result.content;
            }

            if (!content) {
              throw self.apos.error('error');
            }

            // Remap headings to levels actually available in this widget
            const markdown = content.replace(/(^|\n)(#+) /g, (all, before, hashes) => {
              if (!headingLevels.length) {
                return '';
              }
              const level = headingLevels[hashes.length - 1];
              return before + (level ? ('#'.repeat(level) + ' ') : '');
            });

            const html = marked.parse(markdown);

            return {
              html,
              metadata,
              provider: providerName
            };

          } catch (e) {
            let notificationMessage;
            let notificationType = 'danger';

            if (e.refusal) {
              notificationMessage = 'aposAiHelper:contentPolicyViolation';
            } else if (e.status === 429) {
              notificationMessage = 'aposAiHelper:rateLimitExceeded';
              notificationType = 'warning';
            } else if (e.status === 400 || e.status === 401 || e.status === 403) {
              notificationMessage = 'aposAiHelper:invalidRequest';
            } else {
              notificationMessage = 'aposAiHelper:generationFailed';
              notificationType = 'warning';
            }

            self.apos.notify(req, notificationMessage, { type: notificationType });
            throw e;
          }
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const initialData = _super(req);
        const finalData = {
          ...initialData
        };
        if (self.options.customSystemPrompt) {
          finalData.customSystemPrompt = self.options.customSystemPrompt;
        }
        if (self.options.appendSystemPrompt !== undefined) {
          finalData.appendSystemPrompt = self.options.appendSystemPrompt;
        }
        finalData.systemPrompt = self.options.systemPrompt;
        return finalData;
      }
    };
  }
};
