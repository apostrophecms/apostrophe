// Vue plugin. Create a new directive with i18n support by applying the decorator
// pattern to VTooltip, then add it to the Vue instance

import { VTooltip } from 'v-tooltip';

export default {
  install(Vue, options) {

    const LocalizedVTooltip = {
      options
    };
    let instance;

    // Right now VTooltip only uses bind, but be forwards-compatible
    extendHandler('bind');
    extendHandler('inserted');
    extendHandler('update');
    extendHandler('componentUpdated');
    extendHandler('unbind');

    Vue.directive('tooltip', LocalizedVTooltip);

    function extendHandler(name) {
      if (VTooltip[name]) {
        LocalizedVTooltip[name] = (el, binding, vnode, oldVnode) => {
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
      console.log('localizing:', value);
      if (!instance) {
        // A headless Vue instance to call $t on. We do this late so we
        // know $t is ready
        instance = new Vue();
      }
      // Something stringable
      console.log(instance.$t);
      if (!value) {
        // VTooltip will be confused if $t converts a falsy value to the string "false"
        return value;
      }
      if (value.content) {
        // Object with a content property
        if (value && value.content) {
          return {
            ...value,
            content: log(instance.$t(value.content))
          };
        } else {
          return value;
        }
      } else {
        return log(instance.$t(value));
      }
    }
  }
};

function log(s) {
  console.log('> ' + s);
  return s;
}
