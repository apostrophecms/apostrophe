export default {
  install(app, options) {
    const setClickOutsideHandler = (el, binding) => (event) => {
      if ((el !== event.target) && !el.contains(event.target) && !apos.modal.onTopOf(event.target, el)) {
        binding.value(event);
      }
    };

    app.directive('click-outside-element', {
      beforeMount(el, binding) {
        document.body.addEventListener('click', setClickOutsideHandler(el, binding));
      },
      unbind(el, binding) {
        document.body.removeEventListener('click', setClickOutsideHandler(el, binding));
      }
    });
  }
};
