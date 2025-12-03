module.exports = {
  improve: '@apostrophecms/global',
  handlers (self) {
    return {
      'apostrophe:modulesRegistered': {
        addFormRecaptchaFields () {
          const formOptions = self.apos.modules['@apostrophecms/form'].options;

          if (!formOptions.recaptchaSecret && !formOptions.recaptchaSite) {
            const fieldGroup = {
              name: 'form',
              label: 'aposForm:globalGroup'
            };
            const recaptchaFields = [
              {
                name: 'useRecaptcha',
                label: 'aposForm:useRecaptcha',
                type: 'boolean',
                htmlHelp: 'aposForm:useRecaptchaHtmlHelp',
                group: fieldGroup
              },
              {
                name: 'recaptchaSite',
                label: 'aposForm:recaptchaSite',
                help: 'aposForm:recaptchaSiteHelp',
                type: 'string',
                required: true,
                group: fieldGroup,
                if: {
                  useRecaptcha: true
                }
              },
              {
                name: 'recaptchaSecret',
                label: 'aposForm:recaptchaSecret',
                help: 'aposForm:recaptchaSecretHelp',
                type: 'string',
                required: true,
                group: fieldGroup,
                if: {
                  useRecaptcha: true
                }
              }
            ];
            self.schema = self.schema.concat(recaptchaFields);
            // Reorder to support `last` group ordering.
            self.schema.sort((first, second) => {
              if (
                (first && first.group && first.group.last) &&
                !(second && second.group && second.group.last)
              ) {
                return 1;
              } else if (
                !(first && first.group && first.group.last) &&
                (second && second.group && second.group.last)
              ) {
                return -1;
              } else {
                return 0;
              }
            });
          }
        }
      }
    };
  }
};
