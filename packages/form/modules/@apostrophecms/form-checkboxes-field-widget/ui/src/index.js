const WIDGET_NAME = '@apostrophecms/form-checkboxes-field';
const WIDGET_SELECTOR = '[data-apos-form-checkboxes]';

export default () => {
  apos.util.widgetPlayers[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    player (el) {
      const formWidget = apos.util.closest(el, '[data-apos-form-form]');

      if (!formWidget) {
        // Editing the form in the piece modal, it is not active for submissions
        return;
      }

      const inputs = el.querySelectorAll('input[type="checkbox"]');
      const inputName = inputs[0].getAttribute('name');
      const conditionalGroups = formWidget.querySelectorAll('[data-apos-form-condition="' + inputName + '"]');
      // TODO: Remove this logic or update the collectToSkip function to support
      // arrays.
      if (conditionalGroups.length > 0) {
        const check = apos.aposForm.checkConditional;

        Array.prototype.forEach.call(inputs, function (checkbox) {
          checkbox.addEventListener('change', function (e) {
            check(conditionalGroups, e.target);
          });
        });
      }

      const toggle = el.querySelector('[data-apos-form-toggle]');
      if (toggle) {
        toggle.onclick = function(e) {
          e.stopPropagation();
          e.preventDefault();

          const active = 'is-active';
          if (el.classList.contains(active)) {
            el.classList.remove(active);
          } else {
            el.classList.add(active);
          }
        };
      }
    }
  };

  apos.aposForm.collectors[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    collector (el) {
      const inputs = el.querySelectorAll('input[type="checkbox"]:checked');
      const inputsArray = Array.prototype.slice.call(inputs);

      if (inputsArray.length === 0) {
        const unchecked = el.querySelector('input[type="checkbox"]');
        return {
          field: unchecked.getAttribute('name'),
          value: undefined
        };
      }

      return {
        field: inputs[0].getAttribute('name'),
        value: inputsArray.map(input => input.value)
      };
    }
  };
};
