import { processErrors } from './errors';
import { collectValues } from './fields';
import enableRecaptcha from './recaptcha';

export default () => {
  apos.util.widgetPlayers['@apostrophecms/form'] = {
    selector: '[data-apos-form-wrapper]',
    player: function (el) {
      const form = el.querySelector('[data-apos-form-form]');

      if (!form) {
        return;
      }

      form.addEventListener('submit', submit);

      const recaptcha = enableRecaptcha(el);

      // If there are specified query parameters to capture, see if fields
      // can be populated.
      if (form.hasAttribute('data-apos-form-params')) {
        setParameterValues();
      }

      async function submit(event) {
        event.preventDefault();

        if (apos?.adminBar?.editMode) {
          await apos.notify('aposForm:disabledInEditMode', {
            type: 'info'
          });
          return;
        }

        if (el.querySelector('[data-apos-form-busy]')) {
          return setTimeout(async function() {
            await submit(event);
          }, 100);
        }

        form.setAttribute('data-apos-form-busy', '1');

        let input;
        const formData = new window.FormData();

        try {
          // Collect field values on the event
          input = await collectValues(form);

          // Upload each set of field files separately
          for (const field in input) {
            // Upload file field files if input has files.
            if (typeof input[field] === 'object' && input[field].files) {
              await appendFiles(field, input[field], formData);

              input[field] = 'files-pending';
            }
          }

        } catch (error) {
          processErrors(error?.data?.formErrors, el);

          form.removeAttribute('data-apos-form-busy');

          return;
        }

        input._id = form.getAttribute('data-apos-form-form');

        if (recaptcha) {
          const recaptchaError = el.querySelector('[data-apos-form-recaptcha-error]');

          try {
            input.recaptcha = await recaptcha.getToken(el);
          } catch (error) {
            // eslint-disable-next-line
            console.error('reCAPTCHA execution error:', error);
            apos.util.addClass(recaptchaError, 'apos-form-visible');
            return null;
          }
        }

        // For resubmissions
        const errorMsg = el.querySelector('[data-apos-form-submit-error]');
        const spinner = el.querySelector('[data-apos-form-spinner]');
        const thankYou = el.querySelector('[data-apos-form-thank-you]');
        apos.util.removeClass(errorMsg, 'apos-form-visible');
        apos.util.addClass(spinner, 'apos-form-visible');

        // Convert to arrays old school for IE.
        const existingErrorInputs = Array.prototype.slice.call(el.querySelectorAll('.apos-form-input-error'));
        const existingErrorMessages = Array.prototype.slice.call(el.querySelectorAll('[data-apos-input-message].apos-form-error'));

        existingErrorInputs.forEach(function (input) {
          apos.util.removeClass(input, 'apos-form-input-error');
        });

        existingErrorMessages.forEach(function (message) {
          apos.util.removeClass(message, 'apos-form-error');
          message.hidden = true;
        });

        // Capture query parameters.
        if (form.hasAttribute('data-apos-form-params')) {
          captureParameters(input);
        }

        let formErrors = null;

        formData.append('data', JSON.stringify(input));

        try {
          await apos.http.post('/api/v1/@apostrophecms/form/submit', {
            body: formData
          });
        } catch (error) {
          formErrors = error.body?.data?.formErrors;
        }

        form.removeAttribute('data-apos-form-busy');
        apos.util.removeClass(spinner, 'apos-form-visible');

        if (formErrors) {
          processErrors(formErrors, el);

        } else {
          apos.util.emit(document.body, '@apostrophecms/form:submission-form', {
            form,
            formError: null
          });
          apos.util.addClass(thankYou, 'apos-form-visible');
          apos.util.addClass(form, 'apos-form-hidden');
        }
      }

      function setParameterValues () {
        const paramList = form.getAttribute('data-apos-form-params').split(',');
        const params = apos.http.parseQuery(window.location.search);

        paramList.forEach(function (param) {
          const paramInput = form.querySelector('[name="' + param + '"]');

          if (!params[param]) {
            return;
          }

          // If the input is a checkbox, check all in the comma-separated query
          // parameter value.
          if (paramInput && paramInput.type === 'checkbox') {
            params[param].split(',').forEach(function (value) {
              const checkbox = form.querySelector('[name="' + param + '"][value="' + value + '"]');

              if (checkbox) {
                checkbox.checked = true;
              }
            });
            // If the input is a radio, check the matching input.
          } else if (paramInput && paramInput.type === 'radio') {
            form.querySelector('[name="' + param + '"][value="' + params[param] + '"]').checked = true;
            // If the input is a select field, make sure the value is an option.
          } else if (paramInput && paramInput.type === 'select') {
            if (paramInput.querySelector('option[value="' + params[param] + '"')) {
              paramInput.value = params[param];
            }
            // Otherwise set the input value to the parameter value.
          } else if (paramInput) {
            paramInput.value = params[param];
          }
        });
      }

      function captureParameters (input) {
        input.queryParams = apos.http.parseQuery(window.location.search);
      }

      async function appendFiles(field, fieldInput, data) {
        let i = 0;
        for (const file of fieldInput.files) {
          data.append(`${field}-${i}`, file);
          i++;
        }
      }
    }
  };
};
