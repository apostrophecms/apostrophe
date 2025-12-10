import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ClickOutsideElement from './click-outside-element';
import Tooltip from './tooltip';
import VueAposI18Next from './i18next';

const pinia = createPinia();

export default (appConfig, props = {}) => {
  const app = createApp(appConfig, props);

  app.use(VueAposI18Next, {
    // Module aliases are not available yet when this code executes
    i18n: apos.modules['@apostrophecms/i18n']
  });
  app.use(Tooltip);
  app.use(ClickOutsideElement);
  app.use(pinia);

  const sources = [ window.apos.vueComponents, window.apos.iconComponents ];
  for (const source of sources) {
    for (const [ name, component ] of Object.entries(source)) {
      app.component(name, component);
    }
  }
  return app;
};
