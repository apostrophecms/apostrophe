const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const fields = require('./lib/fields');
const recaptcha = require('./lib/recaptcha');
const processor = require('./lib/processor');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'aposForm:form',
    pluralLabel: 'aposForm:forms',
    quickCreate: true,
    seoFields: false,
    openGraph: false,
    i18n: {
      ns: 'aposForm',
      browser: true
    },
    shortcut: 'G,O'
  },
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  fields(self) {
    let add = fields.initial(self.options);

    if (self.options.emailSubmissions !== false) {
      add = {
        ...add,
        ...fields.emailFields
      };
    }

    const group = {
      basics: {
        label: 'aposForm:groupForm',
        fields: [ 'contents' ]
      },
      afterSubmit: {
        label: 'aposForm:groupAfterSubmission',
        fields: [
          'thankYouHeading',
          'thankYouBody',
          'sendConfirmationEmail',
          'emailConfirmationField'
        ]
          .concat(
            self.options.emailSubmissions !== false
              ? [
                'emails',
                'email'
              ]
              : []
          )
      },
      advanced: {
        label: 'aposForm:groupAdvanced',
        fields: [
          'submitLabel',
          'enableRecaptcha',
          'enableQueryParams',
          'queryParamList'
        ]
      }
    };

    return {
      add,
      group
    };
  },
  init(self) {
    self.ensureCollection();

    self.cleanOptions(self.options);
  },
  methods(self) {
    return {
      ...recaptcha(self),
      ...processor(self),
      async ensureCollection() {
        self.db = self.apos.db.collection('aposFormSubmissions');
        await self.db.ensureIndex({
          formId: 1,
          createdAt: 1
        });
        await self.db.ensureIndex({
          formId: 1,
          createdAt: -1
        });
      },
      processQueryParams(form, input, output, fieldNames) {
        if (!input.queryParams ||
          (typeof input.queryParams !== 'object')) {
          output.queryParams = null;
          return;
        }

        if (Array.isArray(form.queryParamList) && form.queryParamList.length > 0) {
          form.queryParamList.forEach(param => {
            // Skip if this is an existing field submitted by the form. This value
            // capture will be done by populating the form inputs client-side.
            if (fieldNames.includes(param.key)) {
              return;
            }
            const value = input.queryParams[param.key];

            if (value) {
              output[param.key] = self.tidyParamValue(param, value);
            } else {
              output[param.key] = null;
            }
          });
        }
      },
      tidyParamValue(param, value) {
        value = self.apos.launder.string(value);

        if (param.lengthLimit && param.lengthLimit > 0) {
          value = value.substring(0, (param.lengthLimit));
        }

        return value;
      },
      async sendEmailSubmissions(req, form, data) {
        if (self.options.emailSubmissions === false ||
          !form.emails || form.emails.length === 0) {
          return;
        }

        let emails = [];

        form.emails.forEach(mailRule => {
          if (!mailRule.conditions || mailRule.conditions.length === 0) {
            emails.push(mailRule.email);
            return;
          }

          let passed = true;

          mailRule.conditions.forEach(condition => {
            if (!condition.value) {
              return;
            }

            let answer = data[condition.field];

            if (!answer) {
              passed = false;
            } else {
              // Regex for comma-separation from https://stackoverflow.com/questions/11456850/split-a-string-by-commas-but-ignore-commas-within-double-quotes-using-javascript/11457952#comment56094979_11457952
              const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
              let acceptable = condition.value.match(regex);

              acceptable = acceptable.map(value => {
                // Remove leading/trailing white space and bounding double-quotes.
                value = value.trim();

                if (value[0] === '"' && value[value.length - 1] === '"') {
                  value = value.slice(1, -1);
                }

                return value.trim();
              });

              // If the value is stored as a string, convert to an array for checking.
              if (!Array.isArray(answer)) {
                answer = [ answer ];
              }

              if (!(answer.some(val => acceptable.includes(val)))) {
                passed = false;
              }
            }
          });

          if (passed === true) {
            emails.push(mailRule.email);
          }
        });
        // Get array of email addresses without duplicates.
        emails = [ ...new Set(emails) ];

        if (self.options.testing) {
          return emails;
        }

        if (emails.length === 0) {
          return null;
        }

        for (const key in data) {
          // Add some space to array lists.
          if (Array.isArray(data[key])) {
            data[key] = data[key].join(', ');
          }
        }

        try {
          const emailOptions = {
            form,
            data,
            to: emails.join(',')
          };

          await self.sendEmail(req, 'emailSubmission', emailOptions);

          return null;
        } catch (err) {
          self.apos.util.error('⚠️ @apostrophecms/form submission email notification error: ', err);

          return null;
        }
      },
      // Should be handled async. Options are: form, data, from, to and subject
      async sendEmail(req, emailTemplate, options) {
        const form = options.form;
        const data = options.data;
        return self.email(
          req,
          emailTemplate,
          {
            form,
            input: data
          },
          {
            from: options.from || form.email,
            to: options.to,
            subject: options.subject || form.title
          }
        );
      },
      // Normalize Multer's `req.files` (array) to the historical multiparty shape
      // expected by submit handlers (object keyed by field name with name/path/etc.).
      normalizeFiles(req, _res, next) {
        const files = Array.isArray(req.files) ? req.files : [];
        const mapped = {};
        const counters = {};

        for (const f of files) {
          const base = f.fieldname.replace(/-\d+$/, '');
          counters[base] = (counters[base] || 0) + 1;
          const key = `${base}-${counters[base]}`;

          mapped[key] = {
            path: f.path,
            name: f.originalname,
            type: f.mimetype,
            size: f.size
          };
        }

        req.files = mapped;
        next();
      }
    };
  },
  helpers(self) {
    return {
      prependIfPrefix(str) {
        if (self.options.classPrefix) {
          return `${self.options.classPrefix}${str}`;
        }

        return '';
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        // Route to accept the submitted form.
        submit: [
          multer({ dest: os.tmpdir() }).any(),
          self.normalizeFiles,
          async function (req) {
            try {
              await self.submitForm(req);
            } finally {
              // Cleanup temp files (same behavior as before)
              for (const file of (Object.values(req.files || {}))) {
                try {
                  fs.unlinkSync(file.path);
                } catch (e) {
                  self.apos.util.warn(req.t('aposForm:fileMissingEarly', {
                    path: file
                  }));
                }
              }
            }
          }
        ]
      }
    };
  },
  handlers(self) {
    return {
      submission: {
        async saveSubmission(req, form, data) {
          if (self.options.saveSubmissions === false) {
            return;
          }
          const submission = {
            createdAt: new Date(),
            formId: form._id,
            data
          };
          await self.emit('beforeSaveSubmission', req, {
            form,
            data,
            submission
          });
          return self.db.insertOne(submission);
        },
        async emailSubmission(req, form, data) {
          await self.sendEmailSubmissions(req, form, data);
        },
        async emailConfirmation(req, form, data) {
          if (form.sendConfirmationEmail !== true || !form.emailConfirmationField) {
            return;
          }

          // Email validation (Regex reference: https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript)
          const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

          if (
            data[form.emailConfirmationField] &&
            (typeof data[form.emailConfirmationField] !== 'string' ||
              !re.test(data[form.emailConfirmationField]))
          ) {
            await self.apos.notify(req, 'aposForm:errorEmailConfirm', {
              type: 'warning',
              icon: 'alert-circle-icon',
              interpolate: {
                field: form.emailConfirmationField
              }
            });
            return null;
          }

          try {
            const emailOptions = {
              form,
              data,
              to: data[form.emailConfirmationField]
            };
            await self.sendEmail(req, 'emailConfirmation', emailOptions);

            return null;
          } catch (err) {
            self.apos.util.error('⚠️ @apostrophecms/form submission email confirmation error: ', err);

            return null;
          }
        }
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
