import Vue from 'Modules/@apostrophecms/ui/lib/vue';
import i18next from 'i18next';

export default () => {
  // Provide the same basic API as vue-i18next, but without
  // the requirement of lazy loading for namespaces, or the
  // requirement to expressly pass an i18next instance to
  // each app
  const plugin = {
    install(Vue) {
      Vue.prototype.$t = (phrase, options) => {
        return i18next.t(phrase, options);
      };
    }
  };
  i18next.init({
    lng: apos.i18n.locale,
    fallbackLng: apos.i18n.locale,
    resources: apos.i18n.l10n
  });
  Vue.use(plugin);
};
