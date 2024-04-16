// Localization. Provide the same basic API as vue-i18next, but without
// the requirement of lazy loading for namespaces, or the
// requirement to expressly pass an i18next instance to
// each app

import i18next from 'i18next';
let i18n;

export default {

  install(app, options) {
    if (!i18n) {
      i18n = options.i18n;
    }

    const fallbackLng = [ i18n.defaultLocale ];
    // In case the default locale also has inadequate admin UI phrases
    if (fallbackLng[0] !== 'en') {
      fallbackLng.push('en');
    }

    i18next.init({
      lng: canonicalize(i18n.adminLocale),
      fallbackLng,
      resources: {},
      debug: i18n.debug,
      interpolation: {
        escapeValue: false
      },
      skipOnVariables: false,
      appendNamespaceToMissingKey: true,
      defaultNS: [ apos.i18n.defaultNamespace ],
      parseMissingKeyHandler (key) {
        // We include namespaces with unrecognized l10n keys using
        // `appendNamespaceToMissingKey: true`. This passes strings containing
        // colons that were never meant to be localized through to the UI.
        //
        // Strings that do not include colons ("Content area") are given the
        // default namespace by i18next ("default," in Apostrophe). Here we
        // check if the key starts with that default namespace, meaning it
        // belongs to no other registered namespace, then remove that default
        // namespace before passing this through to be processed and displayed.
        if (key.startsWith(`${this.defaultNS[0]}:`)) {
          return key.slice(this.defaultNS[0].length + 1);
        } else {
          return key;
        }
      }
    });

    for (const [ ns, phrases ] of Object.entries(i18n.i18n[i18n.adminLocale])) {
      i18next.addResourceBundle(canonicalize(i18n.adminLocale), ns, phrases, true, true);
    }
    if (i18n.adminLocale !== i18n.defaultLocale) {
      for (const [ ns, phrases ] of Object.entries(i18n.i18n[i18n.defaultLocale])) {
        i18next.addResourceBundle(canonicalize(i18n.defaultLocale), ns, phrases, true, true);
      }
    }
    if ((i18n.adminLocale !== 'en') && (i18n.defaultLocale !== 'en')) {
      for (const [ ns, phrases ] of Object.entries(i18n.i18n.en)) {
        i18next.addResourceBundle('en', ns, phrases, true, true);
      }
    }

    // Makes available the $t function in all components through `this`.
    app.config.globalProperties.$t = $t;

    // This is for the composition API, allowing to inject $t in any component.
    app.provide('i18n', $t);
  }
};

export function $t(key, options = {}) {
  if (!i18n) {
    return '';
  }
  if ((key !== null) && ((typeof key) === 'object')) {
    options = key;
    key = options.key;
  }
  if (options.localize === false) {
    return key;
  }
  // Check carefully for empty string and equivalent scenarios
  // before doing any work
  if (key == null) {
    return '';
  }
  key += '';
  if (!key.length) {
    return '';
  }
  const result = i18next.t(key, {
    lng: i18n.adminLocale,
    ...options
  });
  if (i18n.show) {
    if (result === key) {
      if (key.match(/^\S+:/)) {
        // The l10n key does not have a value assigned (or the key is
        // actually the same as the phrase). The key seems to have a
        // namespace, so might be from the Apostrophe UI.
        return `❌ ${result}`;
      } else {
        // The l10n key does not have a value assigned (or the key is
        // actually the same as the phrase). It is in the default namespace.
        return `🕳 ${result}`;
      }
    } else {
      // The phrase is fully localized.
      return `🌍 ${result}`;
    }
  } else {
    return result;
  }
};

function canonicalize(locale) {
  const [ language, territory ] = locale.split('-');
  if (territory) {
    return `${language}-${territory.toUpperCase()}`;
  }
  return locale;
}
