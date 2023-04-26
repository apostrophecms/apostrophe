export default {
  install(Vue, options) {
    Vue.directive('click-outside-element', {
      bind(el, binding) {
        el.aposClickOutsideHandler = (event) => {
          if ((el !== event.target) && !el.contains(event.target) && !apos.modal.onTopOf(event.target, el)) {
            binding.value(event);
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
