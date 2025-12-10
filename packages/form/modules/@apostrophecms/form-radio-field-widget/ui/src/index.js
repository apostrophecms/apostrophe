const WIDGET_NAME = '@apostrophecms/form-radio-field';
const WIDGET_SELECTOR = '[data-apos-form-radio]';

export default () => {
  apos.util.widgetPlayers[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    player (el) {
      const formWidget = apos.util.closest(el, '[data-apos-form-form]');
      const inputs = el.querySelectorAll('input[type="radio"]');

      if (!formWidget || inputs.length === 0) {
        // Editing the form in the piece modal, it is not active for submissions
        return;
      }

      const inputName = inputs[0].getAttribute('name');

      const conditionalGroups = formWidget.querySelectorAll('[data-apos-form-condition="' + inputName + '"]');

      if (conditionalGroups.length > 0) {
        const input = el.querySelector('input[type="radio"]:checked');

        const check = apos.aposForm.checkConditional;
        check(conditionalGroups, input);

        Array.prototype.forEach.call(inputs, function (radio) {
          radio.addEventListener('change', function (e) {
            check(conditionalGroups, e.target);
          });
        });
      }
    }
  };

  apos.aposForm.collectors[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    collector (el) {
      const inputs = el.querySelectorAll('input[type="radio"]');
      const checked = el.querySelector('input[type="radio"]:checked');

      return {
        field: inputs[0].getAttribute('name'),
        value: checked ? checked.value : undefined
      };
    }
  };
};
