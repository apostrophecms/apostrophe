const marked = require('marked');

// Canned sample results for cheap & offline testing
const mockContent = '\n# Glamping Cats\n\n## The Feline Appeal\nGlamping cats have become increasingly popular in recent years, with many people choosing to include their cats in their glamping experience. Cats are incredibly adaptive and can quickly become accustomed to new environments with minimal stress. They can also make perfect glamping companions, as their intelligence and inquisitive nature ensure that they will quickly find ways to entertain themselves and those around them.\n\n## Glamping Must-Haves\nBefore taking your cat on a glamping vacation, make sure you are prepared. Consider bringing items such as litterbox, food dish, bedding material, and toys. Each of these items can help create an enjoyable and stress-free environment for your cat while glamping.\n\n## RV Luxuries\nRVs come equipped with a variety of amenities that make glamping with cats more enjoyable. Consider portable kennels and carriers for your cat, as well as waterproof mats and blankets for lounging. RV heating capabilities can also create a comfortable and safe environment for your cat, no matter the temperature outside. \n\n## All-Weather Fun\nGlamping with cats can provide opportunities for outdoor fun regardless of the weather. Rainy days can be spent cuddling cats inside, while sunny days can offer the adventure of roaming the outdoors. Glamping can also offer cats the opportunity to meet new people and explore new environments.\n\n## A Special Bond\nUltimately, glamping with cats can create a special bond between you and your pet. Cats tend to be incredibly social creatures and thrive off of human interaction. Glamping with cats offers the perfect opportunity to strengthen your relationship and appreciate the wonders of nature.';

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

  apiRoutes(self) {
    return {
      post: {
        async aiHelper(req) {
          try {
            const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
            aiHelper.checkPermissions(req);

            const prompt = self.apos.launder.string(req.body.prompt);
            const headingLevels = self.apos.launder.strings(req.body.headingLevels)
              .map(level => parseInt(level));

            if (!prompt.length) {
              throw self.apos.error('invalid');
            }

            // Use mock results if in test mode
            let content;
            if (process.env.APOS_AI_HELPER_MOCK) {
              content = mockContent;
            } else {
              // Get the configured text provider
              const provider = aiHelper.getTextProvider();

              // Generate text using the provider
              content = await provider.module.generateText(req, prompt, {
                maxTokens: aiHelper.options.textMaxTokens
              });
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

            return { html };

          } catch (e) {
            console.error('AI Helper Error:', e);

            // Use the userMessage if available, otherwise fall back to defaults
            let notificationMessage;
            let notificationType = 'danger';

            if (e.userMessage) {
              // Provider set a user-friendly message
              notificationMessage = e.userMessage;
              notificationType = e.status === 429 ? 'warning' : 'danger';
            } else if (e.status === 429) {
              notificationMessage = 'aposAiHelper:rateLimitExceeded';
            } else if (e.status === 400) {
              notificationMessage = 'aposAiHelper:invalidRequest';
            } else {
              notificationMessage = 'AI generation failed. Please try again.';
              notificationType = 'warning';
            }

            self.apos.notify(req, notificationMessage, { type: notificationType });
            throw e;
          }
        }
      }
    };
  }
};
