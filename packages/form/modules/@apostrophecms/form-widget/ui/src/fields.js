// Async field validation, in case this needs to hit an API route.
async function collectValues (form) {
  if (!apos.aposForm.collectors || apos.aposForm.collectors.length === 0) {
    return;
  }

  const formErrors = [];
  const input = {};

  for (const type in apos.aposForm.collectors) {
    const selector = apos.aposForm.collectors[type].selector;
    const collector = apos.aposForm.collectors[type].collector;
    const fields = form.querySelectorAll(selector);

    for (const field of fields) {
      try {
        const response = await collector(field);
        if (typeof response !== 'object' || !response.field) {
          // Log this. Not useful information for an end user.
          // eslint-disable-next-line
          console.error(`${type} field widget type is returning an invalid collector response.`);
        }

        // If there are files to upload, return an object with the files.
        input[response.field] = response.files
          ? {
            value: response.value,
            files: response.files
          }
          : response.value;
      } catch (error) {
        // Add error to formErrors
        const fieldError = error.field ? error : error?.data?.fieldError;

        if (fieldError?.field) {
          const e = fieldError;

          formErrors.push({
            field: e.field,
            message: e.message || 'Error'
          });
        } else {
          formErrors.push({
            global: true,
            message: 'Unknown form field error'
          });
        }
      }
    }
  }

  if (formErrors.length > 0) {
    const error = new Error('invalid');
    error.data = {
      formErrors
    };

    throw error;
  }

  return input;
}

export {
  collectValues
};
