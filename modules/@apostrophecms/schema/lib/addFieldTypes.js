const _ = require('lodash');
const dayjs = require('dayjs');
const tinycolor = require('tinycolor2');
const { klona } = require('klona');
const { stripIndents } = require('common-tags');
const joinr = require('./joinr');

const dateRegex = /^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/;

module.exports = (self) => {
  self.addFieldType({
    name: 'area',
    async convert(req, field, data, destination, forcePlaceholder) {
      const _id = self.apos.launder.id(data[field.name] && data[field.name]._id) || self.apos.util.generateId();
      if (typeof data[field.name] === 'string') {
        destination[field.name] = self.apos.area.fromPlaintext(data[field.name]);
        return;
      }
      if (Array.isArray(data[field.name])) {
        data[field.name] = {
          metaType: 'area',
          items: data[field.name]
        };
      }
      let items = [];
      // accept either an array of items, or a complete
      // area object
      try {
        items = data[field.name].items || [];
        if (!Array.isArray(items)) {
          items = [];
        }
      } catch (e) {
        // Always recover graciously and import something reasonable, like an empty area
        items = [];
      }
      items = await self.apos.area.sanitizeItems(req, items, field.options || {}, forcePlaceholder);
      destination[field.name] = {
        _id,
        items,
        metaType: 'area'
      };
    },
    isEmpty: function (field, value) {
      return self.apos.area.isEmpty({ area: value });
    },
    isEqual (req, field, one, two) {
      if (self.apos.area.isEmpty({ area: one[field.name] }) && self.apos.area.isEmpty({ area: two[field.name] })) {
        return true;
      }
      return _.isEqual(one[field.name], two[field.name]);
    },
    validate: function (field, options, warn, fail) {
      if (field.options && field.options.widgets) {
        for (const name of Object.keys(field.options.widgets)) {
          if (!self.apos.modules[`${name}-widget`]) {
            if (name.match(/-widget$/)) {
              warn(stripIndents`
                Do not include "-widget" in the name when configuring a widget in an area field.
                Apostrophe will automatically add "-widget" when looking for the right module.
              `);
            } else {
              warn(`Nonexistent widget type name ${name} in area field.`);
            }
          }
        }
      }
    }
  });

  self.addFieldType({
    name: 'string',
    convert: function (req, field, data, destination) {
      destination[field.name] = self.apos.launder.string(data[field.name], field.def);

      destination[field.name] = checkStringLength(destination[field.name], field.min, field.max);
      // If field is required but empty (and client side didn't catch that)
      // This is new and until now if JS client side failed, then it would
      // allow the save with empty values -Lars
      if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
        throw self.apos.error('required');
      }
    },
    index: function (value, field, texts) {
      const silent = field.silent === undefined ? true : field.silent;
      texts.push({
        weight: field.weight || 15,
        text: value,
        silent: silent
      });
    },
    isEmpty: function (field, value) {
      return !value.length;
    },
    addQueryBuilder: function (field, query) {
      query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const criteria = {};
            criteria[field.name] = new RegExp(self.apos.util.regExpQuote(query.get(field.name)), 'i');
            query.and(criteria);
          }
        },
        launder: function (s) {
          return self.apos.launder.string(s);
        },
        choices: async function () {
          return self.sortedDistinct(field.name, query);
        }
      });
    },
    def: ''
  });

  self.addFieldType({
    name: 'slug',
    extend: 'string',
    // if field.page is true, expect a page slug (slashes allowed,
    // leading slash required). Otherwise, expect a object-style slug
    // (no slashes at all)
    convert: function (req, field, data, destination) {
      const options = {
        def: field.def
      };
      if (field.page) {
        options.allow = '/';
      }
      destination[field.name] = self.apos.util.slugify(self.apos.launder.string(data[field.name], field.def), options);

      if (field.page) {
        if (!(destination[field.name].charAt(0) === '/')) {
          destination[field.name] = '/' + destination[field.name];
        }
        // No runs of slashes
        destination[field.name] = destination[field.name].replace(/\/+/g, '/');
        // No trailing slashes (except for root)
        if (destination[field.name] !== '/') {
          destination[field.name] = destination[field.name].replace(/\/$/, '');
        }
      }
    },
    addQueryBuilder(field, query) {
      query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const criteria = {};
            let slugifyOptions = {};
            if (field.page) {
              slugifyOptions = { allow: '/' };
            }
            criteria[field.name] = new RegExp(self.apos.util.regExpQuote(self.apos.util.slugify(query.get(field.name), slugifyOptions)));
            query.and(criteria);
          }
        },
        choices: async function () {
          return self.sortedDistinct(field.name, query);
        }
      });
    }
  });

  self.addFieldType({
    name: 'boolean',
    convert: function (req, field, data, destination) {
      destination[field.name] = self.apos.launder.boolean(data[field.name], field.def);
    },
    isEmpty: function (field, value) {
      return !value && value !== false;
    },
    exporters: {
      string: function (req, field, object, output) {
        output[field.name] = self.apos.launder.boolean(object[field.name]).toString();
      }
    },
    addQueryBuilder(field, query) {
      let criteria;
      query.addBuilder(field.name, {
        finalize: function () {
          if (query.get(field.name) === false) {
            criteria = {};
            criteria[field.name] = { $ne: true };
            query.and(criteria);
          } else if (query.get(field.name) === true) {
            criteria = {};
            criteria[field.name] = true;
            query.and(criteria);
          }
        },
        launder: function (b) {
          return self.apos.launder.booleanOrNull(b);
        },
        choices: async function () {
          const values = await query.toDistinct(field.name);
          const choices = [];
          if (_.includes(values, true)) {
            choices.push({
              value: '1',
              label: 'apostrophe:yes'
            });
          }
          if (_.includes(values, false)) {
            choices.push({
              value: '0',
              label: 'apostrophe:no'
            });
          }
          return choices;
        }
      });
    }
  });

  self.addFieldType({
    name: 'color',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.string(data[field.name], field.def);

      if (field.required && (_.isUndefined(destination[field.name]) || !destination[field.name].toString().length)) {
        throw self.apos.error('required');
      }

      const test = tinycolor(destination[field.name]);
      if (!tinycolor(test).isValid()) {
        destination[field.name] = null;
      }
    },
    isEmpty: function (field, value) {
      return !value.length;
    }
  });

  self.addFieldType({
    name: 'checkboxes',
    dynamicChoices: true,
    async convert(req, field, data, destination) {
      const choices = await self.getChoices(req, field);
      if (typeof data[field.name] === 'string') {
        data[field.name] = self.apos.launder.string(data[field.name]).split(',');

        if (!Array.isArray(data[field.name])) {
          destination[field.name] = [];
          return;
        }

        destination[field.name] = _.filter(data[field.name], function (choice) {
          return _.includes(_.map(choices, 'value'), choice);
        });
      } else {
        if (!Array.isArray(data[field.name])) {
          destination[field.name] = [];
        } else {
          destination[field.name] = _.filter(data[field.name], function (choice) {
            return _.includes(_.map(choices, 'value'), choice);
          });
        }
      }

      if ((field.min !== undefined) && (destination[field.name].length < field.min)) {
        throw self.apos.error('min');
      }
      if ((field.max !== undefined) && (destination[field.name].length > field.max)) {
        throw self.apos.error('max');
      }
    },
    index: function (value, field, texts) {
      const silent = field.silent === undefined ? true : field.silent;
      texts.push({
        weight: field.weight || 15,
        text: (value || []).join(' '),
        silent: silent
      });
    },
    addQueryBuilder(field, query) {
      return query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const criteria = {};
            let v = query.get(field.name);
            // Allow programmers to pass just one value too (sanitize doesn't apply to them)
            if (!Array.isArray(v)) {
              v = [ v ];
            }
            criteria[field.name] = { $in: v };
            query.and(criteria);
          }
        },
        launder: function (value) {
          // Support one or many
          if (Array.isArray(value)) {
            return _.map(value, function (v) {
              return self.apos.launder.select(v, field.choices, field.def);
            });
          } else {
            return [ self.apos.launder.select(value, field.choices, field.def) ];
          }
        },
        choices: async function () {
          const values = await query.toDistinct(field.name);
          const choices = _.map(values, function (value) {
            const choice = _.find(field.choices, { value: value });
            return {
              value: value,
              label: choice && (choice.label || value)
            };
          });
          self.apos.util.insensitiveSortByProperty(choices, 'label');
          return choices;
        }
      });
    },
    validate: function (field, options, warn, fail) {
      if (field.max && typeof field.max !== 'number') {
        fail('Property "max" must be a number');
      }
      if (field.min && typeof field.min !== 'number') {
        fail('Property "min" must be a number');
      }
    }
  });

  self.addFieldType({
    name: 'select',
    dynamicChoices: true,
    async convert(req, field, data, destination) {
      const choices = await self.getChoices(req, field);
      destination[field.name] = self.apos.launder.select(data[field.name], choices, field.def);
    },
    index: function (value, field, texts) {
      const silent = field.silent === undefined ? true : field.silent;
      texts.push({
        weight: field.weight || 15,
        text: value,
        silent: silent
      });
    },
    addQueryBuilder(field, query) {
      return query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const criteria = {};
            let v = query.get(field.name);
            // Allow programmers to pass just one value too (sanitize doesn't apply to them)
            if (!Array.isArray(v)) {
              v = [ v ];
            }
            criteria[field.name] = { $in: v };
            query.and(criteria);
          }
        },
        launder: function (value) {
          // Support one or many
          if (Array.isArray(value)) {
            return _.map(value, function (v) {
              return self.apos.launder.select(v, field.choices, null);
            });
          } else {
            value = (typeof field.choices) === 'string'
              ? self.apos.launder.string(value)
              : self.apos.launder.select(value, field.choices, null);
            if (value === null) {
              return null;
            }
            return [ value ];
          }
        },
        choices: async function () {
          let allChoices;
          const values = await query.toDistinct(field.name);
          if ((typeof field.choices) === 'string') {
            const req = self.apos.task.getReq();
            allChoices = await self.apos.modules[field.moduleName][field.choices](req);
          } else {
            allChoices = field.choices;
          }
          const choices = _.map(values, function (value) {
            const choice = _.find(allChoices, { value: value });
            return {
              value: value,
              label: choice && (choice.label || value)
            };
          });
          self.apos.util.insensitiveSortByProperty(choices, 'label');
          return choices;
        }
      });
    }
  });

  self.addFieldType({
    name: 'radio',
    extend: 'select'
  });

  self.addFieldType({
    name: 'integer',
    vueComponent: 'AposInputString',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.integer(data[field.name], field.def, field.min, field.max);
      if (field.required && ((data[field.name] == null) || !data[field.name].toString().length)) {
        throw self.apos.error('required');
      }
      if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
        throw self.apos.error('invalid');
      }
      // This makes it possible to have a field that is not required, but min / max defined.
      // This allows the form to be saved and sets the value to null if no value was given by
      // the user.
      if (!data[field.name] && data[field.name] !== 0) {
        destination[field.name] = null;
      }
    },
    addQueryBuilder(field, query) {
      return query.addBuilder(field.name, {
        finalize: function () {
          let criteria;
          const value = query.get(field.name);
          if (value !== undefined && value !== null) {
            if (Array.isArray(value) && value.length === 2) {
              criteria = {};
              criteria[field.name] = {
                $gte: value[0],
                $lte: value[1]
              };
            } else {
              criteria = {};
              criteria[field.name] = self.apos.launder.integer(value);
              query.and(criteria);
            }
          }
        },
        choices: async function () {
          return self.sortedDistinct(field.name, query);
        },
        launder: function (s) {
          return self.apos.launder.integer(s, null);
        }
      });
    }
  });

  self.addFieldType({
    name: 'float',
    vueComponent: 'AposInputString',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
      if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
        throw self.apos.error('required');
      }
      if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
        throw self.apos.error('invalid');
      }
      if (!data[field.name] && data[field.name] !== 0) {
        destination[field.name] = null;
      }
    },
    addQueryBuilder(field, query) {
      return query.addBuilder(field.name, {
        finalize: function () {
          let criteria;
          const value = query.get(field.name);
          if (value !== undefined && value !== null) {
            if (Array.isArray(value) && value.length === 2) {
              criteria = {};
              criteria[field.name] = {
                $gte: value[0],
                $lte: value[1]
              };
            } else {
              criteria = {};
              criteria[field.name] = self.apos.launder.float(value);
              query.and(criteria);
            }
          }
        },
        choices: async function () {
          return self.sortedDistinct(field.name, query);
        }
      });
    }
  });

  self.addFieldType({
    name: 'email',
    vueComponent: 'AposInputString',
    convert: function (req, field, data, destination) {
      destination[field.name] = self.apos.launder.string(data[field.name]);
      if (!data[field.name]) {
        if (field.required) {
          throw self.apos.error('required');
        }
      } else {
        // regex source: https://emailregex.com/
        const matches = data[field.name].match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
        if (!matches) {
          throw self.apos.error('invalid');
        }
      }
      destination[field.name] = data[field.name];
    }
  });

  self.addFieldType({
    name: 'url',
    vueComponent: 'AposInputString',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.url(data[field.name], field.def, true);
    },
    diffable: function (value) {
      // URLs are fine to diff and display
      if (typeof value === 'string') {
        return value;
      }
      // always return a valid string
      return '';
    },
    addQueryBuilder(field, query) {
      query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const criteria = {};
            criteria[field.name] = new RegExp(self.apos.util.regExpQuote(query.get(field.name)), 'i');
            query.and(criteria);
          }
        },
        launder: function (s) {
          // Don't be too strict, just enough that we can safely pass it to
          // regExpQuote, partial URLs are welcome
          return self.apos.launder.string(s);
        },
        choices: async function () {
          return self.sortDistinct(field.name, query);
        }
      });
    }
  });

  self.addFieldType({
    name: 'date',
    vueComponent: 'AposInputString',
    async convert(req, field, data, destination) {
      const newDateVal = data[field.name];
      if (!newDateVal && destination[field.name]) {
        // Allow date fields to be unset.
        destination[field.name] = null;
        return;
      }
      if (field.min && newDateVal && (newDateVal < field.min)) {
        // If the min requirement isn't met, leave as-is.
        return;
      }
      if (field.max && newDateVal && (newDateVal > field.max)) {
        // If the max requirement isn't met, leave as-is.
        return;
      }

      destination[field.name] = self.apos.launder.date(newDateVal, field.def);
    },
    validate: function (field, options, warn, fail) {
      if (field.max && !field.max.match(dateRegex)) {
        fail('Property "max" must be in the date format, YYYY-MM-DD');
      }
      if (field.min && !field.min.match(dateRegex)) {
        fail('Property "min" must be in the date format, YYYY-MM-DD');
      }
    },
    addQueryBuilder(field, query) {
      return query.addBuilder(field.name, {
        finalize: function () {
          if (self.queryBuilderInterested(query, field.name)) {
            const value = query.get(field.name);
            let criteria;
            if (Array.isArray(value)) {
              criteria = {};
              criteria[field.name] = {
                $gte: value[0],
                $lte: value[1]
              };
            } else {
              criteria = {};
              criteria[field.name] = self.apos.launder.date(value);
              query.and(criteria);
            }
          }
        },
        launder: function (value) {
          if (Array.isArray(value) && value.length === 2) {
            if (value[0] instanceof Date) {
              value[0] = dayjs(value[0]).format('YYYY-MM-DD');
            }
            if (value[1] instanceof Date) {
              value[1] = dayjs(value[1]).format('YYYY-MM-DD');
            }
            value[0] = self.apos.launder.date(value[0]);
            value[1] = self.apos.launder.date(value[1]);
            return value;
          } else {
            if (value instanceof Date) {
              value = dayjs(value).format('YYYY-MM-DD');
            }
            return self.apos.launder.date(value, null);
          }
        },
        choices: async function () {
          return self.sortDistinct(field.name, query);
        }
      });
    }
  });

  self.addFieldType({
    name: 'time',
    vueComponent: 'AposInputString',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.time(data[field.name], field.def);
    }
  });

  self.addFieldType({
    name: 'dateAndTime',
    vueComponent: 'AposInputDateAndTime',
    convert (req, field, data, destination) {
      destination[field.name] = data[field.name]
        ? self.apos.launder.date(data[field.name])
        : null;
    }
  });

  self.addFieldType({
    name: 'password',
    async convert(req, field, data, destination) {
      // This is the only field type that we never update unless
      // there is actually a new value — a blank password is not cool. -Tom
      if (data[field.name]) {
        destination[field.name] = self.apos.launder.string(data[field.name], field.def);

        destination[field.name] = checkStringLength(destination[field.name], field.min, field.max);
      }
    }
  });

  self.addFieldType({
    name: 'group' // visual grouping only
  });

  self.addFieldType({
    name: 'range',
    vueComponent: 'AposInputRange',
    async convert(req, field, data, destination) {
      destination[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
      if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
        throw self.apos.error('required');
      }
      if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
        throw self.apos.error('invalid');
      }
      // Allow for ranges to go unset
      // `min` here does not imply requirement, it is the minimum value the range UI will represent
      if (
        !data[field.name] ||
        data[field.name] < field.min ||
        data[field.name] > field.max
      ) {
        destination[field.name] = null;
      }
    },
    validate: function (field, options, warn, fail) {
      if (!field.min && field.min !== 0) {
        fail('Property "min" must be set.');
      }
      if (!field.max && field.max !== 0) {
        fail('Property "max" must be set.');
      }
      if (typeof field.max !== 'number') {
        fail('Property "max" must be a number');
      }
      if (typeof field.min !== 'number') {
        fail('Property "min" must be a number');
      }
      if (field.step && typeof field.step !== 'number') {
        fail('Property "step" must be a number.');
      }
      if (field.unit && typeof field.unit !== 'string') {
        fail('Property "unit" must be a string.');
      }
    }
  });

  self.addFieldType({
    name: 'array',
    async convert(req, field, data, destination) {
      const schema = field.schema;
      data = data[field.name];
      if (!Array.isArray(data)) {
        data = [];
      }
      const results = [];
      if (field.limit && data.length > field.limit) {
        data = data.slice(0, field.limit);
      }
      const errors = [];
      for (const datum of data) {
        const result = {};
        result._id = self.apos.launder.id(datum._id) || self.apos.util.generateId();
        result.metaType = 'arrayItem';
        result.scopedArrayName = field.scopedArrayName;
        try {
          await self.convert(req, schema, datum, result);
        } catch (e) {
          if (Array.isArray(e)) {
            for (const error of e) {
              error.path = `${result._id}.${error.path}`;
              errors.push(error);
            }
          } else {
            throw e;
          }
        }
        results.push(result);
      }
      destination[field.name] = results;
      if (field.required && !results.length) {
        throw self.apos.error('required');
      }
      if ((field.min !== undefined) && (results.length < field.min)) {
        throw self.apos.error('min');
      }
      if ((field.max !== undefined) && (results.length > field.max)) {
        throw self.apos.error('max');
      }
      if (errors.length) {
        throw errors;
      }
    },
    isEmpty: function (field, value) {
      return (!Array.isArray(value)) || (!value.length);
    },
    index: function (value, field, texts) {
      _.each(value || [], function (item) {
        self.apos.schema.indexFields(field.schema, item, texts);
      });
    },
    validate: function (field, options, warn, fail) {
      for (const subField of field.schema || field.fields.add) {
        self.validateField(subField, options);
      }
    },
    register: function (metaType, type, field) {
      const localArrayName = field.arrayName || field.name;
      field.scopedArrayName = `${metaType}.${type}.${localArrayName}`;
      self.arrayManagers[field.scopedArrayName] = {
        schema: field.schema
      };
      self.register(metaType, type, field.schema);
    },
    isEqual(req, field, one, two) {
      if (!(one[field.name] && two[field.name])) {
        return !(one[field.name] || two[field.name]);
      }
      if (one[field.name].length !== two[field.name].length) {
        return false;
      }
      for (let i = 0; (i < one.length); i++) {
        if (!self.isEqual(req, field.schema, one[field.name][i], two[field.name][i])) {
          return false;
        }
      }
      return true;
    },
    def: []
  });

  self.addFieldType({
    name: 'object',
    async convert(req, field, data, destination) {
      data = data[field.name];
      const schema = field.schema;
      const errors = [];
      const result = {
        _id: self.apos.launder.id(data && data._id) || self.apos.util.generateId()
      };
      if (data == null || typeof data !== 'object' || Array.isArray(data)) {
        data = {};
      }
      try {
        await self.convert(req, schema, data, result);
      } catch (e) {
        for (const error of e) {
          errors.push({
            path: error.path,
            error: error.error
          });
        }
      }
      result.metaType = 'objectItem';
      result.scopedObjectName = field.scopedObjectName;
      destination[field.name] = result;
      if (errors.length) {
        throw errors;
      }
    },
    register: function (metaType, type, field) {
      const localObjectName = field.objectName || field.name;
      field.scopedObjectName = `${metaType}.${type}.${localObjectName}`;
      self.objectManagers[field.scopedObjectName] = {
        schema: field.schema
      };
      self.register(metaType, type, field.schema);
    },
    validate: function (field, options, warn, fail) {
      for (const subField of field.schema || field.fields.add) {
        self.validateField(subField, options);
      }
    },
    isEqual(req, field, one, two) {
      if (one && (!two)) {
        return false;
      }
      if (two && (!one)) {
        return false;
      }
      if (!(one || two)) {
        return true;
      }
      if (one[field.name] && (!two[field.name])) {
        return false;
      }
      if (two[field.name] && (!one[field.name])) {
        return false;
      }
      if (!(one[field.name] || two[field.name])) {
        return true;
      }
      return self.isEqual(req, field.schema, one[field.name], two[field.name]);
    },
    def: {}
  });

  self.addFieldType({
    name: 'relationship',
    // Validate a relationship field, copying from `data[field.name]` to
    // `object[field.name]`. If the relationship is named `_product`, then
    // `data._product` should be an array of product docs.
    // These doc objects must at least have an _id property.
    //
    // Alternatively, entries in `data._product` may simply be
    // `_id` strings or `title` strings. Titles are compared in a
    // tolerant manner. This is useful for CSV input. Strings may
    // be mixed with actual docs in a single array.
    //
    // If the relationship field has a `fields` option, then each
    // doc object may also have a `_fields` property which
    // will be validated against the schema in `fields`.
    //
    // The result in `object[field.name]` will always be an array
    // of zero or more related docs, containing only those that
    // actually exist in the database and can be fetched by this user,
    // in the same order specified in `data[field.name]`.
    //
    // Actual storage to the permanent idsStorage and fieldsStorage
    // properties is handled at a lower level in a beforeSave
    // handler of the doc-type module.

    async convert(req, field, data, destination) {
      const manager = self.apos.doc.getManager(field.withType);
      if (!manager) {
        throw Error('relationship with type ' + field.withType + ' unrecognized');
      }
      let input = data[field.name];
      if (input == null) {
        input = [];
      }
      if ((typeof input) === 'string') {
        // Handy in CSV: allows titles or _ids
        input = input.split(/\s*,\s*/);
      }
      if (field.min && field.min > input.length) {
        throw self.apos.error('min', `Minimum ${field.withType} required not reached.`);
      }
      if (field.max && field.max < input.length) {
        throw self.apos.error('max', `Maximum ${field.withType} required reached.`);
      }
      const ids = [];
      const titlesOrIds = [];
      for (const item of input) {
        if ((typeof item) === 'string') {
          titlesOrIds.push(item);
        } else {
          if (item && ((typeof item._id) === 'string')) {
            ids.push(item._id);
          }
        }
      }
      const clauses = [];
      if (titlesOrIds.length) {
        clauses.push({
          titleSortified: {
            $in: titlesOrIds.map(titleOrId => self.apos.util.sortify(titleOrId))
          }
        });
      }
      if (ids.length) {
        clauses.push({
          _id: {
            $in: ids
          }
        });
      }
      if (!clauses.length) {
        destination[field.name] = [];
        return;
      }
      const results = await manager.find(req, { $or: clauses }).relationships(false).toArray();
      // Must maintain input order. Also discard things not actually found in the db
      const actualDocs = [];
      for (const item of input) {
        if ((typeof item) === 'string') {
          const result = results.find(result => (result.title === item) || (result._id === item));
          if (result) {
            actualDocs.push(result);
          }
        } else if ((item && ((typeof item._id) === 'string'))) {
          const result = results.find(doc => (doc._id === item._id));
          if (result) {
            if (field.schema) {
              result._fields = {};
              if (item && ((typeof item._fields === 'object'))) {
                await self.convert(req, field.schema, item._fields || {}, result._fields);
              }
            }
            actualDocs.push(result);
          }
        }
      }
      destination[field.name] = actualDocs;
    },

    relate: async function (req, field, objects, options) {
      return self.relationshipDriver(req, joinr.byArray, false, objects, field.idsStorage, field.fieldsStorage, field.name, options);
    },

    addQueryBuilder(field, query) {

      addOperationQueryBuilder('', '$in');
      addOperationQueryBuilder('And', '$all');
      self.addRelationshipSlugQueryBuilder(field, query, '');
      self.addRelationshipSlugQueryBuilder(field, query, 'And');

      function addOperationQueryBuilder(suffix, operator) {
        return query.addBuilder(field.name + suffix, {
          finalize: function () {

            if (!self.queryBuilderInterested(query, field.name + suffix)) {
              return;
            }

            const value = query.get(field.name + suffix);
            const criteria = {};
            // Even programmers appreciate shortcuts, so it's not enough that the
            // sanitizer (which doesn't apply to programmatic use) accepts these
            if (Array.isArray(value)) {
              criteria[field.idsStorage] = {};
              criteria[field.idsStorage][operator] = value.map(self.apos.doc.toAposDocId);
            } else if (value === 'none') {
              criteria.$or = [];
              let clause = {};
              clause[field.idsStorage] = null;
              criteria.$or.push(clause);
              clause = {};
              clause[field.idsStorage] = { $exists: 0 };
              criteria.$or.push(clause);
              clause = {};
              clause[field.idsStorage + '.0'] = { $exists: 0 };
              criteria.$or.push(clause);
            } else {
              criteria[field.idsStorage] = { $in: [ self.apos.doc.toAposDocId(value) ] };
            }
            query.and(criteria);
          },
          choices: self.relationshipQueryBuilderChoices(field, query, '_id'),
          launder: relationshipQueryBuilderLaunder
        });
      }
    },
    validate: function (field, options, warn, fail) {
      if (!field.name.match(/^_/)) {
        warn('Name of relationship field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
      }
      if (!field.idsStorage) {
        // Supply reasonable value
        field.idsStorage = field.name.replace(/^_/, '') + 'Ids';
      }
      if (!field.withType) {
        // Try to supply reasonable value based on relationship name. Relationship name will be plural,
        // so consider that too
        const withType = field.name.replace(/^_/, '').replace(/s$/, '');
        if (!_.find(self.apos.doc.managers, { name: withType })) {
          fail('withType property is missing. Hint: it must match the name of a doc type module. Or omit it and give your relationship the same name as the other type, with a leading _ and optional trailing s.');
        }
        field.withType = withType;
      }
      if (!field.withType) {
        fail('withType property is missing. Hint: it must match the name of a doc type module.');
      }
      if (Array.isArray(field.withType)) {
        _.each(field.withType, function (type) {
          lintType(type);
        });
      } else {
        lintType(field.withType);
        const withTypeManager = self.apos.doc.getManager(field.withType);
        field.editor = field.editor || withTypeManager.options.relationshipEditor;
        field.postprocessor = field.postprocessor || withTypeManager.options.relationshipPostprocessor;
        field.editorLabel = field.editorLabel || withTypeManager.options.relationshipEditorLabel;
        field.editorIcon = field.editorIcon || withTypeManager.options.relationshipEditorIcon;

        if (!field.schema && !Array.isArray(field.withType)) {
          const fieldsOption = withTypeManager.options.relationshipFields;
          const fields = fieldsOption && fieldsOption.add;
          field.fields = fields && klona(fields);
          field.schema = self.fieldsToArray(`Relationship field ${field.name}`, field.fields);
        }
      }
      if (field.schema && !field.fieldsStorage) {
        field.fieldsStorage = field.name.replace(/^_/, '') + 'Fields';
      }
      if (field.schema && !Array.isArray(field.schema)) {
        fail('schema property should be an array if present at this stage');
      }
      if (field.filters) {
        fail('"filters" property should be changed to "builders" for 3.x');
      }
      if (field.builders && field.builders.projection) {
        fail('"projection" sub-property should be changed to "project" for 3.x');
      }
      function lintType(type) {
        type = self.apos.doc.normalizeType(type);
        if (!_.find(self.apos.doc.managers, { name: type })) {
          fail('withType property, ' + type + ', does not match the name of any piece or page type module.');
        }
      }
    },
    isEqual(req, field, one, two) {
      const ids1 = one[field.idsStorage] || [];
      const ids2 = two[field.idsStorage] || [];
      if (!_.isEqual(ids1, ids2)) {
        return false;
      }
      if (field.fieldsStorage) {
        const fields1 = one[field.fieldsStorage] || {};
        const fields2 = two[field.fieldsStorage] || {};
        if (!_.isEqual(fields1, fields2)) {
          return false;
        }
      }
      return true;
    }
  });

  self.addFieldType({
    name: 'relationshipReverse',
    vueComponent: false,
    relate: async function (req, field, objects, options) {
      return self.relationshipDriver(req, joinr.byArrayReverse, true, objects, field.idsStorage, field.fieldsStorage, field.name, options);
    },
    validate: function (field, options, warn, fail) {
      let forwardRelationship;
      if (!field.name.match(/^_/)) {
        warn('Name of relationship field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
      }
      if (!field.withType) {
        // Try to supply reasonable value based on relationship name
        const withType = field.name.replace(/^_/, '').replace(/s$/, '');
        if (!_.find(self.apos.doc.managers, { name: withType })) {
          fail('withType property is missing. Hint: it must match the name of a piece or page type module. Or omit it and give your relationship the same name as the other type, with a leading _ and optional trailing s.');
        }
        field.withType = withType;
      }
      const otherModule = _.find(self.apos.doc.managers, { name: self.apos.doc.normalizeType(field.withType) });
      if (!otherModule) {
        fail('withType property, ' + field.withType + ', does not match the name of a piece or page type module.');
      }
      if (!(field.reverseOf || field.idsStorage)) {
        self.validate(otherModule.schema, {
          type: 'doc type',
          subtype: otherModule.name
        });
        // Look for a relationship with our type in the other type
        forwardRelationship = _.find(otherModule.schema, { withType: options.subtype });
        if (forwardRelationship) {
          field.reverseOf = forwardRelationship.name;
        }
      }
      if (field.reverseOf) {
        forwardRelationship = _.find(otherModule.schema, {
          type: 'relationship',
          name: field.reverseOf
        });
        if (!forwardRelationship) {
          fail('reverseOf property does not match the name property of any relationship in the schema for ' + field.withType + '. Hint: you are taking advantage of a relationship already being edited in the schema for that type, "reverse" must match "name".');
        }
        // Make sure the other relationship has any missing fields auto-supplied before
        // trying to access them
        self.validate([ forwardRelationship ], {
          type: 'doc type',
          subtype: otherModule.name
        });
        field.idsStorage = forwardRelationship.idsStorage;
        field.fieldsStorage = forwardRelationship.fieldsStorage;
      }
      if (!field.idsStorage) {
        field.idsStorage = field.name.replace(/^_/, '') + 'Ids';
      }
      if (!forwardRelationship) {
        forwardRelationship = _.find(otherModule.schema, {
          type: 'relationship',
          idsStorage: field.idsStorage
        });
        if (!forwardRelationship) {
          fail('idsStorage property does not match the idsStorage property of any relationship in the schema for ' + field.withType + '. Hint: you are taking advantage of a relationship already being edited in the schema for that type, your idsStorage must be the same to find the data there.');
        }
        if (forwardRelationship.fieldsStorage) {
          field.fieldsStorage = forwardRelationship.fieldsStorage;
        }
      }
    }
  });

  function checkStringLength (string, min, max) {
    if (string && min && string.length < min) {
      // Would be unpleasant, but shouldn't happen since the browser
      // also implements this. We're just checking for naughty scripts
      throw self.apos.error('min');
    }
    // If max is longer than allowed, trim the value down to the max length
    if (string && max && string.length > max) {
      return string.substr(0, max);
    }

    return string;
  }

  function relationshipQueryBuilderLaunder(v) {
    if (Array.isArray(v)) {
      return self.apos.launder.ids(v);
    } else if (typeof v === 'string' && v.length) {
      return [ self.apos.launder.id(v) ];
    } else if (v === 'none') {
      return 'none';
    }
    return undefined;
  }
};
