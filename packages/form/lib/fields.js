module.exports = {
  initial(options) {
    return {
      title: {
        label: 'aposForm:formName',
        type: 'string',
        sortify: true,
        required: true
      },
      contents: {
        label: 'aposForm:formContents',
        type: 'area',
        options: {
          widgets: options.formWidgets || {
            '@apostrophecms/form-text-field': {},
            '@apostrophecms/form-textarea-field': {},
            // TODO: Enable the file field when anonymous uploading is available
            // '@apostrophecms/form-file-field': {},
            '@apostrophecms/form-boolean-field': {},
            '@apostrophecms/form-select-field': {},
            '@apostrophecms/form-radio-field': {},
            '@apostrophecms/form-checkboxes-field': {},
            '@apostrophecms/form-conditional': {},
            '@apostrophecms/form-divider': {},
            // '@apostrophecms/form-group': {}
            '@apostrophecms/rich-text': {
              toolbar: [
                'styles', 'bold', 'italic', 'link',
                'orderedList', 'bulletList'
              ]
            }
          }
        }
      },
      submitLabel: {
        label: 'aposForm:submitLabel',
        type: 'string'
      },
      thankYouHeading: {
        label: 'aposForm:thankYouTitle',
        type: 'string'
      },
      thankYouBody: {
        label: 'aposForm:thankYouBody',
        type: 'area',
        options: {
          widgets: options.thankYouWidgets || {
            '@apostrophecms/rich-text': {
              toolbar: [
                'styles', 'bold', 'italic', 'link',
                'orderedList', 'bulletList'
              ]
            }
          }
        }
      },
      sendConfirmationEmail: {
        label: 'aposForm:confEmailEnable',
        // NOTE: The confirmation email is in `views/emailConfirmation.html`.
        // Edit the message there, adding any dynamic content as needed.
        help: 'aposForm:confEmailEnableHelp',
        type: 'boolean'
      },
      emailConfirmationField: {
        label: 'aposForm:confEmailField',
        help: 'aposForm:confEmailFieldHelp',
        type: 'string',
        required: true,
        if: {
          sendConfirmationEmail: true
        }
      },
      enableQueryParams: {
        label: 'aposForm:enableQueryParams',
        type: 'boolean',
        htmlHelp: 'aposForm:enableQueryParamsHtmlHelp'
      },
      queryParamList: {
        label: 'aposForm:queryParamList',
        type: 'array',
        titleField: 'key',
        required: true,
        help: 'aposForm:queryParamListHelp',
        fields: {
          add: {
            key: {
              type: 'string',
              label: 'aposForm:queryParamKey',
              required: true
            },
            lengthLimit: {
              type: 'integer',
              label: 'aposForm:queryParamLimit',
              help: 'aposForm:queryParamLimitHelp',
              min: 1
            }
          }
        },
        if: {
          enableQueryParams: true
        }
      },
      enableRecaptcha: {
        label: 'aposForm:recaptchaEnable',
        help: 'aposForm:recaptchaEnableHelp',
        type: 'boolean'
      }
    };
  },
  emailFields: {
    emails: {
      label: 'aposForm:emails',
      type: 'array',
      titleField: 'email',
      fields: {
        add: {
          email: {
            type: 'email',
            required: true,
            label: 'aposForm:emailsAddress'
          },
          conditions: {
            label: 'aposForm:emailsConditions',
            help: 'aposForm:emailsConditionsHelp',
            type: 'array',
            titleField: 'value',
            fields: {
              add: {
                field: {
                  label: 'aposForm:emailsConditionsField',
                  type: 'string',
                  help: 'aposForm:emailsConditionsFieldHelp'
                },
                value: {
                  type: 'string',
                  label: 'aposForm:emailsConditionsValue',
                  htmlHelp: 'aposForm:emailsConditionsValueHtmlHelp'
                }
              }
            }
          }
        }
      }
    },
    email: {
      label: 'aposForm:emailField',
      type: 'string',
      required: true,
      help: 'aposForm:emailFieldHelp'
    }
  }
};
