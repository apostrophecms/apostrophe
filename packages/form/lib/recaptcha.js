module.exports = function(self) {
  return {
    async getRecaptchaSecret (req, self) {
      const globalDoc = await self.apos.global.find(req, {}).toObject();

      return self.options.recaptchaSecret
        ? self.options.recaptchaSecret
        : globalDoc.useRecaptcha
          ? globalDoc.recaptchaSecret
          : null;
    },
    cleanOptions (options) {
      if (!options.recaptchaSecret || !options.recaptchaSite) {
        // No fooling around. If they are not *both* included, both are invalid.
        // Deleting here to avoid having to repeatedly check for both's existence.
        delete options.recaptchaSite;
        delete options.recaptchaSecret;
      }
    },
    async checkRecaptcha (req, input, formErrors) {
      const recaptchaSecret = await self.getRecaptchaSecret(req, self);

      if (!recaptchaSecret) {
        return;
      }

      if (!input.recaptcha || ((typeof input.recaptcha) !== 'string')) {
        formErrors.push({
          global: true,
          error: 'recaptcha',
          message: req.t('aposForm:recaptchaSubmitError')
        });

        return;
      }

      try {
        const url = 'https://www.google.com/recaptcha/api/siteverify';
        // Encode the parameters so a crafted token cannot inject others
        const response = await self.apos.http.post(url, {
          body: new URLSearchParams({
            secret: recaptchaSecret,
            response: input.recaptcha
          }).toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.success) {
          formErrors.push({
            global: true,
            error: 'recaptcha',
            message: req.t('aposForm:recaptchaValidationError')
          });
        }
      } catch (e) {
        self.apos.util.error(e);

        formErrors.push({
          global: true,
          error: 'recaptcha',
          message: req.t('aposForm:recaptchaConfigError')
        });
      }
    }
  };
};
