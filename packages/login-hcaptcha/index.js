module.exports = {
  improve: '@apostrophecms/login',
  requirements(self) {
    if (
      !self.options.hcaptcha ||
      !self.options.hcaptcha.site ||
      !self.options.hcaptcha.secret
    ) {
      throw new Error('The login hCaptcha site key, secret key, or both are not configured');
    }

    return {
      add: {
        AposHcaptcha: {
          phase: 'beforeSubmit',
          async props(req) {
            return {
              sitekey: self.options.hcaptcha.site
            };
          },
          async verify(req, data) {
            if (!data) {
              throw self.apos.error('invalid', req.t('AposHcaptcha:missingConfig'));
            }

            await self.checkHcaptcha(req, data);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      async checkHcaptcha(req, token) {
        const { secret } = self.options.hcaptcha;

        if (!secret) {
          return;
        }

        try {
          const url = 'https://hcaptcha.com/siteverify';
          const options = {
            body: `response=${token}&secret=${secret}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          };

          const response = await self.apos.http.post(url, options);
          if (!response.success) {
            self.logInfo(req, 'hcaptcha-invalid-token', {
              data: response
            });
            throw self.apos.error('invalid', req.t('AposHcaptcha:invalidToken'));
          }
          self.logInfo(req, 'hcaptcha-complete');
        } catch (error) {
          self.apos.util.error('hCaptcha error', error);
          throw self.apos.error('error', req.t('AposHcaptcha:captchaErr'));
        }
      }
    };
  }
};
