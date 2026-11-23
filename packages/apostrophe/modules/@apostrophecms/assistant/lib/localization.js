// The assistant's own instructions for localizing, on a site with several
// locales: where it asks before it writes, and the site's translation
// service when its toolset has one. What the copies are and which tools make
// and compare them is in the harness's base instructions, for both doors.

const DOOR = 'assistant';

module.exports = (self) => {
  return {
    getLocalizationSection() {
      if (self.apos.harness.getLocaleNames().length < 2) {
        return null;
      }
      // Tagged "ai-localize-translate" by its module, which also tags it
      // "assistant" for this door to have it
      const translator = self.apos.harness.getDoorTools(DOOR)
        .find(tool => tool.tags?.includes('ai-localize-translate'));
      return [
        'Localizing for the user:',
        '- Before replacing a change the target copy made itself, say what it is and ask.',
        '- Asked to localize part of a page into a locale where the page has no copy: ask ' +
          'whether to create the page there, which localizes all of it, or to skip that ' +
          'locale, and go on with the other locales.',
        '- Before translating again what the source has not changed since the copies ' +
          'were last in line, ask. When nothing says when they were last in line, read ' +
          'both texts: translate what the target lacks or says differently, leave what ' +
          'is already a translation, and say which was which.',
        ...translator
          ? [
            `- ${translator.name} is the site's translation service and has the last word ` +
              'on wording: send it the source texts, all in one call when you can, rich ' +
              'text as HTML with "html": true, and write what it returns.'
          ]
          : []
      ].join('\n');
    }
  };
};
