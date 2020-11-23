// This module provides schemas, a flexible and fast way to create new data types
// by specifying the fields that should make them up. Schemas power
// [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html),
// [@apostrophecms/widget-type](../@apostrophecms/widget-type/index.html), custom field
// types in page settings for [@apostrophecms/page-type](../@apostrophecms/page-type/index.html)
// and more.
//
// A schema is simply an array of "plain old objects." Each object describes one field in the schema
// via `type`, `name`, `label` and other properties.
//
// See the [schema guide](../../tutorials/getting-started/schema-guide.html) for a complete
// overview and list of schema field types. The methods documented here on this page are most often
// used when you choose to work independently with schemas, such as in a custom project
// that requires forms.

const joinr = require('./lib/joinr');
const _ = require('lodash');
const dayjs = require('dayjs');
const tinycolor = require('tinycolor2');
const klona = require('klona');

module.exports = {
  options: {
    alias: 'schema'
  },
  init(self, options) {

    self.fieldTypes = {};
    self.fieldsById = {};
    self.enableBrowserData();

    self.addFieldType({
      name: 'area',
      convert: async function (req, field, data, object) {
        const _id = self.apos.launder.id(data[field.name] && data[field.name]._id) || self.apos.util.generateId();
        if (typeof data[field.name] === 'string') {
          object[field.name] = self.apos.area.fromPlaintext(data[field.name]);
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
        items = await self.apos.area.sanitizeItems(req, items, field.options || {});
        object[field.name] = {
          _id,
          items,
          metaType: 'area'
        };
      },
      isEmpty: function (field, value) {
        return self.apos.area.isEmpty({ area: value });
      }
    });

    self.addFieldType({
      name: 'string',
      convert: function (req, field, data, object) {
        object[field.name] = self.apos.launder.string(data[field.name], field.def);

        if (object[field.name] && field.min && object[field.name].length < field.min) {
          // Would be unpleasant, but shouldn't happen since the browser
          // also implements this. We're just checking for naughty scripts
          throw self.apos.error('min');
        }
        // If max is longer than allowed, trim the value down to the max length
        if (object[field.name] && field.max && object[field.name].length > field.max) {
          object[field.name] = object[field.name].substr(0, field.max);
        }
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
      }
    });

    self.addFieldType({
      name: 'slug',
      extend: 'string',
      // if field.page is true, expect a page slug (slashes allowed,
      // leading slash required). Otherwise, expect a object-style slug
      // (no slashes at all)
      convert: function (req, field, data, object) {
        const options = {};
        if (field.page) {
          options.allow = '/';
        }
        object[field.name] = self.apos.util.slugify(self.apos.launder.string(data[field.name], field.def), options);
        if (field.page) {
          if (!(object[field.name].charAt(0) === '/')) {
            object[field.name] = '/' + object[field.name];
          }
          // No runs of slashes
          object[field.name] = object[field.name].replace(/\/+/g, '/');
          // No trailing slashes (except for root)
          if (object[field.name] !== '/') {
            object[field.name] = object[field.name].replace(/\/$/, '');
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
      convert: function (req, field, data, object) {
        object[field.name] = self.apos.launder.boolean(data[field.name], field.def);
      },
      isEmpty: function (field, value) {
        return !value;
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
            const values = query.toDistinct(field.name);
            const choices = [];
            if (_.includes(values, true)) {
              choices.push({
                value: '1',
                label: 'Yes'
              });
            }
            if (_.includes(values, true)) {
              choices.push({
                value: '0',
                label: 'No'
              });
            }
            return choices;
          }
        });
      }
    });

    self.addFieldType({
      name: 'checkboxes',
      convert: async function (req, field, data, object) {
        if (typeof data[field.name] === 'string') {
          data[field.name] = self.apos.launder.string(data[field.name]).split(',');

          if (!Array.isArray(data[field.name])) {
            object[field.name] = [];
            return;
          }

          object[field.name] = _.filter(data[field.name], function (choice) {
            return _.includes(_.map(field.choices, 'value'), choice);
          });
        } else {
          if (!Array.isArray(data[field.name])) {
            object[field.name] = [];
          } else {
            object[field.name] = _.filter(data[field.name], function (choice) {
              return _.includes(_.map(field.choices, 'value'), choice);
            });
          }
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
      }
    });

    self.addFieldType({
      name: 'select',
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.select(data[field.name], field.choices, field.def);
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
              value = self.apos.launder.select(value, field.choices, null);
              if (value === null) {
                return null;
              }
              return [ value ];
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
      }
    });

    self.addFieldType({
      name: 'integer',
      vueComponent: 'AposInputString',
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.integer(data[field.name], field.def, field.min, field.max);
        if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
          throw self.apos.error('required');
        }
        if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
          throw self.apos.error('invalid');
        }
        // This makes it possible to have a field that is not required, but min / max defined.
        // This allows the form to be saved and sets the value to null if no value was given by
        // the user.
        if (!data[field.name] && data[field.name] !== 0) {
          object[field.name] = null;
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
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
        if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
          throw self.apos.error('required');
        }
        if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
          throw self.apos.error('invalid');
        }
        if (!data[field.name] && data[field.name] !== 0) {
          object[field.name] = null;
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
      convert: function (req, field, data, object) {
        object[field.name] = self.apos.launder.string(data[field.name], undefined, field.min, field.max);
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
        object[field.name] = data[field.name];
      }
    });

    self.addFieldType({
      name: 'color',
      convert: async function (req, field, data, object) {
        const test = self.apos.launder.string(data[field.name]);
        if (tinycolor(test).isValid()) {
          object[field.name] = test;
        } else {
          object[field.name] = null;
        }
      }
    });

    self.addFieldType({
      name: 'range',
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
      }
    });

    self.addFieldType({
      name: 'url',
      vueComponent: 'AposInputString',
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.url(data[field.name], field.def);
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
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.date(data[field.name], field.def);
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
      convert: async function (req, field, data, object) {
        object[field.name] = self.apos.launder.time(data[field.name], field.def);
      }
    });

    self.addFieldType({
      name: 'password',
      convert: async function (req, field, data, object) {
        // This is the only field type that we never update unless
        // there is actually a new value — a blank password is not cool. -Tom
        if (data[field.name]) {
          object[field.name] = self.apos.launder.string(data[field.name], field.def);
        }
      }
    });

    self.addFieldType({
      name: 'group' // visual grouping only
    });

    self.addFieldType({
      name: 'array',
      convert: async function (req, field, data, object) {
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
        object[field.name] = results;
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
      register: function (field) {
        self.register(field.schema);
      },
      def: []
    });

    self.addFieldType({
      name: 'object',
      convert: async function (req, field, data, object) {
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
        object[field.name] = result;
        if (errors.length) {
          throw errors;
        }
      },
      register: function (field) {
        self.register(field.schema);
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

      convert: async function (req, field, data, object) {
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
          object[field.name] = [];
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
        object[field.name] = actualDocs;
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
                criteria[field.idsStorage][operator] = value;
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
                criteria[field.idsStorage] = { $in: [ value ] };
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
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. Or omit it and give your relationship the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        if (!field.withType) {
          fail('withType property is missing. Hint: it must match the "name" property of a doc type.');
        }
        if (Array.isArray(field.withType)) {
          _.each(field.withType, function (type) {
            if (!_.find(self.apos.doc.managers, { name: type })) {
              fail('withType property, ' + type + ', does not match the "name" property of any doc type. In most cases this is the same as the module name.');
            }
          });
        } else {
          if (!_.find(self.apos.doc.managers, { name: field.withType })) {
            fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. In most cases this is the same as the module name.');
          }
        }
        if (field.schema && !field.fieldsStorage) {
          field.fieldsStorage = field.name.replace(/^_/, '') + 'Fields';
        }
        if (field.schema && !Array.isArray(field.schema)) {
          fail('schema property should be an array if present at this stage');
        }
      }
    });

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
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. Or omit it and give your relationship the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        const otherModule = _.find(self.apos.doc.managers, { name: field.withType });
        if (!otherModule) {
          fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. In most cases this is the same as the module name.');
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
        }
      }
    });

    self.validatedSchemas = {};
  },
  handlers(self, options) {
    return {
      'apostrophe:afterInit': {
        validateAllSchemas() {
          _.each(self.apos.doc.managers, function (manager, type) {
            self.validate(manager.schema, {
              type: 'doc type',
              subtype: type
            });
          });
          _.each(self.apos.area.widgetManagers, function (manager, type) {
            self.validate(manager.schema, {
              type: 'widget type',
              subtype: type
            });
          });
        },
        registerAllSchemas() {
          _.each(self.apos.doc.managers, function (manager, type) {
            self.register(manager.schema);
          });
          _.each(self.apos.area.widgetManagers, function (manager, type) {
            self.register(manager.schema);
          });
        }
      }
    };
  },
  methods(self, options) {
    const defaultGroup = self.options.defaultGroup || {
      name: 'ungrouped',
      label: 'Ungrouped'
    };

    return {
      // Compose a schema based on addFields, removeFields, orderFields
      // and, occasionally, alterFields options. This method is great for
      // merging the schema requirements of subclasses with the schema
      // requirements of a superclass. See the @apostrophecms/schema documentation
      // for a thorough explanation of the use of each option. The
      // alterFields option should be avoided if your needs can be met
      // via another option.

      compose(options) {
        let schema = [];

        // Useful for finding good unit test cases
        // self.apos.util.log(JSON.stringify(_.pick(options, 'addFields', 'removeFields', 'arrangeFields'), null, '  '));

        if (options.addFields) {
          // loop over our addFields
          _.each(options.addFields, function (field) {
            let i;
            // remove it from the schema if we've already added it, last one wins
            for (i = 0; i < schema.length; i++) {
              if (schema[i].name === field.name) {
                schema.splice(i, 1);
                break;
              }
            }
            // add the new field to the schema
            schema.push(field);
          });
        }

        if (options.removeFields) {
          schema = _.filter(schema, function (field) {
            return !_.includes(options.removeFields, field.name);
          });
        }

        if (options.requireFields) {
          _.each(options.requireFields, function (name) {
            const field = _.find(schema, function (field) {
              return field.name === name;
            });
            if (field) {
              field.required = true;
            }
          });
        }

        // If nothing else will do, just modify the schema with a function
        if (options.alterFields) {
          options.alterFields(schema);
        }

        // always make sure there is a default group
        let groups = [ {
          name: defaultGroup.name,
          label: defaultGroup.label,
          fields: _.map(schema, 'name')
        } ];

        // if we are getting arrangeFields and it's not empty
        if (options.arrangeFields && options.arrangeFields.length > 0) {
          // if it's full of strings, use them for the default group
          if (_.isString(options.arrangeFields[0])) {
            groups[0].fields = options.arrangeFields; // if it's full of objects, those are groups, so use them
          } else if (_.isPlainObject(options.arrangeFields[0])) {
            // reset the default group's fields, but keep it around,
            // in case they have fields they forgot to put in a group
            groups[0].fields = [];
            groups = groups.concat(options.arrangeFields);
          }
        }

        // If there is a later group with the same name, the later
        // one wins and the earlier is forgotten. Otherwise you can't
        // ever toss a field out of a group without putting it into
        // another one, which makes it impossible to un-group a
        // field and have it appear outside of tabs in the interface.
        //
        // A reconfigured group is ordered to the bottom of the list
        // of groups again, which has the intended effect if you
        // arrange all of the groups in your module config. However
        // it comes before any groups with the `last: true` flag that
        // were not reconfigured. Reconfiguring a group without that
        // flag clears it.

        const newGroups = [];
        _.each(groups, function (group) {
          const index = _.findIndex(newGroups, { name: group.name });
          if (index !== -1) {
            newGroups.splice(index, 1);
          }
          let i = _.findIndex(newGroups, { last: true });
          if (i === -1) {
            i = groups.length;
          }
          newGroups.splice(i, 0, group);
        });
        groups = newGroups;

        // all fields in the schema will end up in this variable
        let newSchema = [];
        // loop over any groups and orders we want to respect
        _.each(groups, function (group) {

          _.each(group.fields, function (field) {
            // find the field we are ordering
            let f = _.find(schema, { name: field });
            if (!f) {
              // May have already been migrated due to subclasses re-grouping fields
              f = _.find(newSchema, { name: field });
            }

            // make sure it exists
            if (f) {
              // set the group for this field
              const g = _.clone(group, true);
              delete g.fields;
              f.group = g;

              // push the field to the new schema, if it is a
              // duplicate due to subclasses pushing more
              // groupings, remove the earlier instance
              let fIndex = _.findIndex(newSchema, { name: field });
              if (fIndex !== -1) {
                newSchema.splice(fIndex, 1);
              }
              newSchema.push(f);

              // remove the field from the old schema, if that is where we got it from
              fIndex = _.findIndex(schema, { name: field });
              if (fIndex !== -1) {
                schema.splice(fIndex, 1);
              }
            }
          });
        });

        // put remaining fields in the default group
        _.each(schema, function (field) {
          const g = _.clone(groups[0], true);
          delete g.fields;
          field.group = g;
        });

        // add any fields not in defined groups to the end of the schema
        schema = newSchema.concat(schema);

        // If a field is not consecutive with other fields in its group,
        // move it after the last already encountered in its group,
        // to simplify rendering logic

        newSchema = [];
        const groupIndexes = {};
        _.each(schema, function (field) {
          if (field.group && field.group.name) {
            if (_.has(groupIndexes, field.group.name)) {
              newSchema.splice(groupIndexes[field.group.name], 0, field);
              groupIndexes[field.group.name]++;
            } else {
              newSchema.push(field);
              groupIndexes[field.group.name] = newSchema.length;
            }
          }
        });
        schema = newSchema;

        // Move the leftover group to the end, it's just too
        // obnoxious otherwise with one-off fields popping up
        // before title etc.

        schema = _.filter(schema, function (field) {
          return !(field.group && field.group.name === defaultGroup.name);
        }).concat(_.filter(schema, function (field) {
          return field.group && field.group.name === defaultGroup.name;
        }));

        _.each(schema, function (field) {

          // A field can have a custom template, which can be a
          // template name (relative to the @apostrophecms/schema module)
          // or a function (called to render it)

          if (field.template) {
            if (typeof field.template === 'string') {
              field.partial = self.partialer(field.template);
              delete field.template;
            } else {
              field.partial = field.template;
              delete field.template;
            }
          }

          // Extra validation for select fields, TODO move this into the field type definition

          if (field.type === 'select' || field.type === 'checkboxes') {
            _.each(field.choices, function (choice) {
              if (choice.showFields) {
                if (!_.isArray(choice.showFields)) {
                  throw new Error('The \'showFields\' property in the choices of a select field needs to be an array.');
                }
                _.each(choice.showFields, function (showFieldName) {
                  if (!_.find(schema, function (schemaField) {
                    return schemaField.name === showFieldName;
                  })) {
                    self.apos.util.error('WARNING: The field \'' + showFieldName + '\' does not exist in your schema, but you tried to toggle its display with a select field using showFields. STAAAHHHHPP!');
                  }
                });
              }
            });
          }
        });

        // Shallowly clone the fields. This allows modules
        // like workflow to patch schema fields of various modules
        // without inadvertently impacting other apos instances
        // when running with @apostrophecms/multisite
        return _.map(schema, function (field) {
          return _.clone(field);
        });
      },

      // refine is like compose, but it starts with an existing schema array
      // and amends it via the same options as compose.

      refine(schema, _options) {
        // Don't modify the original schema which may be in use elsewhere
        schema = _.cloneDeep(schema);
        // Deep clone is not required here, we just want
        // to modify the addFields property
        const options = _.clone(_options);
        options.addFields = schema.concat(options.addFields || []);
        // The arrangeFields option is trickier because we've already
        // done a compose() and so the groups are now denormalized as
        // properties of each field. Reconstruct the old
        // arrangeFields option so we can concatenate the new one
        const oldArrangeFields = [];
        _.each(schema, function (field) {
          if (field.group) {
            let group = _.find(oldArrangeFields, { name: field.group.name });
            if (!group) {
              group = _.clone(field.group);
              group.fields = [];
              oldArrangeFields.push(group);
            }
            group.fields.push(field.name);
          }
        });
        options.arrangeFields = oldArrangeFields.concat(options.arrangeFields || []);
        return self.compose(options);
      },

      // Converts a flat schema (array of field objects) into a two
      // dimensional schema, broken up by groups
      toGroups(fields) {
        // bail on empty schemas
        if (fields.length === 0) {
          return [];
        }

        // bail if we're already in groups
        if (fields[0].type === 'group') {
          return fields;
        }

        const groups = [];
        let currentGroup = -1;
        _.each(fields, function (field) {
          if (field.contextual) {
            return;
          }

          if (!field.group) {
            field.group = {
              name: defaultGroup.name,
              label: defaultGroup.label
            };
          }
          // first group, or not the current group
          if (groups.length === 0 || groups[currentGroup].name !== field.group.name) {
            groups.push({
              type: 'group',
              name: field.group.name,
              label: field.group.label,
              fields: []
            });
            currentGroup++;
          }
          // add field to current group
          groups[currentGroup].fields.push(field);
        });
        return groups;
      },

      // Return a new schema containing only the fields named in the
      // `fields` array, while maintaining existing group relationships.
      // Any empty groups are dropped. Do NOT include group names
      // in `fields`.

      subset(schema, fields) {

        let groups;

        // check if we're already grouped
        if (schema[0].type === 'group') {
          // Don't modify the original schema which may be in use elsewhere
          groups = _.cloneDeep(schema);

          // loop over each group and remove fields from them that aren't in this subset
          _.each(groups, function (group) {
            group.fields = _.filter(group.fields, function (field) {
              return _.includes(fields, field.name);
            });
          });

          // remove empty groups
          groups = _.filter(groups, function (group) {
            return group.fields.length > 0;
          });

          return groups;
        } else {
          // otherwise this is a simple filter
          return _.filter(schema, function (field) {
            return _.includes(fields, field.name);
          });
        }
      },

      // Return a new object with all default settings
      // defined in the schema
      newInstance(schema) {
        const instance = {};
        for (const field of schema) {
          if (field.def !== undefined) {
            instance[field.name] = klona(field.def);
          }
        }
        return instance;
      },

      subsetInstance(schema, instance) {
        const subset = {};
        _.each(schema, function (field) {
          if (field.type === 'group') {
            return;
          }
          const subsetCopy = self.fieldTypes[field.type].subsetCopy;
          if (!subsetCopy) {
            // These rules suffice for our standard fields
            subset[field.name] = instance[field.name];
            if (field.idsStorage) {
              subset[field.idsStorage] = instance[field.idsStorage];
            }
            if (field.fieldsStorage) {
              subset[field.fieldsStorage] = instance[field.fieldsStorage];
            }
          } else {
            subsetCopy(field.name, instance, subset, field);
          }
        });
        return subset;
      },

      // Determine whether an object is empty according to the schema.
      // Note this is not the same thing as matching the defaults. A
      // nonempty string or array is never considered empty. A numeric
      // value of 0 is considered empty

      empty(schema, object) {
        return !_.find(schema, function (field) {
          // Return true if not empty
          const value = object[field.name];
          if (value !== null && value !== undefined && value !== false) {
            const emptyTest = self.fieldTypes[field.type].empty;
            if (!emptyTest) {
              // Type has no method to check emptiness, so assume not empty
              return true;
            }
            return !emptyTest(field, value);
          }
        });
      },

      // Index the object's fields for participation in Apostrophe search unless
      // `searchable: false` is set for the field in question

      indexFields(schema, object, texts) {
        _.each(schema, function (field) {
          if (field.searchable === false) {
            return;
          }
          const fieldType = self.fieldTypes[field.type];
          if (!fieldType.index) {
            return;
          }
          fieldType.index(object[field.name], field, texts);
        });
      },

      // Convert submitted `data` object according to `schema`, sanitizing it
      // and populating the appropriate properties of `object` with it.
      //
      // Most field types may be converted as plaintext or in the format used for Apostrophe
      // schema forms, which in most cases is identical to that in which they will be stored
      // in the database. In Apostrophe 3.x, field converters automatically determine whether they
      // are being given plaintext or form data.
      //
      // If the submission cannot be converted due to an error that can't be
      // sanitized, this method throws an exception consisting of an array
      // of objects with `path` and `error` properties. `path` is the field name,
      // or a dot-separated path to the field name if the error was in a nested
      // `array` or `object` schema field, and `error` is the error code which
      // may  be a short string such as `required` or `min` that can be used to
      // set error class names, etc. If the error is not a string, it is a
      // database error etc. and should not be displayed in the browser directly.

      async convert(req, schema, data, object) {
        if (Array.isArray(req)) {
          throw new Error('convert invoked without a req, do you have one in your context?');
        }

        let errors = [];

        for (const field of schema) {
          if (field.readOnly) {
            continue;
          }
          // Fields that are contextual are left alone, not blanked out, if
          // they do not appear at all in the data object.
          if (field.contextual && !_.has(data, field.name)) {
            continue;
          }
          const convert = self.fieldTypes[field.type].convert;
          if (convert) {
            try {
              await convert(req, field, data, object);
            } catch (e) {
              if (Array.isArray(e)) {
                const invalid = self.apos.error('invalid', {
                  errors: e
                });
                invalid.path = field.name;
                errors.push(invalid);
              } else {
                if ((typeof e) !== 'string') {
                  self.apos.util.error(e + '\n\n' + e.stack);
                }
                e.path = field.name;
                errors.push(e);
              }
            }
          }
        }

        errors = errors.filter(error => {
          if ((error.name === 'required' || error.name === 'mandatory') && !self.isVisible(schema, object, error.path)) {
            // It is not reasonable to enforce required for
            // fields hidden via showFields
            return false;
          }
          return true;
        });
        if (errors.length) {
          throw errors;
        }
      },

      // Determine whether the given field is visible
      // based on showFields options of all fields

      isVisible(schema, object, name) {
        const hidden = {};
        _.each(schema, function (field) {
          if (!_.find(field.choices || [], function (choice) {
            return choice.showFields;
          })) {
            return;
          }
          _.each(field.choices, function (choice) {
            if (choice.showFields) {
              if (field.type === 'checkboxes') {
                if (!object[field.name].includes(choice.value)) {
                  _.each(choice.showFields, hide);
                }
              } else if (object[field.name] !== choice.value) {
                _.each(choice.showFields, hide);
              }
            }
          });
        });
        return !hidden[name];

        function hide(name) {
          hidden[name] = true;
          // Cope with nested showFields
          const field = _.find(schema, { name: name });
          _.each(field.choices || [], function (choice) {
            _.each(choice.showFields || [], function (name) {
              hide(name);
            });
          });
        }
      },

      // Driver invoked by the "relationship" methods of the standard
      // relationship field types.
      //
      // All arguments must be present, however fieldsStorage
      // may be undefined to indicate none is needed.
      async relationshipDriver(req, method, reverse, items, idsStorage, fieldsStorage, objectField, options) {
        if (!options) {
          options = {};
        }
        const find = options.find;
        const builders = options.builders || {};
        const hints = options.hints || {};
        const getCriteria = options.getCriteria || {};
        // Some joinr methods don't take fieldsStorage
        if (method.length === 4) {
          const realMethod = method;
          method = function (items, idsStorage, fieldsStorage, objectField, getter) {
            return realMethod(items, idsStorage, objectField, getter);
          };
        }
        await method(items, idsStorage, fieldsStorage, objectField, function (ids) {
          const idsCriteria = {};
          if (reverse) {
            idsCriteria[idsStorage] = { $in: ids };
          } else {
            idsCriteria._id = { $in: ids };
          }
          const criteria = {
            $and: [
              getCriteria,
              idsCriteria
            ]
          };
          const query = find(req, criteria);
          // Builders hardcoded as part of this relationship's options don't
          // require any sanitization
          query.applyBuilders(builders);
          // Hints, on the other hand, must be sanitized
          query.applyBuildersSafely(hints);
          return query.toArray();
        });
      },

      // Fetch all the relationships in the schema on the specified object or array
      // of objects. The withRelationships option may be omitted.
      //
      // If withRelationships is omitted, null or undefined, all the relationships in the schema
      // are performed, and also any relationships specified by the 'withRelationships' option of
      // each relationship field in the schema, if any. And that's where it stops. Infinite
      // recursion is not possible.
      //
      // If withRelationships is specified and set to "false", no relationships at all are performed.
      //
      // If withRelationships is set to an array of relationship names found in the schema, then
      // only those relationships are performed, ignoring any 'withRelationships' options found in
      // the schema.
      //
      // If a relationship name in the withRelationships array uses dot notation, like this:
      //
      // _events._locations
      //
      // Then the related events are fetched, and the locations related to those events are fetched,
      // assuming that _events is defined as a relationship in the
      // original schema and _locations is defined as a relationship in the schema for the events
      // module. Multiple "dot notation" relationships may share a prefix.
      //
      // Relationships are also supported in the schemas of array fields.

      async relate(req, schema, objectOrArray, withRelationships) {

        if (withRelationships === false) {
          // Relationships explicitly deactivated for this call
          return;
        }

        const objects = _.isArray(objectOrArray) ? objectOrArray : [ objectOrArray ];
        if (!objects.length) {
          // Don't waste effort
          return;
        }

        // build an array of relationships of interest, found at any level
        // in the schema, even those nested in array schemas. Add
        // an _arrays property to each one which contains the names
        // of the array fields leading to this relationship, if any, so
        // we know where to store the results. Also set a
        // _dotPath property which can be used to identify relevant
        // relationships when the withRelationships option is present

        let relationships = [];

        function findRelationships(schema, arrays) {
          const _relationships = _.filter(schema, function (field) {
            return !!self.fieldTypes[field.type].relate;
          });
          _.each(_relationships, function (relationship) {
            if (!arrays.length) {
              relationship._dotPath = relationship.name;
            } else {
              relationship._dotPath = arrays.join('.') + '.' + relationship.name;
            }
            // If we have more than one object we're not interested in relationships
            // with the ifOnlyOne restriction right now.
            if (objects.length > 1 && relationship.ifOnlyOne) {
              return;
            }
            relationship._arrays = _.clone(arrays);
          });
          relationships = relationships.concat(_relationships);
          _.each(schema, function (field) {
            if (field.type === 'array' || field.type === 'object') {
              findRelationships(field.schema, arrays.concat(field.name));
            }
          });
        }

        findRelationships(schema, []);

        // The withRelationships option allows restriction of relationships. Set to false
        // it blocks all relationships. Set to an array, it allows the relationships named within.
        // Dot notation can be used to specify relationships in array properties,
        // or relationships reached via other relationships.
        //
        // By default, all configured relationships will take place, but withRelationships: false
        // will be passed when fetching the objects on the other end of the relationship,
        // so that infinite recursion never takes place.

        const withRelationshipsNext = {};
        // Explicit withRelationships option passed to us
        if (Array.isArray(withRelationships)) {
          relationships = _.filter(relationships, function (relationship) {
            const dotPath = relationship._dotPath;
            let winner;
            _.each(withRelationships, function (withRelationshipName) {
              if (withRelationshipName === dotPath) {
                winner = true;
                return;
              }
              if (withRelationshipName.substr(0, dotPath.length + 1) === dotPath + '.') {
                if (!withRelationshipsNext[dotPath]) {
                  withRelationshipsNext[dotPath] = [];
                }
                withRelationshipsNext[dotPath].push(withRelationshipName.substr(dotPath.length + 1));
                winner = true;
              }
            });
            return winner;
          });
        } else {
          // No explicit withRelationships option for us, so we do all the relationships
          // we're configured to do, and pass on the withRelationships options we
          // have configured for those
          _.each(relationships, function (relationship) {
            if (relationship.withRelationships) {
              withRelationshipsNext[relationship._dotPath] = relationship.withRelationships;
            }
          });
        }

        for (const relationship of relationships) {
          const arrays = relationship._arrays;

          const _objects = findObjectsInArrays(objects, arrays);

          if (!relationship.name.match(/^_/)) {
            throw Error('Relationships should always be given names beginning with an underscore (_). Otherwise we would waste space in your database storing the results statically. There would also be a conflict with the array field withRelationships syntax. Relationship name is: ' + relationship._dotPath);
          }
          if (Array.isArray(relationship.withType)) {
            // Polymorphic join
            for (const type of relationship.withType) {
              const manager = self.apos.doc.getManager(type);
              if (!manager) {
                throw Error('I cannot find the instance type ' + type);
              }
              const find = manager.find;

              const options = {
                find: find,
                builders: { relationships: withRelationshipsNext[relationship._dotPath] || false },
                hints: {}
              };
              const subname = relationship.name + ':' + type;
              const _relationship = _.assign({}, relationship, {
                name: subname,
                withType: type
              });

              // Allow options to the get() method to be
              // specified in the relationship configuration
              if (_relationship.builders) {
                _.extend(options.builders, _relationship.builders);
              }
              if (_relationship.buildersByType && _relationship.buildersByType[type]) {
                _.extend(options.builders, _relationship.buildersByType[type]);
              }
              if (_relationship.hints) {
                _.extend(options.hints, _relationship.hints);
              }
              if (_relationship.hintsByType && _relationship.hintsByType[type]) {
                _.extend(options.hints, _relationship.hints);
                _.extend(options.hints, _relationship.hintsByType[type]);
              }
              // Allow options to the getter to be specified in the schema,
              // notably editable: true

              await self.fieldTypes[_relationship.type].relate(req, _relationship, _objects, options);
              _.each(_objects, function (object) {
                if (object[subname]) {
                  if (Array.isArray(object[subname])) {
                    object[relationship.name] = (object[relationship.name] || []).concat(object[subname]);
                  } else {
                    object[relationship.name] = object[subname];
                  }
                }
              });
            }
            if (relationship.idsStorage) {
              _.each(_objects, function (object) {
                if (object[relationship.name]) {
                  object[relationship.name] = self.apos.util.orderById(object[relationship.idsStorage], object[relationship.name]);
                }
              });
            }
          }

          const manager = self.apos.doc.getManager(relationship.withType);
          if (!manager) {
            throw Error('I cannot find the instance type ' + relationship.withType);
          }

          // If it has a getter, use it, otherwise supply one
          const find = manager.find;

          const options = {
            find: find,
            builders: { relationships: withRelationshipsNext[relationship._dotPath] || false },
            hints: {}
          };

          // Allow options to the get() method to be
          // specified in the relationship configuration
          if (relationship.builders) {
            _.extend(options.builders, relationship.builders);
          }
          if (relationship.hints) {
            _.extend(options.hints, relationship.hints);
          }

          // Allow options to the getter to be specified in the schema,
          // notably editable: true
          await self.fieldTypes[relationship.type].relate(req, relationship, _objects, options);
        }

        function findObjectsInArrays(objects, arrays) {
          if (!arrays) {
            return [];
          }
          if (!arrays.length) {
            return objects;
          }
          const array = arrays[0];
          let _objects = [];
          _.each(objects, function (object) {
            _objects = _objects.concat(object[array] || []);
          });
          return findObjectsInArrays(_objects, arrays.slice(1));
        }
      },

      // In the given document, for any relationships that are present in
      // the data (such as `_products`), update the underlying
      // idsStorage and fieldsStorage (if appropriate) so that
      // storage to the database can take place. This method is
      // always invoked for you by @apostrophecms/doc-type in a
      // beforeSave handler. This method also recursively invokes
      // itself as needed for relationships nested in widgets,
      // array fields and object fields.
      //
      // If the relationship field is present by name (such as `_products`)
      // in the document, that is taken as authoritative, and any
      // existing values in the `idsStorage` and `fieldsStorage`
      // are overwritten. If the relationship field is not present, the
      // existing values are left alone. This allows the developer
      // to safely update a document that was fetched with
      // `.relationships(false)`, provided a projection was not also used.
      //
      // Currently `req` does not impact this, but that may change.

      prepareRelationshipsForStorage(req, doc) {
        if (doc.metaType === 'doc') {
          const manager = self.apos.doc.getManager(doc.type);
          if (!manager) {
            return;
          }
          forSchema(manager.schema, doc);
        } else if (doc.metaType === 'widget') {
          const manager = self.apos.area.getWidgetManager(doc.type);
          if (!manager) {
            return;
          }
          forSchema(manager.schema, doc);
        }
        function forSchema(schema, doc) {
          for (const field of schema) {
            if (field.type === 'area') {
              if (doc[field.name] && doc[field.name].items) {
                for (const widget of doc[field.name].items) {
                  self.prepareRelationshipsForStorage(req, widget);
                }
              }
            } else if (field.type === 'array') {
              if (doc[field.name] && doc[field.name].items) {
                doc[field.name].items.map(item => forSchema(field.schema, item));
              }
            } else if (field.type === 'object') {
              if (doc[field.name]) {
                forSchema(field.schema, doc[field.name]);
              }
            } else if (field.type === 'relationship') {
              if (Array.isArray(doc[field.name])) {
                doc[field.idsStorage] = doc[field.name].map(relatedDoc => relatedDoc._id);
                if (field.fieldsStorage) {
                  const fieldsById = doc[field.fieldsStorage] || {};
                  for (const relatedDoc of doc[field.name]) {
                    if (relatedDoc._fields) {
                      fieldsById[relatedDoc._id] = relatedDoc._fields;
                    }
                  }
                  doc[field.fieldsStorage] = fieldsById;
                }
              }
            }
          }
        }
      },

      // Add a new field type. The `type` object may contain the following properties:
      //
      // ### `name`
      //
      // Required. The name of the field type, such as `select`. Use a unique prefix to avoid
      // collisions with future official Apostrophe field types.
      //
      // ### `convert`
      //
      // Required. An `async` function which takes `(req, field, data, object)`. The value
      // of the field is drawn from the untrusted input object `input` and sanitized
      // if possible, then copied to the appropriate property (or properties) of `object`.
      //
      // `field` contains the schema field definition, useful to access
      // `def`, `min`, `max`, etc.
      //
      // If the field cannot be sanitized an error can be thrown. To signal an error
      // that can be examined by browser code and used for UI, throw a string like
      // `required`. If the field is a composite field (`array` or `object`), throw
      // an array of objects with `path` and `error` properties. For other errors,
      // throw them directly and the browser will receive a generic error.
      //
      // ### `empty`
      //
      // Optional. A function which accepts `field, value` and returns
      // true only if the field should be considered empty, for purposes of
      // deciding if the entire object is empty or not.
      //
      // ### `index`
      //
      // Optional. A function which accepts `value, field, texts` and pushes
      // objects containing search engine-friendly text onto `texts`, if desired:
      //
      // ```javascript
      // index: function(value, field, texts) {
      //   const silent = (field.silent === undefined) ? true : field.silent;
      //   texts.push({ weight: field.weight || 15, text: (value || []).join(' '), silent: silent });
      // }
      // ```
      //
      // Note that areas are *always* indexed.

      addFieldType(type) {
        let fieldType = type;
        if (type.extend) {
          // Allow a field type to extend another field type and merge
          // in some differences.
          fieldType = _.cloneDeep(self.fieldTypes[type.extend]);
          _.merge(fieldType, type);
        }
        // For bc. csv was a bad name for the string converter, but
        // we need to accept it, and even keep the property around
        // for bc with those extending in sneaky ways
        if (fieldType.converters) {
          fieldType.converters.string = fieldType.converters.string || fieldType.converters.csv;
          fieldType.converters.csv = fieldType.converters.string;
          // Allow a field type to reuse another converter by specifying
          // its name. Allows 'form' to expressly reuse 'string'
          _.each(_.keys(fieldType.converters), function (key) {
            let value = fieldType.converters[key];
            if (typeof value === 'string') {
              if (value === 'csv') {
                // bc
                value = 'string';
              }
              fieldType.converters[key] = fieldType.converters[value];
            }
          });
        }
        // bc with the old method name `empty()`
        fieldType.isEmpty = fieldType.isEmpty || fieldType.empty;
        fieldType.empty = fieldType.isEmpty;
        self.fieldTypes[type.name] = fieldType;
      },

      getFieldType(typeName) {
        return self.fieldTypes[typeName];
      },

      // Given a schema and a query, add query builders to the query
      // for each of the fields in the schema, based on their field type,
      // if supported by the field type. If the field already has a
      // query builder (i.e. an explicit one was implemented by
      // @apostrophecms/doc-type or a subclass), do not replace it.

      addQueryBuilders(schema, query) {
        _.each(schema, function (field) {
          const fieldType = self.fieldTypes[field.type];
          if (query[field.name]) {
            return;
          }
          if (fieldType.addQueryBuilder) {
            fieldType.addQueryBuilder(field, query);
          }
        });
      },

      // You don't need to call this. It returns an async function that, when later called
      // with no arguments, will give you query builder choices based on the given field, query
      // and value field of interest. Relationship field types use this method to implement
      // their query builder `choices`.

      relationshipQueryBuilderChoices(field, query, valueField) {
        return async function () {
          const idsStorage = field.idsStorage;
          const ids = await query.toDistinct(idsStorage);
          const manager = self.apos.doc.getManager(field.withType);
          const relationshipQuery = manager.find(query.req, { _id: { $in: ids } }).project(manager.getAutocompleteProjection({ field: field }));
          if (field.builders) {
            relationshipQuery.applyBuilders(field.builders);
          }
          const docs = await relationshipQuery.toArray();
          _.each(docs, function (doc) {
            doc.label = doc.title;
            doc.value = doc[valueField];
            delete doc.title;
            delete doc[valueField];
          });
          self.apos.util.insensitiveSortByProperty(docs, 'label');
          return docs;
        };
      },

      // You don't need to call this. It is called for you as part of the mechanism that
      // adds query builders for all relationships.
      //
      // If you named your relationship properly (leading _), you also get a query builder
      // *without* the `_` that accepts slugs rather than ids - it's suitable
      // for public use in URLs (and it's good naming because the public would find the _ weird).
      //
      // If you're wondering, you should have had the leading _ anyway to keep it from
      // persisting the loaded data for the relationship back to your doc, which could easily blow
      // mongodb's doc size limit and in any case is out of data info in your database.
      //

      addRelationshipSlugQueryBuilder(field, query, suffix) {

        suffix = suffix || '';
        const name = field.name.replace(/^_/, '');

        if (name === field.name) {
          // Nope, your relationship is not well-named
          return;
        }
        if (query.builders[name + suffix]) {
          // Don't crush an existing builder by this name
          return;
        }

        query.addBuilder(name + suffix, {
          prefinalize: async function () {
            if (!self.queryBuilderInterested(query, name + suffix)) {
              return;
            }
            const value = query.get(name + suffix);
            if (value === 'none') {
              query.set(field.name + suffix, 'none');
              query.set(name + suffix, undefined);
              return;
            }
            const relationshipQuery = self.apos.doc.getManager(field.withType).find(query.req).relationships(false).areas(false);
            const criteria = {};
            // Even programmers appreciate shortcuts, so it's not enough that the
            // sanitizer (which doesn't apply to programmatic use) accepts these
            if (Array.isArray(value)) {
              criteria.slug = { $in: value };
            } else {
              criteria.slug = value;
            }
            relationshipQuery.and(criteria);
            relationshipQuery.project({ _id: 1 });
            const docs = await relationshipQuery.toArray();
            query.set(field.name + suffix, _.map(docs, '_id'));
            query.set(name + suffix, undefined);
          },
          choices: self.relationshipQueryBuilderChoices(field, query, 'slug'),
          launder: relationshipQueryBuilderSlugLaunder
        });

        function relationshipQueryBuilderSlugLaunder(v) {
          if (Array.isArray(v)) {
            return self.apos.launder.strings(v);
          } else if (typeof v === 'string' && v.length) {
            return [ self.apos.launder.string(v) ];
          } else if (v === 'none') {
            return 'none';
          }
          return undefined;
        }
      },

      // Fetch the distinct values for the specified property via the specified
      // query and sort them before returning them.
      //
      // Like `toDistinct`, but sorted. A convenience used by the standard query builders
      // for many field types.

      async sortedDistinct(property, query) {
        const results = await query.toDistinct(property);
        self.apos.util.insensitiveSort(results);
        return results;
      },

      // For most query builders, if the value is undefined or null,
      // the query builder should do nothing. This method implements that test.

      queryBuilderInterested(query, name) {
        const value = query.get(name);
        return value !== undefined && value !== null;
      },

      // Validate a schema for errors. This is about validating the schema itself,
      // not a data object. For instance, a field without a type property is flagged.
      // Serious errors throw an exception, while certain lesser errors just print a message
      // to stderr for bc.
      //
      // This method may also prevent errors by automatically supplying
      // reasonable values for certain properties, such as the `idsStorage` property
      // of a `relationship` field, or the `label` property of anything.

      validate(schema, options) {
        // Infinite recursion prevention
        if (self.validatedSchemas[options.type + ':' + options.subtype]) {
          return;
        }
        self.validatedSchemas[options.type + ':' + options.subtype] = true;

        _.each(schema, function (field) {
          const fieldType = self.fieldTypes[field.type];
          if (!fieldType) {
            fail('Unknown schema field type.');
          }
          if (!field.name) {
            fail('name property is missing.');
          }
          if (!field.label && !field.contextual) {
            field.label = _.startCase(field.name.replace(/^_/, ''));
          }
          if (fieldType.validate) {
            fieldType.validate(field, options, warn, fail);
          }
          function fail(s) {
            throw new Error(format(s));
          }
          function warn(s) {
            self.apos.util.error(format(s));
          }
          function format(s) {
            return '\n' + options.type + ' ' + options.subtype + ', field name ' + field.name + ':\n\n' + s + '\n';
          }
        });
      },
      // Recursively register the given schema, giving each field an _id and making provision to be able to
      // fetch its definition via apos.schema.getFieldById().
      register(schema) {
        for (const field of schema) {
          // _id needs to be consistent across processes
          field._id = self.apos.util.md5(JSON.stringify(_.omit(field, '_id', 'group')));
          if (field.def === undefined) {
            // Pull fallback default into field definition to save
            // code and so that it is available on the browser side
            field.def = self.fieldTypes[field.type].def;
          }
          self.fieldsById[field._id] = field;
          const type = self.fieldTypes[field.type];
          if (type.register) {
            type.register(field);
          }
        }
      },
      // Fetch a schema field definition by its _id. The _id comes into being at afterInit time and is used
      // later to determine the options for widgets nested in areas when rendering a newly added widget in
      // the context of a modal.
      getFieldById(_id) {
        return self.fieldsById[_id];
      },

      // Implementation detail, called for you by the PATCH routes.
      // Alters `patch` into input suitable for a `convert` call
      // to update `existingPage`. Does so by copying content from `existingPage`
      // based on the operators and dot notation references
      // initially present in `patch`. When this operation is complete
      // every top level object impacted by the patch will be present
      // in `patch`. Implements `$push`, $pullAll` and `$pullAllById`
      // in addition to dot notation support and support for the use of
      // `@_id` syntax in the first component of a path. `$push` includes
      // support for `$each`, `$position`, and the apostrophe-specific
      // `$before` and `$after` which take the `_id` of an existing object
      // in the array to insert before or after, as an alternative to
      // `$position`. Like MongoDB, Apostrophe requires `$each` when
      // using `$position`, `$before` or `$after`. For durability,
      // if `$position`, `$before` or `$after` has an invalid value
      // the insertion takes place at the end of the existing array.

      implementPatchOperators(patch, existingPage) {
        const clonedBases = {};
        if (patch.$push) {
          append(patch.$push);
        } else if (patch.$pullAll) {
          _.each(patch.$pullAll, function(val, key) {
            cloneOriginalBase(key);
            self.apos.util.set(patch, key, _.differenceWith(self.apos.util.get(patch, key) || [], Array.isArray(val) ? val : [], function(a, b) {
              return _.isEqual(a, b);
            }));
          });
        } else if (patch.$pullAllById) {
          _.each(patch.$pullAllById, function(val, key) {
            cloneOriginalBase(key);
            if (!Array.isArray(val)) {
              val = [ val ];
            }
            self.apos.util.set(patch, key, _.differenceWith(self.apos.util.get(patch, key) || [], Array.isArray(val) ? val : [], function(a, b) {
              return a._id === b;
            }));
          });
        } else if (patch.$move) {
          _.each(patch.$move, function(val, key) {
            cloneOriginalBase(key);
            if ((val == null) || (!((typeof val) === 'object'))) {
              return;
            }
            const existing = self.apos.util.get(patch, key) || [];
            const index = existing.findIndex(item => item._id === val.$item);
            if (index === -1) {
              return;
            }
            const itemValue = existing[index];
            existing.splice(index, 1);
            if (val.$before) {
              const beforeIndex = existing.findIndex(item => item._id === val.$before);
              if (beforeIndex !== -1) {
                existing.splice(beforeIndex, 0, itemValue);
              } else {
                existing.splice(index, 0, itemValue);
              }
            } else if (val.$after) {
              const afterIndex = existing.findIndex(item => item._id === val.$after);
              if (afterIndex !== -1) {
                existing.splice(afterIndex + 1, 0, itemValue);
              } else {
                existing.splice(index, 0, itemValue);
              }
            } else {
              existing.splice(index, 0, itemValue);
            }
          });
        }
        _.each(patch, function(val, key) {
          if (key.charAt(0) !== '$') {
            key = self.apos.util.resolveAtReference(existingPage, key);
            // Simple replacement with a dot path
            if (key.indexOf('.') !== -1) {
              cloneOriginalBase(key);
              self.apos.util.set(patch, key, val);
            }
          }
        });
        function append(data) {
          _.each(data, function(val, key) {
            cloneOriginalBase(key);
            if (val && val.$each) {
              const each = Array.isArray(val.$each) ? val.$each : [];
              const existing = self.apos.util.get(patch, key) || [];
              if (!Array.isArray(existing)) {
                throw self.apos.error('invalid', 'existing property is not an array', {
                  dotPath: key
                });
              }
              let position;
              if (_.has(val, '$position')) {
                position = self.apos.launder.integer(val.$position);
                if ((position < 0) || (position > existing.length)) {
                  position = existing.length;
                }
              } else if (_.has(val, '$before')) {
                position = _.findIndex(existing, item => item._id === val.$before);
                if (position === -1) {
                  position = existing.length;
                }
              } else if (_.has(val, '$after')) {
                position = _.findIndex(existing, item => item._id === val.$after);
                if (position === -1) {
                  position = existing.length;
                } else {
                  // after
                  position++;
                }
              } else {
                position = existing.length;
              }
              const updated = existing.slice(0, position).concat(each).concat(existing.slice(position));
              self.apos.util.set(patch, key, updated);
            } else {
              const existing = self.apos.util.get(patch, key) || [];
              existing.push(val);
              self.apos.util.set(patch, key, existing);
            }
          });
        }
        function cloneOriginalBase(key) {
          if (key.charAt(0) === '@') {
            let _id = key.substring(1);
            const dot = _id.indexOf('.');
            if (dot !== -1) {
              _id = _id.substring(0, dot);
            }
            const result = self.apos.util.findNestedObjectAndDotPathById(existingPage, _id);
            if (!result) {
              throw self.apos.error('invalid', {
                '@path': key
              });
            }
            key = result.dotPath;
          }
          if (key.indexOf('.') === -1) {
            // No need, we are replacing the base
          }
          const base = key.split('.')[0];
          if (!clonedBases[base]) {
            if (_.has(existingPage, base)) {
              // We need all the properties, even impermanent ones,
              // because relationships are read-write in 3.x
              patch[base] = klona(existingPage[base]);
            }
            clonedBases[base] = true;
          }
        }
      },

      // Given a `patch` containing mongo-style patch operators like `$push`, return a subset
      // of `schema` containing the root fields that would ultimately be updated by
      // those operations.
      subsetSchemaForPatch(schema, patch) {
        const idsStorageFields = {};
        schema.forEach(function(field) {
          if (field.type === 'relationship') {
            idsStorageFields[field.idsStorage] = field.name;
          }
        });
        return self.apos.schema.subset(schema, _.map(_.keys(patch).concat(operatorKeys()), idsStorageFieldToSchemaField));
        function operatorKeys() {
          return _.uniq(_.flatten(
            _.map([ '$push', '$pullAll', '$pullAllById' ], function(o) {
              return _.map(_.keys(patch[o] || {}), function(key) {
                return key.toString().split(/\./)[0];
              });
            })
          ));
        }
        function idsStorageFieldToSchemaField(name) {
          return idsStorageFields[name] || name;
        }
      },
      groupsToArray(groups) {
        return Object.keys(groups).map(name => ({
          name,
          ...groups[name]
        }));
      },
      fieldsToArray(context, fields) {
        const result = [];
        for (const name of Object.keys(fields)) {
          const field = {
            name,
            ...fields[name]
          };
          // TODO same for relationship schemas but they are being refactored in another PR
          if ((field.type === 'object') || (field.type === 'array') || (field.type === 'relationship')) {
            if (field.type !== 'relationship') {
              if (!field.fields) {
                throw new Error(`${context}: the subfield ${name} requires a 'fields' property, with an 'add' subproperty containing its own fields.`);
              }
            }
            if (field.fields) {
              if (!field.fields.add) {
                if (Object.keys(field.fields).length) {
                  throw new Error(`${context}: the subfield ${name} has a 'fields' property with no 'add' subproperty. You probably forgot to nest its fields in 'add.'`);
                } else {
                  throw new Error(`${context}: the subfield ${name} must have a 'fields' property with an 'add' subproperty containing its own fields.`);
                }
              }
              field.schema = self.fieldsToArray(context, field.fields.add || {});
            }
          }
          result.push(field);
        }
        return result;
      }
    };
  },
  extendMethods(self, options) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        const fields = {};
        for (const name in self.fieldTypes) {
          let component = self.fieldTypes[name].vueComponent;
          // If explicitly false, it intentionally has no UI at all
          if (component !== false) {
            // Otherwise fall back to the standard naming pattern if not otherwise specified
            component = component || 'AposInput' + self.apos.util.capitalizeFirst(name);
          }
          fields[name] = component;
        }

        browserOptions.components = { fields: fields };
        return browserOptions;
      }
    };
  },
  helpers(self, options) {
    return {
      toGroups: function (fields) {
        return self.toGroups(fields);
      },
      field: function (field, readOnly) {
        if (readOnly) {
          field.readOnly = true;
        }
        // Allow custom partials for types and for individual fields
        const partial = field.partial || self.fieldTypes[field.type].partial;
        if (!partial) {
          // Look for a standard partial template in the views folder
          // of this module
          return self.partialer(field.type)(field);
        }
        return partial(field);
      }
    };
  }
};
