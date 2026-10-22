module.exports = function (self) {
  return {
    async submitForm (req) {
      const input = JSON.parse(req.body.data);
      const output = {};
      const formErrors = [];
      const formId = self.inferIdLocaleAndMode(req, input._id);

      const form = await self.find(req, {
        _id: self.apos.launder.id(formId)
      }).toObject();

      if (!form) {
        throw self.apos.error('notfound');
      }

      if (form.enableRecaptcha) {
        try {
          // Process reCAPTCHA input if needed.
          await self.checkRecaptcha(req, input, formErrors);
        } catch (e) {
          self.apos.util.error('reCAPTCHA submission error', e);
          throw self.apos.error('invalid');
        }
      }

      // Reject invalid submissions (for example a failed reCAPTCHA challenge)
      // BEFORE storing any uploaded files. Otherwise a rejected submission
      // would still persist a publicly accessible attachment that garbage
      // collection never reclaims (GHSA-rgg4-476q-xgcg).
      if (formErrors.length > 0) {
        throw self.apos.error('invalid', {
          formErrors
        });
      }

      // Field names for the query params check list. Declared here so it
      // remains available after the try block below.
      const fieldNames = [];

      // Track attachments stored while processing this submission so they can
      // be removed if the submission is ultimately rejected. This ensures a
      // rejected submission never leaves persistent, publicly accessible files
      // behind (GHSA-rgg4-476q-xgcg).
      const insertedAttachmentIds = [];

      try {
        // Find any file field submissions and insert the files as attachments
        for (const [ field, value ] of Object.entries(input)) {
          if (value === 'files-pending') {
            try {
              input[field] = await self.insertFieldFiles(req, field, req.files);
              insertedAttachmentIds.push(...input[field]);
            } catch (error) {
              self.apos.util.error(error);
              formErrors.push({
                field,
                error: 'invalid',
                message: req.t('aposForm:fileUploadError')
              });
            }
          }
        }

        // Recursively walk the area and its sub-areas so we find
        // fields nested in two-column widgets and the like

        // walk is not an async function so build an array of them to start
        const areas = [];

        self.apos.area.walk({
          contents: form.contents
        }, function(area) {
          areas.push(area);
        });

        const conditionals = {};
        const skipFields = [];

        // Populate the conditionals object fully to clear disabled values
        // before starting sanitization.
        for (const area of areas) {
          const widgets = area.items || [];
          for (const widget of widgets) {
            // Capture field names for the params check list.
            fieldNames.push(widget.fieldName);

            if (widget.type === '@apostrophecms/form-conditional') {
              self.trackConditionals(conditionals, widget);
            }
          }
        }

        self.collectToSkip(input, conditionals, skipFields);

        for (const area of areas) {
          const widgets = area.items || [];
          for (const widget of widgets) {
            const manager = self.apos.area.getWidgetManager(widget.type);
            if (
              manager && manager.sanitizeFormField &&
            !skipFields.includes(widget.fieldName)
            ) {
              try {
                manager.checkRequired(req, widget, input);
                await manager.sanitizeFormField(widget, input, output);
              } catch (err) {
                if (err.data && err.data.fieldError) {
                  formErrors.push(err.data.fieldError);
                } else {
                  throw err;
                }
              }
            }
          }
        }

        if (formErrors.length > 0) {
          throw self.apos.error('invalid', {
            formErrors
          });
        }
      } catch (error) {
        // The submission was rejected after one or more uploaded files were
        // stored (a field validation error, a file upload failure, or an
        // unexpected error). Remove those attachments so a rejected submission
        // can't leave persistent, publicly accessible files behind.
        await self.deleteFieldFiles(req, insertedAttachmentIds);
        throw error;
      }

      if (form.enableQueryParams && form.queryParamList.length > 0) {
        self.processQueryParams(form, input, output, fieldNames);
      }

      await self.emit('submission', req, form, output);

      return {};
    },
    async insertFieldFiles (req, name, files) {

      // Upload each file for the field, then join IDs.
      const ids = [];

      for (const entry in files) {
        if (!self.matchesName(entry, name)) {
          continue;
        }

        const attachment = await self.apos.attachment.insert(req, files[entry], {
          permissions: false
        });

        ids.push(attachment._id);
      }

      return ids;

    },
    async deleteFieldFiles (req, ids = []) {
      // Remove attachments that were stored while processing a form submission
      // that was ultimately rejected. Both the stored files (in uploadfs) and
      // the database record are removed so no publicly accessible orphan
      // remains. Best effort: a failure to remove one attachment must not
      // prevent removal of the others, nor mask the original submission error.
      for (const id of ids) {
        try {
          const attachment = await self.apos.attachment.db.findOne({ _id: id });

          if (!attachment) {
            continue;
          }

          await self.apos.attachment.alterAttachment(attachment, 'remove');
          await self.apos.attachment.db.removeOne({ _id: id });
        } catch (error) {
          self.apos.util.error(error);
        }
      }
    },
    matchesName(str, name) {
      return str.startsWith(name) && str.match(/.+-\d+$/);
    },
    trackConditionals(conditionals = {}, widget) {
      const conditionName = widget.conditionName;
      const conditionValue = widget.conditionValue;

      if (!widget || !widget.contents || !widget.contents.items) {
        return;
      }

      conditionals[conditionName] = conditionals[conditionName] || {};

      conditionals[conditionName][conditionValue] =
      conditionals[conditionName][conditionValue] || [];

      widget.contents.items.forEach(item => {
        conditionals[conditionName][conditionValue].push(item.fieldName);
      });

      // If there aren't any fields in the conditional group, don't bother
      // tracking it.
      if (conditionals[conditionName][conditionValue].length === 0) {
        delete conditionals[conditionName][conditionValue];
      }
    },
    collectToSkip(input, conditionals, skipFields) {
      const normalize = (val) => {
        if (typeof val === 'string') {
          const cleaned = val.replace(/^["']|["']$/g, '');
          // Use exact matches to avoid substring issues
          if (cleaned === 'on' || cleaned === 'true') {
            return true;
          }
          if (cleaned === 'off' || cleaned === 'false') {
            return false;
          }
          return cleaned;
        }
        return val;
      };

      for (const name in conditionals) {
        for (const value in conditionals[name]) {
          if (normalize(input[name]) !== normalize(value)) {
            conditionals[name][value].forEach(field => skipFields.push(field));
          }
        }
      }
    }
  };
};
