// Vue plugin. Create a new directive with i18n support by applying the decorator
// pattern to VTooltip, then add it to the Vue instance

import { VTooltip } from 'v-tooltip';

export default {
  install(Vue, options) {

    const directive = {};

    Object.assign(VTooltip.options, options);
    let instance;

    // Right now VTooltip only uses bind, but be forwards-compatible
    extendHandler('bind');
    extendHandler('inserted');
    extendHandler('update');
    extendHandler('componentUpdated');
    extendHandler('unbind');

    Vue.directive('apos-tooltip', directive);

    function extendHandler(name) {
      if (VTooltip[name]) {
        directive[name] = (el, binding, vnode, oldVnode) => {
          return VTooltip[name](el, {
            ...binding,
            value: localize(binding.value)
          }, vnode, oldVnode);
        };
      }
    }

    function localize(value) {
      if (!value) {
        return;
      }
      if (!instance) {
        // A headless Vue instance to call $t on. We do this late so we
        // know $t is ready
        instance = new Vue();
      }
      // Something stringable
      if (!value) {
        // VTooltip will be confused if $t converts a falsy value to the string "false"
        return value;
      }
      if (value.content) {
        // Object with a content property
        if (value && value.content) {
          return {
            ...value,
            content: (value.localize === false) ? value.content : instance.$t(value.content)
          };
        } else {
          return value;
        }
      } else {
        return instance.$t(value);
      }
    }
  }
};
