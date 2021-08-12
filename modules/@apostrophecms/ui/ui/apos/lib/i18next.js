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

    Vue.prototype.$t = (phrase, options) => {
      return (i18n.show ? '🌍 ' : '') + i18next.t(phrase, {
        lng: i18n.locale,
        ...options
      });
    };
  }
};
