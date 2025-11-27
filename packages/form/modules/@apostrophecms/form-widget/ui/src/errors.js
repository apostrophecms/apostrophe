function processErrors (errors, el) {
  const form = el.querySelector('[data-apos-form-form]');
  const errorMsg = el.querySelector('[data-apos-form-submit-error]');

  apos.util.emit(document.body, '@apostrophecms/form:submission-failed', {
    form,
    errors
  });
  apos.util.addClass(errorMsg, 'apos-form-visible');

  highlight(el, errors);
}

function highlight(el, errors) {
  if (!Array.isArray(errors)) {
    return;
  }

  const form = el.querySelector('[data-apos-form-form]');
  const globalError = el.querySelector('[data-apos-form-global-error]');

  globalError.innerText = '';

  errors.forEach(function (error) {
    if (!validateError(error)) {
      return;
    }

    if (error.global) {
      globalError.innerText = globalError.innerText + ' ' +
        error.message;

      return;
    }
    let fields = form.querySelectorAll(`[name=${error.field}]`);
    fields = Array.prototype.slice.call(fields);

    const labelMessage = form.querySelector(`[data-apos-input-message=${error.field}]`);

    fields.forEach(function (field) {
      apos.util.addClass(field, 'apos-form-input-error');
    });

    apos.util.addClass(labelMessage, 'apos-form-error');
    labelMessage.innerText = error.message;
    labelMessage.hidden = false;
  });
}

function validateError (error) {
  if ((!error.global && !error.field) || !error.message) {
    return false;
  }

  return true;
}

export {
  processErrors
};
