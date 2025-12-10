const fsp = require('node:fs/promises');
const importMethods = require('./import.js');
const exportMethods = require('./export.js');

module.exports = self => {
  return {
    registerFormats(formats = {}) {
      verifyFormats(formats);

      self.formats = {
        ...self.formats,
        ...formats
      };
    },
    // No need to override, the parent method returns `{}`.
    getBrowserData() {
      return {
        formats: Object
          .entries(self.formats)
          .map(([ key, value ]) => ({
            name: key,
            label: value.label,
            allowedExtension: value.allowedExtension
          })),
        importDraftsOnlyDefault: self.options.importDraftsOnlyDefault
      };
    },
    // Filter our docs that have their module with the import or export option set to
    // false and docs that have "admin only" permissions when the user is not an admin.
    // If a user does not have at lease the permission to view the draft, he won't
    // be able to import or export it.
    canImportOrExport(req, docType, action) {
      const docModule = self.apos.modules[docType];
      if (!docModule) {
        return false;
      }
      if (docModule.options.importExport?.[action] === false) {
        return false;
      }
      // TODO: Do we need to keep that since done by managers?
      if (!self.apos.permission.can(req, 'view', docType)) {
        return false;
      }

      return true;
    },

    async remove(filepath) {
      try {
        const stat = await fsp.lstat(filepath);
        if (stat.isDirectory()) {
          await fsp.rm(filepath, {
            recursive: true,
            force: true
          });
        } else {
          await fsp.unlink(filepath);
        }
        console.info(`removed: ${filepath}`);
      } catch (err) {
        console.trace(err);
        self.apos.util.error(
          `Error while trying to remove the file or folder: ${filepath}. You might want to remove it yourself.`
        );
      }
    },

    ...importMethods(self),
    ...exportMethods(self)
  };
};

function verifyFormats(formats) {
  if (typeof formats !== 'object') {
    throw new Error('formats must be an object');
  }

  Object
    .entries(formats)
    .forEach(([ formatName, format ]) => {
      const requiredKeys = [ 'label', 'extension', 'allowedExtension', 'allowedTypes', 'input', 'output' ];
      const allowedKeys = [ ...requiredKeys, 'includeAttachments' ];

      const keys = Object.keys(format);

      if (requiredKeys.some(requiredKey => !keys.includes(requiredKey))) {
        throw new Error(`${formatName}.label, ${formatName}.extension, ${formatName}.allowedExtension, ${formatName}.allowedTypes, ${formatName}.input and ${formatName}.output are required keys`);
      }
      keys.forEach(key => {
        if (!allowedKeys.includes(key)) {
          throw new Error(`${formatName}.${key} is not a valid key`);
        }
      });
      keys.forEach(key => {
        if (key === 'label') {
          if (typeof format[key] !== 'string') {
            throw new Error(`${formatName}.${key} must be a string`);
          }
        } else if (key === 'extension') {
          if (typeof format[key] !== 'string') {
            throw new Error(`${formatName}.${key} must be a string`);
          }
        } else if (key === 'allowedExtension') {
          if (typeof format[key] !== 'string') {
            throw new Error(`${formatName}.${key} must be a string`);
          }
        } else if (key === 'allowedTypes') {
          if (!Array.isArray(format[key])) {
            throw new Error(`${formatName}.${key} must be an array`);
          }
          format[key].forEach(allowedType => {
            if (typeof allowedType !== 'string') {
              throw new Error(`${formatName}.${key} must be an array of strings`);
            }
          });
        } else if (key === 'includeAttachments') {
          if (typeof format[key] !== 'boolean') {
            throw new Error(`${formatName}.${key} must be a boolean`);
          }
        } else if (key === 'input') {
          if (typeof format[key] !== 'function') {
            throw new Error(`${formatName}.${key} must be a function`);
          }
        } else if (key === 'output') {
          if (typeof format[key] !== 'function') {
            throw new Error(`${formatName}.${key} must be a function`);
          }
        }
      });
    });
};
