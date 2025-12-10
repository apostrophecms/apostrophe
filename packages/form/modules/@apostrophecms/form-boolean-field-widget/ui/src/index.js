const WIDGET_NAME = '@apostrophecms/form-boolean-field';
const WIDGET_SELECTOR = '[data-apos-form-boolean]';

export default () => {
  apos.util.widgetPlayers[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    player (el) {
      const formWidget = apos.util.closest(el, '[data-apos-form-form]');
      if (!formWidget) {
        // Editing the form in the piece modal, it is not active for submissions
        return;
      }

      const input = el.querySelector('input[type="checkbox"]');
      const inputName = input.getAttribute('name');

      const conditionalGroups = formWidget.querySelectorAll('[data-apos-form-condition="' + inputName + '"]');

      if (conditionalGroups.length > 0) {
        const check = apos.aposForm.checkConditional;

        if (input.checked) {
          check(conditionalGroups, input);
        }

        input.addEventListener('change', function (e) {
          check(conditionalGroups, e.target);
        });
      }
    }
  };

  apos.aposForm.collectors[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    collector (el) {
      const input = el.querySelector('input[type="checkbox"]');

      return {
        field: input.getAttribute('name'),
        value: input.checked
      };
    }
  };
};
