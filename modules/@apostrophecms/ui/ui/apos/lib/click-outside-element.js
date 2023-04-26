export default {
  install(Vue, options) {
    Vue.directive('click-outside-element', {
      bind(el, binding) {
        el.aposClickOutsideHandler = (event) => {
          if ((el !== event.target) && !el.contains(event.target)) {
            console.log('FIRING');
            binding.value(event);
          } else {
            console.log('NOT FIRING');
          }
        };
        document.body.addEventListener('click', el.aposClickOutsideHandler);
      },
      unbind(el) {
        document.body.removeEventListener('click', el.aposClickOutsideHandler);
      }
    });
  }
};
