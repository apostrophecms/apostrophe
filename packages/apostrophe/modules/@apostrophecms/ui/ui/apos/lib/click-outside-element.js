export default {
  install(app, options) {
    app.directive('click-outside-element', {
      beforeMount(el, binding) {
        el.aposClickOutsideHandler = (event) => {
          if (
            (el !== event.target) &&
            !el.contains(event.target) &&
            !apos.modal.onTopOf(event.target, el)
          ) {
            binding.value(event);
          }
        };
        document.body.addEventListener('click', el.aposClickOutsideHandler);
      },
      beforeUnmount(el, binding) {
        document.body.removeEventListener('click', el.aposClickOutsideHandler);
      }
    });
  }
};
