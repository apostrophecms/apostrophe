module.exports = {
  improve: '@apostrophecms/login',
  requirements(self) {

    if (!self.options.recaptcha.site || !self.options.recaptcha.secret) {
      // Not playing around. No point in instantiating this module if you don't
      // configure it.

      // Unfortunately we're too early here to localize the error message.
      throw new Error('The login reCAPTCHA site key, secret key, or both are not configured');
    }

    return {
      add: {
        AposRecaptcha: {
          phase: 'uponSubmit',
          async props(req) {
            return {
              sitekey: self.options.recaptcha.site
            };
          },
          async verify(req, data) {
            if (!data) {
              throw self.apos.error('invalid', req.t('AposRecap:missingConfig'));
            }

            await self.checkRecaptcha(req, data);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      async checkRecaptcha (req, token) {
        const secret = self.options.recaptcha.secret;

        if (!secret) {
          return;
        }

        try {
          if ((typeof token) !== 'string') {
            throw self.apos.error('invalid', req.t('AposRecap:invalidToken'));
          }
          const url = 'https://www.google.com/recaptcha/api/siteverify';
          // Encode the parameters so a crafted token cannot inject others
          const response = await self.apos.http.post(url, {
            body: new URLSearchParams({
              secret,
              response: token
            }).toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });

          if (!response.success) {
            self.logInfo(req, 'recaptcha-invalid-token', {
              data: response
            });
            throw self.apos.error('invalid', req.t('AposRecap:invalidToken'));
          }
          self.logInfo(req, 'recaptcha-complete');
        } catch (e) {
          self.apos.util.error(e);
          throw self.apos.error('error', req.t('AposRecap:recaptchaErr'));
        }
      }
    };
  }
};
