const marked = require('marked');

// Canned sample results for cheap & offline testing
const mockResults = {
  id: 'cmpl-76iWL6JGwp0S3MoFx77100hd4cZjr',
  object: 'text_completion',
  created: 1681835461,
  model: 'gpt-3.5-turbo-instruct',
  choices: [
    {
      text: '\n# Glamping Cats\n\n## The Feline Appeal\nGlamping cats have become increasingly popular in recent years, with many people choosing to include their cats in their glamping experience. Cats are incredibly adaptive and can quickly become accustomed to new environments with minimal stress. They can also make perfect glamping companions, as their intelligence and inquisitive nature ensure that they will quickly find ways to entertain themselves and those around them.\n\n## Glamping Must-Haves\nBefore taking your cat on a glamping vacation, make sure you are prepared. Consider bringing items such as litterbox, food dish, bedding material, and toys. Each of these items can help create an enjoyable and stress-free environment for your cat while glamping.\n\n## RV Luxuries\nRVs come equipped with a variety of amenities that make glamping with cats more enjoyable. Consider portable kennels and carriers for your cat, as well as waterproof mats and blankets for lounging. RV heating capabilities can also create a comfortable and safe environment for your cat, no matter the temperature outside. \n\n## All-Weather Fun\nGlamping with cats can provide opportunities for outdoor fun regardless of the weather. Rainy days can be spent cuddling cats inside, while sunny days can offer the adventure of roaming the outdoors. Glamping can also offer cats the opportunity to meet new people and explore new environments.\n\n## A Special Bond\nUltimately, glamping with cats can create a special bond between you and your pet. Cats tend to be incredibly social creatures and thrive off of human interaction. Glamping with cats offers the perfect opportunity to strengthen your relationship and appreciate the wonders of nature.',
      index: 0,
      logprobs: null,
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 32,
    completion_tokens: 342,
    total_tokens: 374
  }
};

module.exports = {
  improve: '@apostrophecms/rich-text-widget',
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
          try {
            const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
            aiHelper.checkPermissions(req);
            const prompt = self.apos.launder.string(req.body.prompt);
            const headingLevels = self.apos.launder
              .strings(req.body.headingLevels)
              .map(level => parseInt(level));
            if (!prompt.length) {
              throw self.apos.error('invalid');
            }
            const body = {
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful text-generation assistant for CMS content. You generate text in Markdown format based on the given prompt. If the response is more than two paragraphs, use markdown subheadings.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              model: aiHelper.options.textModel,
              max_completion_tokens: aiHelper.options.textMaxTokens
            };
            async function post(...args) {
              const response = await self.apos.http.post(...args);
              return response;
            };
            const result = process.env.APOS_AI_HELPER_MOCK
              ? mockResults
              : await post('https://api.openai.com/v1/chat/completions', {
                headers: {
                  Authorization: `Bearer ${process.env.APOS_OPENAI_KEY}`
                },
                body
              })
            ;
            const content = result?.choices?.[0]?.message?.content;
            if (!content) {
              throw self.apos.error('error');
            }
            // Remap headings to levels actually available in this widget
            const markdown = content.replace(/(^|\n)(#+) /g, (all, before, hashes) => {
              if (!headingLevels.length) {
                return '';
              }
              const level = headingLevels[hashes.length - 1];
              return before + (level ? (before + '#'.repeat(level) + ' ') : '');
            });

            const html = marked.parse(markdown);
            return {
              html
            };
          } catch (e) {
            self.apos.util.warn(e);
            if (e.status === 429) {
              self.apos.notify(req, 'aposAiHelper:rateLimitExceeded');
            } else if (e.status === 400) {
              self.apos.notify(req, 'aposAiHelper:invalidRequest');
            }
            throw e;
          }
        }
      }
    };
  }
};
