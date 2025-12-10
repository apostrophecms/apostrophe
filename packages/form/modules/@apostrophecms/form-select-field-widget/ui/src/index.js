const WIDGET_NAME = '@apostrophecms/form-select-field';
const WIDGET_SELECTOR = '[data-apos-form-select]';

export default () => {
  apos.util.widgetPlayers[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    player (el) {
      const formWidget = apos.util.closest(el, '[data-apos-form-form]');
      if (!formWidget) {
        // Editing the form in the piece modal, it is not active for submissions
        return;
      }

      const input = el.querySelector('select');
      const inputName = input.getAttribute('name');

      const conditionalGroups = formWidget.querySelectorAll('[data-apos-form-condition="' + inputName + '"]');

      if (conditionalGroups.length > 0) {
        const check = apos.aposForm.checkConditional;
        check(conditionalGroups, input);

        input.addEventListener('change', function () {
          check(conditionalGroups, input);
        });
      }
    }
  };

  apos.aposForm.collectors[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    collector (el) {
      const input = el.querySelector('select');

      return {
        field: input.getAttribute('name'),
        value: input.value
      };
    }
  };
};
