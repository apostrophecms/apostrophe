// Localization. Provide the same basic API as vue-i18next, but without
// the requirement of lazy loading for namespaces, or the
// requirement to expressly pass an i18next instance to
// each app

import i18next from 'i18next';

export default {

  install(Vue, options) {
    const i18n = options.i18n;

    i18next.init({
      lng: i18n.locale,
      fallbackLng: i18n.defaultLocale,
      resources: {},
      debug: i18n.debug
    });

    for (const [ ns, phrases ] of Object.entries(i18n.i18n[i18n.locale])) {
      i18next.addResourceBundle(i18n.locale, ns, phrases, true, true);
    }
    if (i18n.locale !== i18n.defaultLocale) {
      for (const [ ns, phrases ] of Object.entries(i18n.i18n[i18n.defaultLocale])) {
        i18next.addResourceBundle(i18n.defaultLocale, ns, phrases, true, true);
      }
    }

    // Like standard i18next $t, but also with support
    // for just one object argument with at least a `key`
    // property, which makes it easier to pass both
    // a label and its interpolation values through
    // multiple layers of code, as a single `label`
    // property for instance. You may also specify
    // `localize: false` to pass a string through without
    // invoking i18next.
    Vue.prototype.$t = (key, options = {}) => {
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
        lng: i18n.locale,
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
  }
};
