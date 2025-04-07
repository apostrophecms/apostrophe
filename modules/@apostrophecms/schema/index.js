// This module provides schemas, a flexible and fast way to create new data types
// by specifying the fields that should make them up. Schemas power
// [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html),
// [@apostrophecms/widget-type](../@apostrophecms/widget-type/index.html), custom field
// types in page settings for
// [@apostrophecms/page-type](../@apostrophecms/page-type/index.html) and more.
//
// A schema is simply an array of "plain old objects."
// Each object describes one field in the schema via `type`, `name`, `label`
// and other properties.
//
// See the [schema guide](../../tutorials/getting-started/schema-guide.html)
// for a complete overview and list of schema field types. The methods documented
// here on this page are most often used when you choose to work independently with
// schemas, such as in a custom project that requires forms.

const _ = require('lodash');
const { klona } = require('klona');
const { stripIndents } = require('common-tags');
const addFieldTypes = require('./lib/addFieldTypes');
const newInstance = require('./lib/newInstance.js');

module.exports = {
  options: {
    alias: 'schema'
  },
  init(self) {
    self.fieldTypes = {};
    self.fieldsById = {};
    self.arrayManagers = {};
    self.objectManagers = {};
    self.fieldMetadataComponents = [];
    self.uiManagerIndicators = [];

    self.enableBrowserData();

    addFieldTypes(self);

    self.validatedSchemas = {};
  },

  methods(self) {
    const defaultGroup = self.options.defaultGroup || {
      name: 'ungrouped',
      label: 'apostrophe:ungrouped'
    };

    return {
      // Compose a schema based on addFields, removeFields, orderFields
      // and, occasionally, alterFields options. This method is great for
      // merging the schema requirements of subclasses with the schema
      // requirements of a superclass. See the @apostrophecms/schema documentation
      // for a thorough explanation of the use of each option. The
      // alterFields option should be avoided if your needs can be met
      // via another option.

      compose(options, module) {
        let schema = [];

        // Useful for finding good unit test cases
        /* self.apos.util.log( */
        /*   JSON.stringify( */
        /*     _.pick(options, 'addFields', 'removeFields', 'arrangeFields'), */
        /*     null, */
        /*     '  ' */
        /*   ) */
        /* ); */

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

        const groups = self.composeGroups(schema, options.arrangeFields);

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

        // Shallowly clone the fields. This allows modules
        // like workflow to patch schema fields of various modules
        // without inadvertently impacting other apos instances
        // when running with @apostrophecms/multisite
        schema = _.map(schema, function (field) {
          return _.clone(field);
        });

        _.each(schema, function(field) {
          // For use in resolving options like "choices" when they
          // contain a method name. For bc don't mess with possible
          // existing usages in custom schema field types predating
          // this feature
          self.setModuleName(field, module);
        });
        return schema;
      },

      composeGroups (schema, arrangeFields) {
        // always make sure there is a default group
        let groups = [ {
          name: defaultGroup.name,
          label: defaultGroup.label,
          fields: _.map(schema, 'name')
        } ];

        // if we are getting arrangeFields and it's not empty
        if (arrangeFields && arrangeFields.length > 0) {
          // if it's full of strings, use them for the default group
          if (_.isString(arrangeFields[0])) {
            // if it's full of objects, those are groups, so use them
            groups[0].fields = arrangeFields;
          } else if (_.isPlainObject(arrangeFields[0])) {
            // reset the default group's fields, but keep it around,
            // in case they have fields they forgot to put in a group
            groups[0].fields = [];
            groups = groups.concat(arrangeFields);
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

        return newGroups;
      },

      // Recursively set moduleName property of the field and any subfields,
      // as might be found in array or object fields. `module` is an actual module
      setModuleName(field, module) {
        field.moduleName = field.moduleName || (module && module.__meta.name);
        if ((field.type === 'array') || (field.type === 'object')) {
          _.each(field.schema || [], function(subfield) {
            self.setModuleName(subfield, module);
          });
        }
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
        return newInstance(schema);
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

      // Wrapper around isEqual method to get modified fields between two documents
      // instead of just getting a boolean, it will return an array of the modified fields

      getChanges(req, schema, one, two) {
        return self.isEqual(req, schema, one, two, { getChanges: true });
      },

      // Compare two objects and return true only if their schema fields are equal.
      //
      // Note that for relationship fields this comparison is based on the idsStorage
      // and fieldsStorage, which are updated at the time a document is saved to the
      // database, so it will not work on a document not yet inserted or updated
      // unless `prepareForStorage` is used.
      //
      // This method is invoked by the doc module to compare draft and published
      // documents and set the modified property of the draft, just before updating the
      // published version.
      //
      // When passing the option `getChange: true` it'll return an array of changed fields
      // in this case the method won't short circuit by directly returning false
      // when finding a changed field

      isEqual(req, schema, one, two, options = {}) {
        const changedFields = [];
        for (const field of schema) {
          const fieldType = self.fieldTypes[field.type];

          if (fieldType.isEqual) {
            if (!fieldType.isEqual(req, field, one, two)) {
              if (options.getChanges) {
                changedFields.push(field.name);
              } else {
                return false;
              }
            }
            continue;
          }

          if (
            !_.isEqual(one[field.name], two[field.name]) &&
            !((one[field.name] == null) && (two[field.name] == null))
          ) {
            if (options.getChanges) {
              changedFields.push(field.name);
            } else {
              return false;
            }
          }
        }

        return options.getChanges ? changedFields : true;
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

      async evaluateCondition(req, field, clause, destination, conditionalFields) {
        for (const [ key, val ] of Object.entries(clause)) {
          const destinationKey = _.get(destination, key);

          if (key === '$or') {
            const results = await Promise.all(
              val.map(clause => self.evaluateCondition(
                req,
                field,
                clause,
                destination,
                conditionalFields)
              )
            );
            const testResults = _.isPlainObject(results?.[0])
              ? results.some(({ value }) => value)
              : results.some((value) => value);
            if (!testResults) {
              return false;
            }
            continue;
          } else if (val.$ne) {
            if (val.$ne === destinationKey) {
              return false;
            }
            continue;
          }

          // Handle external conditions:
          //  - `if: { 'methodName()': true }`
          //  - `if: { 'moduleName:methodName()': 'expected value' }`
          // Checking if key ends with a closing parenthesis here to throw
          // later if any argument is passed.
          if (key.endsWith(')')) {
            let externalConditionResult;

            try {
              externalConditionResult = await self.evaluateMethod(
                req,
                key,
                field.name,
                field.moduleName,
                destination._id
              );
            } catch (error) {
              throw self.apos.error('invalid', error.message);
            }

            if (externalConditionResult !== val) {
              return false;
            };

            // Stop there, this is an external condition thus
            // does not need to be checked against doc fields.
            continue;
          }

          // test with Object.prototype for the case val.min === 0
          if (Object.hasOwn(val, 'min') || Object.hasOwn(val, 'max')) {
            if (destinationKey < val.min) {
              return false;
            }
            if (destinationKey > val.max) {
              return false;
            }
            continue;
          }

          if (conditionalFields?.[key] === false) {
            return false;
          }

          if (destinationKey !== val) {
            return false;
          }
        }

        return true;
      },

      async isFieldRequired(req, field, destination) {
        return field.requiredIf
          ? await self.evaluateCondition(req, field, field.requiredIf, destination)
          : field.required;
      },

      // Convert submitted `data` object according to `schema`, sanitizing it
      // and populating the appropriate properties of `destination` with it.
      //
      // Most field types may be converted as plaintext or in the
      // format used for Apostrophe schema forms, which in most cases
      // is identical to that in which they will be stored in the database.
      // In Apostrophe 3.x, field converters automatically determine whether they
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
      //
      // ancestors consists of an array of objects where each represents
      // the context object at each level of nested sanitization, excluding
      // `destination` (the current level). This allows resolution of relative
      // `following` paths during sanitization.

      async convert(
        req,
        schema,
        data,
        destination,
        {
          fetchRelationships = true,
          ancestors = [],
          rootConvert = true
        } = {}
      ) {
        const options = {
          fetchRelationships,
          ancestors
        };
        if (Array.isArray(req)) {
          throw new Error('convert invoked without a req, do you have one in your context?');
        }

        const convertErrors = [];
        for (const field of schema) {
          if (field.readOnly) {
            continue;
          }

          // Fields that are contextual are left alone, not blanked out, if
          // they do not appear at all in the data object.
          if (field.contextual && !_.has(data, field.name)) {
            continue;
          }

          const { convert } = self.fieldTypes[field.type];
          if (!convert) {
            continue;
          }

          try {
            const isRequired = await self.isFieldRequired(req, field, destination);
            await convert(
              req,
              {
                ...field,
                required: isRequired
              },
              data,
              destination,
              {
                ...options,
                rootConvert: false
              }
            );
          } catch (err) {
            const error = Array.isArray(err)
              ? self.apos.error('invalid', { errors: err })
              : err;

            error.path = field.name;
            error.schemaPath = field.aposPath;
            convertErrors.push(error);
          }
        }

        if (!rootConvert) {
          if (convertErrors.length) {
            throw convertErrors;
          }

          return;
        }

        const nonVisibleFields = await self.getNonVisibleFields({
          req,
          schema,
          destination
        });

        const validErrors = await self.handleConvertErrors({
          req,
          schema,
          convertErrors,
          destination,
          nonVisibleFields
        });

        if (validErrors.length) {
          throw validErrors;
        }
      },

      async getNonVisibleFields({
        req, schema, destination, nonVisibleFields = new Set(), fieldPath = ''
      }) {
        for (const field of schema) {
          const curPath = fieldPath ? `${fieldPath}.${field.name}` : field.name;
          const isVisible = await self.isVisible(req, schema, destination, field.name);
          if (!isVisible) {
            nonVisibleFields.add(curPath);
            continue;
          }
          if (!field.schema) {
            continue;
          }

          // Relationship does not support conditional fields right now
          if ([ 'array' /*, 'relationship' */].includes(field.type) && field.schema) {
            for (const arrayItem of destination[field.name] || []) {
              await self.getNonVisibleFields({
                req,
                schema: field.schema,
                destination: arrayItem,
                nonVisibleFields,
                fieldPath: `${curPath}.${arrayItem._id}`
              });
            }
          } else if (field.type === 'object') {
            await self.getNonVisibleFields({
              req,
              schema: field.schema,
              destination: destination[field.name],
              nonVisibleFields,
              fieldPath: curPath
            });
          }
        }

        return nonVisibleFields;
      },

      async handleConvertErrors({
        req,
        schema,
        convertErrors,
        nonVisibleFields,
        destination,
        destinationPath = '',
        hiddenAncestors = false
      }) {
        const validErrors = [];
        for (const error of convertErrors) {
          const [ destId, destPath ] = error.path.includes('.')
            ? error.path.split('.')
            : [ null, error.path ];

          const curDestination = destId
            ? destination.find(({ _id }) => _id === destId)
            : destination;

          const errorPath = destinationPath
            ? `${destinationPath}.${error.path}`
            : error.path;

          // Case were this error field hasn't been treated
          // Should check if path starts with, because parent can be invisible
          const nonVisibleField = hiddenAncestors || nonVisibleFields.has(errorPath);

          // We set default values only on final error fields
          if (nonVisibleField && !error.data?.errors) {
            const curSchema = self.getFieldLevelSchema(schema, error.schemaPath);
            self.setDefaultToInvisibleField(curDestination, curSchema, error.path);
            continue;
          }

          if (error.data?.errors) {
            const subErrors = await self.handleConvertErrors({
              req,
              schema,
              convertErrors: error.data.errors,
              nonVisibleFields,
              destination: curDestination[destPath],
              destinationPath: errorPath,
              hiddenAncestors: nonVisibleField
            });

            // If invalid error has no sub error, this one can be removed
            if (!subErrors.length) {
              continue;
            }

            error.data.errors = subErrors;
          }
          validErrors.push(error);
        }

        return validErrors;
      },

      setDefaultToInvisibleField(destination, schema, fieldPath) {
        // Field path might contain the ID of the object in which it is contained
        // We just want the field name here
        const [ _id, fieldName ] = fieldPath.includes('.')
          ? fieldPath.split('.')
          : [ null, fieldPath ];
        // It is not reasonable to enforce required,
        // min, max or anything else for fields
        // hidden via "if" as the user cannot correct it
        // and it will not be used. If the user changes
        // the conditional field later then they won't
        // be able to save until the erroneous field
        // is corrected
        const field = schema.find(field => field.name === fieldName);
        if (field) {
          // To protect against security issues, an invalid value
          // for a field that is not visible should be quietly discarded.
          // We only worry about this if the value is not valid, as otherwise
          // it's a kindness to save the work so the user can toggle back to it
          destination[field.name] = klona((field.def !== undefined)
            ? field.def
            : self.fieldTypes[field.type]?.def);
        }
      },

      getFieldLevelSchema(schema, fieldPath) {
        if (!fieldPath || fieldPath === '/') {
          return schema;
        }
        let curSchema = schema;
        const parts = fieldPath.split('/');
        parts.pop();
        for (const part of parts) {
          const curField = curSchema.find(({ name }) => name === part);
          curSchema = curField.schema;
        }

        return curSchema;
      },

      // Determine whether the given field is visible
      // based on `if` conditions of all fields
      async isVisible(req, schema, destination, name) {
        const conditionalFields = {};
        const errors = {};

        while (true) {
          let change = false;
          for (const field of schema) {
            if (field.if) {
              try {
                const result = await self.evaluateCondition(
                  req,
                  field,
                  field.if,
                  destination,
                  conditionalFields
                );
                const previous = conditionalFields[field.name];
                if (previous !== result) {
                  change = true;
                }
                conditionalFields[field.name] = result;
              } catch (error) {
                errors[field.name] = error;
              }
            }
          }

          // send the error related to the given field via the `name` param
          if (errors[name]) {
            throw errors[name];
          }

          if (!change) {
            break;
          }
        }
        if (_.has(conditionalFields, name)) {
          return conditionalFields[name];
        } else {
          return true;
        }
      },

      async evaluateMethod(
        req,
        methodKey,
        fieldName,
        fieldModuleName,
        docId = null,
        optionalParenthesis = false,
        following = {}
      ) {
        const [ methodDefinition, rest ] = methodKey.split('(');
        const hasParenthesis = rest !== undefined;

        if (!hasParenthesis && !optionalParenthesis) {
          throw new Error(`The method "${methodDefinition}" defined in the "${fieldName}" field should be written with parenthesis: "${methodDefinition}()".`);
        }
        if (hasParenthesis && !methodKey.endsWith('()')) {
          self.apos.util.warn(`The method "${methodDefinition}" defined in the "${fieldName}" field should be written without argument: "${methodDefinition}()".`);
          methodKey = methodDefinition + '()';
        }

        const [ methodName, moduleName = fieldModuleName ] = methodDefinition
          .split(':')
          .reverse();

        const module = self.apos.modules[moduleName];

        if (!module) {
          throw new Error(`The "${moduleName}" module defined in the "${fieldName}" field does not exist.`);
        } else if (!module[methodName]) {
          throw new Error(`The "${methodName}" method from "${moduleName}" module defined in the "${fieldName}" field does not exist.`);
        }

        return module[methodName](req, { docId }, following);
      },

      // Driver invoked by the "relationship" methods of the standard
      // relationship field types.
      //
      // All arguments must be present, however fieldsStorage
      // may be undefined to indicate none is needed.
      async relationshipDriver(
        req,
        method,
        reverse,
        items,
        idsStorage,
        fieldsStorage,
        objectField,
        options
      ) {
        if (!options) {
          options = {};
        }
        const find = options.find;
        const builders = options.builders || {};
        const getCriteria = options.getCriteria || {};
        await method(items, idsStorage, fieldsStorage, objectField, ids => {
          const idsCriteria = {};
          if (reverse) {
            idsCriteria[idsStorage] = { $in: ids };
          } else {
            idsCriteria.aposDocId = { $in: ids };
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
          return query.toArray();
        }, self.apos.doc.toAposDocId);
      },

      // Fetch all the relationships in the schema on the specified object or array
      // of objects. The withRelationships option may be omitted.
      //
      // If withRelationships is omitted, null or undefined, all the relationships
      // in the schema are performed, and also any relationships specified by the
      // 'withRelationships' option of each relationship field in the schema, if any.
      // And that's where it stops. Infinite recursion is not possible.
      //
      // If withRelationships is specified and set to "false",
      // no relationships at all are performed.
      //
      // If withRelationships is set to an array of relationship names found
      // in the schema, then only those relationships are performed, ignoring any
      // 'withRelationships' options found in the schema.
      //
      // If a relationship name in the withRelationships array uses dot notation,
      // like this:
      //
      // _events._locations
      //
      // Then the related events are fetched, and the locations related to
      // those events are fetched, assuming that _events is defined as a relationship
      // in the original schema and _locations is defined as a relationship in the
      // schema for the events module. Multiple "dot notation" relationships
      // may share a prefix.
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
          // Shallow clone of each relationship to allow
          // for independent _dotPath and _arrays properties
          // for different requests
          const _relationships = _.filter(schema, function (field) {
            return !!self.fieldTypes[field.type].relate;
          }).map(relationship => ({ ...relationship }));
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
        // it blocks all relationships. Set to an array, it allows the relationships
        // named within. Dot notation can be used to specify relationships
        // in array properties, or relationships reached via other relationships.
        //
        // By default, all configured relationships will take place, but
        // withRelationships: false
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
                withRelationshipsNext[dotPath].push(
                  withRelationshipName.substr(dotPath.length + 1)
                );
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
              withRelationshipsNext[relationship._dotPath] = relationship
                .withRelationships;
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

              const relationships = withRelationshipsNext[relationship._dotPath] || false;
              const options = {
                find,
                builders: { relationships }
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
              await self.apos.util.recursionGuard(req, `${_relationship.type}:${_relationship.withType}`, () => {
                // Allow options to the getter to be specified in the schema,
                return self.fieldTypes[_relationship.type]
                  .relate(req, _relationship, _objects, options);
              });
              _.each(_objects, function (object) {
                if (object[subname]) {
                  if (Array.isArray(object[subname])) {
                    object[relationship.name] = (object[relationship.name] || [])
                      .concat(object[subname]);
                  } else {
                    object[relationship.name] = object[subname];
                  }
                }
              });
            }
            if (relationship.idsStorage) {
              _.each(_objects, function (object) {
                if (object[relationship.name]) {
                  const locale = `${req.locale}:${req.mode}`;
                  object[relationship.name] = self.apos.util.orderById(
                    object[relationship.idsStorage].map(id => `${id}:${locale}`),
                    object[relationship.name]
                  );
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

          const relationships = withRelationshipsNext[relationship._dotPath] || false;
          const options = {
            find,
            builders: { relationships }
          };

          // Allow options to the get() method to be
          // specified in the relationship configuration
          if (relationship.builders) {
            _.extend(options.builders, relationship.builders);
          }

          // If there is a projection for a reverse relationship, make sure it includes
          // the idsStorage and fieldsStorage for the relationship, otherwise no related
          // documents will be returned. Make sure the projection is positive,
          // not negative, before attempting to add more positive assertions to it
          if ((relationship.type === 'relationshipReverse') && options.builders.project && Object.values(options.builders.project).some(v => !!v)) {
            if (relationship.idsStorage) {
              options.builders.project[relationship.idsStorage] = 1;
            }
            if (relationship.fieldsStorage) {
              options.builders.project[relationship.fieldsStorage] = 1;
            }
          }

          // Allow options to the getter to be specified in the schema
          await self.apos.util.recursionGuard(req, `${relationship.type}:${relationship.withType}`, () => {
            return self.fieldTypes[relationship.type]
              .relate(req, relationship, _objects, options);
          });
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

      // In the given document or widget, update any underlying
      // storage needs required for relationships, arrays, etc.,
      // such as populating the idsStorage and fieldsStorage
      // properties of relationship fields, or setting the
      // arrayName property of array items. This method is
      // always invoked for you by @apostrophecms/doc-type in a
      // beforeSave handler. This method also recursively invokes
      // itself as needed for relationships nested in widgets,
      // array fields and object fields.
      //
      // If a relationship field is present by name (such as `_products`)
      // in the document, that is taken as authoritative, and any
      // existing values in the `idsStorage` and `fieldsStorage`
      // are overwritten. If the relationship field is not present, the
      // existing values are left alone. This allows the developer
      // to safely update a document that was fetched with
      // `.relationships(false)`, provided the projection included
      // the ids.
      //
      // Currently `req` does not impact this, but that may change.

      prepareForStorage(req, doc, options = {}) {
        const can = (field) => {
          const canEdit = () => self.apos.permission.can(
            req,
            field.editPermission.action,
            field.editPermission.type
          );
          const canView = () => self.apos.permission.can(
            req,
            field.viewPermission.action,
            field.viewPermission.type
          );
          return options.permissions === false ||
            (!field.withType && !field.editPermission && !field.viewPermission) ||
            (field.withType && self.apos.permission.can(req, 'view', field.withType)) ||
            (field.editPermission && canEdit()) ||
            (field.viewPermission && canView()) ||
            false;
        };

        const handlers = {
          arrayItem: (field, object) => {
            if (!object || !can(field)) {
              return;
            }

            object._id = object._id || self.apos.util.generateId();
            object.metaType = 'arrayItem';
            object.scopedArrayName = field.scopedArrayName;
          },
          object: (field, object) => {
            if (!object || !can(field)) {
              return;
            }

            object.metaType = 'object';
            object.scopedObjectName = field.scopedObjectName;
          },
          relationship: (field, doc) => {
            if (!Array.isArray(doc[field.name]) || !can(field)) {
              return;
            }

            doc[field.idsStorage] = doc[field.name]
              .map(relatedDoc => self.apos.doc.toAposDocId(relatedDoc));
            if (field.fieldsStorage) {
              const fieldsById = doc[field.fieldsStorage] || {};
              for (const relatedDoc of doc[field.name]) {
                if (relatedDoc._fields) {
                  fieldsById[self.apos.doc.toAposDocId(relatedDoc)] = relatedDoc._fields;
                }
              }
              doc[field.fieldsStorage] = fieldsById;
            }
          }
        };

        self.apos.doc.walkByMetaType(doc, handlers);
      },

      simulateRelationshipsFromStorage(req, doc) {
        const handlers = {
          relationship: (field, object) => {
            const manager = self.apos.doc.getManager(field.withType);
            const setId = (id) => manager.options.localized !== false
              ? `${id}:${doc.aposLocale}`
              : id;

            const itemIds = object[field.idsStorage] || [];
            object[field.name] = itemIds.map(id => ({
              _id: setId(id),
              _fields: object[field.fieldsStorage]?.[id] || {}
            }));
          }
        };

        self.apos.doc.walkByMetaType(doc, handlers);
      },

      // Add a new field type. The `type` object may contain the following properties:
      //
      // ### `name`
      //
      // Required. The name of the field type, such as `select`. Use a unique prefix
      // to avoid collisions with future official Apostrophe field types.
      //
      // ### `convert`
      //
      // Required. An `async` function which takes `(req, field, data, destination)`.
      // The value of the field is drawn from the untrusted input object `data` and
      // sanitized if possible, then copied to the appropriate
      // property (or properties) of `destination`.
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
      //   texts.push({
      //    weight: field.weight || 15,
      //    text: (value || []).join(' '),
      //    silent: silent
      //  });
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
          fieldType.converters.string = fieldType.converters.string ||
            fieldType.converters.csv;
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

      addFieldMetadataComponent(namespace, component) {
        self.fieldMetadataComponents.push({
          name: component,
          namespace
        });
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
      // with no arguments, will give you query builder choices based on the given field,
      // query and value field of interest. Relationship field types use this method to
      // implement their query builder `choices`.

      relationshipQueryBuilderChoices(field, query, valueField) {
        return async function () {
          const idsStorage = field.idsStorage;
          const ids = await query.toDistinct(idsStorage);
          const manager = self.apos.doc.getManager(field.withType);
          const relationshipQuery = manager
            .find(query.req, { aposDocId: { $in: ids } })
            .project(manager.getRelationshipQueryBuilderChoicesProjection({ field }));
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
      // for public use in URLs (and it's good naming because the public would
      // find the _ weird).
      //
      // If you're wondering, you should have had the leading _ anyway to keep it from
      // persisting the loaded data for the relationship back to your doc, which could
      // easily blow mongodb's doc size limit and in any case is out of data
      // info in your database.

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
            const relationshipQuery = self.apos.doc.getManager(field.withType)
              .find(query.req)
              .relationships(false)
              .areas(false);
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
      // Serious errors throw an exception, while certain lesser errors just print
      // a message to stderr for bc.
      //
      // This method may also prevent errors by automatically supplying
      // reasonable values for certain properties, such as the `idsStorage` property
      // of a `relationship` field, or the `label` property of anything.

      validate(schema, options, parent = null) {
        schema.forEach(field => {
          // Infinite recursion prevention
          const key = `${options.type}:${options.subtype}.${field.name}`;
          if (!self.validatedSchemas[key]) {
            self.validatedSchemas[key] = true;
            self.validateField(field, options, parent);
          }
        });
      },

      // Validates a single schema field. See `validate`.
      validateField(field, options, parent = null) {
        field.aposPath = parent
          ? `${parent.aposPath}/${field.name}`
          : field.name;

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
        if (field.hidden && field.hidden !== true && field.hidden !== false) {
          fail(`hidden must be a boolean, "${field.hidden}" provided.`);
        }
        if (field.if && field.if.$or && !Array.isArray(field.if.$or)) {
          fail(`$or conditional must be an array of conditions. Current $or configuration: ${JSON.stringify(field.if.$or)}`);
        }
        if (
          field.requiredIf &&
          field.requiredIf.$or &&
          !Array.isArray(field.requiredIf.$or)
        ) {
          fail(`$or conditional must be an array of conditions. Current $or configuration: ${JSON.stringify(field.requiredIf.$or)}`);
        }
        if (!field.editPermission && field.permission) {
          field.editPermission = field.permission;
        }
        if (options.type !== 'doc type' && (field.editPermission || field.viewPermission)) {
          warn(`editPermission or viewPermission must be defined on doc-type schemas only, "${options.type}" provided`);
        }
        if (options.type === 'doc type' && (field.editPermission || field.viewPermission) && parent) {
          warn(`editPermission or viewPermission must be defined on root fields only, provided on "${parent.name}.${field.name}"`);
        }
        if (fieldType.validate) {
          fieldType.validate(field, options, warn, fail);
        }
        // Ancestors hoisting should happen AFTER the validation recursion,
        // so that ancestors are processed as well.
        self.hoistFollowingFieldsToParent(field, parent);
        function fail(s) {
          throw new Error(format(s));
        }
        function warn(s) {
          self.apos.util.error(format(s));
        }
        function format(s) {
          const fieldName = parent && parent.name
            ? `${parent.name}.${field.name}`
            : field.name;

          return stripIndents`
            ${options.type} ${options.subtype}, ${field.type} field "${fieldName}":

            ${s}

          `;
        }
      },

      // If a field has a following property and a parent,
      // hoist that property values to the parent,
      // if they start with `<`.
      hoistFollowingFieldsToParent(field, parent) {
        if (!parent || !field.following) {
          return;
        }
        const following = typeof field.following === 'string'
          ? [ field.following ]
          : field.following;
        const parentFollowing = typeof parent.following === 'string'
          ? [ parent.following ]
          : parent.following;
        const hoistFollowing = following
          .filter(f => f.startsWith('<'))
          .map(f => f.slice(1));
        parent.following = _.uniq([
          ...(parentFollowing || []),
          ...hoistFollowing
        ]);
      },

      // Recursively register the given schema, giving each field an _id and making
      // provision to be able to fetch its definition via apos.schema.getFieldById().
      //
      // metaType and type refer to the doc or widget that ultimately contains this
      // schema, even if it is nested as an array schema. `metaType` will be "doc"
      // or "widget" and `type` will be the type name. This is used to dynamically assign
      // sufficiently unique `arrayName` properties to array fields and may be used
      // for similar scoping tasks.

      register(metaType, type, schema) {
        for (const field of schema) {
          // _id needs to be consistent across processes
          field._id = self.apos.util.md5(JSON.stringify(_.omit(field, '_id', 'group')));
          if (field.def === undefined) {
            // Pull fallback default into field definition to save
            // code and so that it is available on the browser side
            field.def = self.fieldTypes[field.type].def;
          }
          self.fieldsById[field._id] = field;
          const fieldType = self.fieldTypes[field.type];
          if (fieldType.register) {
            fieldType.register(metaType, type, field);
          }
        }
      },
      // Fetch a schema field definition by its _id. The _id comes into being at
      // afterInit time and is used later to determine the options for widgets nested in
      // areas when rendering a newly added widget in the context of a modal.
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
            self.apos.util.set(
              patch,
              key,
              _.differenceWith(
                self.apos.util.get(patch, key) || [],
                Array.isArray(val) ? val : [],
                (a, b) => _.isEqual(a, b))
            );
          });
        } else if (patch.$pullAllById) {
          _.each(patch.$pullAllById, function(val, key) {
            cloneOriginalBase(key);
            if (!Array.isArray(val)) {
              val = [ val ];
            }
            self.apos.util.set(
              patch,
              key,
              _.differenceWith(
                self.apos.util.get(patch, key) || [],
                Array.isArray(val) ? val : [],
                (a, b) => a._id === b
              ));
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
            let atReference = false;
            if (key.charAt(0) === '@') {
              atReference = key;
              key = self.apos.util.resolveAtReference(existingPage, key);
              if (key && patch[key.split('.')[0]]) {
                // This base has already been cloned into the patch, or it
                // otherwise touches this base, so we need to re-resolve
                // the reference or indexes may be incorrect
                key = self.apos.util.resolveAtReference(patch, atReference);
              }
            }
            // Simple replacement with a dot path
            if (atReference || (key.indexOf('.') !== -1)) {
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
              const updated = existing
                .slice(0, position)
                .concat(each)
                .concat(existing.slice(position));
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
            const result = self.apos.util.findNestedObjectAndDotPathById(
              existingPage,
              _id,
              { ignoreDynamicProperties: true }
            );
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

      // Given a `patch` containing mongo-style patch operators like `$push`,
      // return a subset of `schema` containing the root fields that would ultimately
      // be updated by those operations.
      subsetSchemaForPatch(schema, patch) {
        const idsStorageFields = {};
        schema.forEach(function(field) {
          if (field.type === 'relationship') {
            idsStorageFields[field.idsStorage] = field.name;
          }
        });
        return self.apos.schema.subset(
          schema,
          _.map(_.keys(patch).concat(operatorKeys()), idsStorageFieldToSchemaField)
        );
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
      groupsToArray(groups = {}) {
        return Object.keys(groups).map(name => ({
          name,
          ...groups[name]
        }));
      },
      fieldsToArray(context, fields = {}) {
        const result = [];
        for (const name of Object.keys(fields)) {
          const field = {
            name,
            ...fields[name]
          };
          const fieldTypesWithSchemas = [ 'object', 'array', 'relationship' ];
          if (fieldTypesWithSchemas.includes(field.type)) {
            if (field.type !== 'relationship' && !field.fields) {
              throw new Error(`${context}: the subfield ${name} requires a 'fields' property, with an 'add' subproperty containing its own fields.`);
            }
            if (field.fields) {
              if (!field.fields.add) {
                if (Object.keys(field.fields).length) {
                  throw new Error(`${context}: the subfield ${name} has a 'fields' property with no 'add' subproperty. You probably forgot to nest its fields in 'add.'`);
                } else {
                  throw new Error(`${context}: the subfield ${name} must have a 'fields' property with an 'add' subproperty containing its own fields.`);
                }
              }

              field.schema = self.compose({
                addFields: self.fieldsToArray(context, field.fields.add),
                arrangeFields: self.groupsToArray(field.fields.group)
              });
            }
          }
          result.push(field);
        }

        return result;
      },
      // Array "managers" currently offer just a schema property, for parallelism
      // with doc type and widget managers. This allows the getManagerOf method
      // to operate on objects of any of three types: doc, widget or array item.
      getArrayManager(name) {
        return self.arrayManagers[name];
      },
      // This allows the getManagerOf method to operate on objects of type "object".
      getObjectManager(name) {
        return self.objectManagers[name];
      },
      // Regenerate all array item, area and widget ids so they are considered
      // new. Useful when copying an entire doc.
      regenerateIds(req, schema, doc) {
        for (const field of schema) {
          if (field.type === 'array') {
            for (const item of (doc[field.name] || [])) {
              item._originalId = item._id;
              item._id = self.apos.util.generateId();
              self.regenerateIds(req, field.schema, item);
            }
          } else if (field.type === 'object') {
            self.regenerateIds(req, field.schema, doc[field.name] || {});
          } else if (field.type === 'area') {
            if (doc[field.name]) {
              doc[field.name]._originalId = doc[field.name]._id;
              doc[field.name]._id = self.apos.util.generateId();
              for (const item of (doc[field.name].items || [])) {
                item._originalId = item._id;
                item._id = self.apos.util.generateId();
                const schema = self.apos.area.getWidgetManager(item.type).schema;
                self.regenerateIds(req, schema, item);
              }
            }
          }
          // We don't want to regenerate attachment ids. They correspond to
          // actual files, and the reference count will update automatically
        }
      },

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
        self.schemaPointers = {};
        registerMetaType(self.apos.doc.managers, 'doc');
        registerMetaType(self.apos.area.widgetManagers, 'widget');
        function registerMetaType(managers, metaType) {
          for (const [ type, manager ] of Object.entries(managers)) {
            const schema = manager.schema;
            self.register(metaType, type, schema);
            const pointer = {
              parent: null,
              fieldIdsByName: getFieldIdsByName(schema)
            };
            for (const field of schema) {
              setSchemaPointers(pointer, field);
            }
          }
        }
        function setSchemaPointers(parent, field) {
          const pointer = {
            parent
          };
          if (field.schema) {
            pointer.fieldIdsByName = getFieldIdsByName(field.schema);
            for (const child of field.schema) {
              setSchemaPointers(pointer, child);
            }
          }
          self.schemaPointers[field._id] = pointer;
        }
        function getFieldIdsByName(schema) {
          const idsByName = {};
          for (const field of schema) {
            idsByName[field.name] = field._id;
          }
          return idsByName;
        }
      },

      // resolves paths such as:
      // 'siblingname'
      // '<fieldofparentname'
      // '<<fieldofgrandparentname'
      //
      // Throws an 'invalid' exception if id is not a
      // valid field id, the field does not list the path
      // in its 'following' property or relativePath does
      // not point to a valid field

      getFieldByRelativePath(id, relativePath) {
        const field = self.apos.schema.getFieldById(id);
        if (!field) {
          throw self.apos.error('invalid', 'no such field id');
        }
        if (!(field.following || []).includes(relativePath)) {
          throw self.apos.error('invalid', `${relativePath} does not appear in "following" for this field`);
        }
        let pointer = self.schemaPointers[field._id];
        if (!pointer) {
          // Should not be possible
          throw self.apos.error('error', 'schema pointer not found even though field id is valid');
        }
        let path = relativePath;
        // We are at the field level, first step to our own parent, which is a schema,
        // so that a path like "peername" works
        pointer = pointer.parent;
        // Now deal with any ancestor paths
        while (path.startsWith('<')) {
          pointer = pointer.parent;
          if (!pointer) {
            throw self.apos.error('invalid', `${path} (${relativePath}) points above the schema tree`);
          }
          path = path.substring(1);
        }
        const relatedId = pointer.fieldIdsByName[path];
        if (!relatedId) {
          throw self.apos.error('invalid', `${path} (${relativePath}) is not a valid field in the schema tree`);
        }
        const relatedField = self.getFieldById(relatedId);
        if (!relatedField) {
          throw self.apos.error('error', `${path} (${relativePath}) resolves to a field id but getFieldById somehow does not return a field`);
        }
        return relatedField;
      },

      async getChoicesForQueryBuilder(field, query) {
        const req = self.apos.task.getReq();
        const allChoices = await self.getChoices(req, field);
        const values = await query.toDistinct(field.name);

        const choices = _.map(values, function (value) {
          const choice = _.find(allChoices, { value });
          return {
            value,
            label: choice && (choice.label || value)
          };
        });

        self.apos.util.insensitiveSortByProperty(choices, 'label');

        return choices;
      },

      async getChoices(req, field, contexts = []) {
        if (typeof field.choices !== 'string') {
          return field.choices;
        }

        try {
          const following = {};
          for (const follows of field.following || []) {
            let level = contexts.length - 1;
            let path = follows;
            while (true) {
              if (level < 0) {
                throw self.apos.error('invalid', `${follows} is not a valid path in ${field.name}`);
              }
              if (!path.startsWith('<')) {
                following[follows] = contexts[level][path];
                break;
              }
              path = path.substring(1);
              level--;
            }
          }
          const result = await self.evaluateMethod(
            req,
            field.choices,
            field.name,
            field.moduleName,
            null,
            true,
            following
          );
          return result;
        } catch (error) {
          throw self.apos.error('invalid', error.message);
        }
      },

      getSlugFieldOptions(field, data) {
        const options = {
          def: field.def
        };
        if (field.page) {
          options.allow = '/';
        }
        return options;
      },

      // Register a Vue component as custom indicator in the UI manager.
      // The component should be already exist in the admin UI
      // (created in `ui/apos/components`).
      // Properties:
      // - `component`: the name of the Vue component
      // - `props`: (optional, object) additional props to pass to the component.
      // - `if`: (optional, object) a standard Apostrophe condition to show/hide
      //    the indicator. Keep in mind the component can also decide internally
      //    to show/hide itself. The condition is evaluated against the draft doc.
      //    The keys represent field names and support dot notation.
      //
      // Example:
      // ```javascript
      // self.apos.schema.addManagerIndicator({
      //   component: 'MyCustomIndicator',
      //   props: {
      //     label: 'My indicator'
      //   },
      //   if: {
      //     type: 'my-type',
      //     'myField': 'my-value',
      //     'myObject.field': 'my-nested-value'
      //   }
      // });
      addManagerIndicator({
        component, props, if: condition
      }) {
        self.uiManagerIndicators.push({
          component,
          props,
          if: condition
        });
      },

      async choicesRoute(req) {
        const fieldId = self.apos.launder.string(req.query.fieldId);
        const docId = self.apos.launder.string(req.query.docId);
        const followingData = req.body?.following || {};
        const following = {};
        const field = self.getFieldById(fieldId);
        let choices = [];
        if (
          !field ||
          !self.fieldTypes[field.type].dynamicChoices ||
          !(field.choices && typeof field.choices === 'string')
        ) {
          throw self.apos.error('invalid');
        }
        if (field.following) {
          for (const follows of field.following) {
            const relatedField = self.getFieldByRelativePath(field._id, follows);
            relatedField.if = undefined;
            relatedField.requiredIf = undefined;
            const subset = [ relatedField ];
            const source = {
              [relatedField.name]: followingData && followingData[follows]
            };
            const output = {};
            try {
              await self.convert(req, subset, source, output);
              following[follows] = output[relatedField.name];
            } catch (e) {
              self.apos.util.debug(e);
              // the fields we are following are not yet in a valid state
              // (if they ever will be), so no choices offered yet
              return {
                choices: []
              };
            }
          }
        }
        try {
          choices = await self.evaluateMethod(
            req,
            field.choices,
            field.name,
            field.moduleName,
            docId,
            true,
            following
          );
        } catch (error) {
          throw self.apos.error('invalid', error.message);
        }
        if (Array.isArray(choices)) {
          return {
            choices
          };
        } else {
          throw self.apos.error('invalid', `The method ${field.choices} from the module ${field.moduleName} did not return an array`);
        }
      }

    };
  },
  apiRoutes(self) {
    return {
      get: {
        async choices(req) {
          return self.choicesRoute(req);
        },
        async evaluateExternalCondition(req) {
          const fieldId = self.apos.launder.string(req.query.fieldId);
          const docId = self.apos.launder.string(req.query.docId, null);
          const conditionKey = self.apos.launder.string(req.query.conditionKey);

          const field = self.getFieldById(fieldId);
          const allowedKeys = getFieldExternalConditionKeys(field);
          // We must tolerate arguments at this stage as we only warn about them later
          if (!allowedKeys.includes(conditionKey.replace(/\(.*\)/, '()'))) {
            throw self.apos.error('forbidden', `${conditionKey} is not registered as an external condition.`);
          }
          try {
            const result = await self.evaluateMethod(
              req,
              conditionKey,
              field.name,
              field.moduleName,
              docId
            );
            return { result };
          } catch (error) {
            throw self.apos.error('invalid', error.message);
          }
        }
      },
      post: {
        async choices(req) {
          return self.choicesRoute(req);
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        const fields = {};
        for (const name in self.fieldTypes) {
          let component = self.fieldTypes[name].vueComponent;
          // If explicitly false, it intentionally has no UI at all
          if (component !== false) {
            // Otherwise fall back to the standard naming pattern
            // if not otherwise specified
            component = component || 'AposInput' + self.apos.util.capitalizeFirst(name);
          }
          fields[name] = component;
        }
        browserOptions.action = self.action;
        browserOptions.components = { fields };
        browserOptions.fieldMetadataComponents = self.fieldMetadataComponents;
        browserOptions.customCellIndicators = self.uiManagerIndicators;
        return browserOptions;
      }
    };
  }
};

function getFieldExternalConditionKeys(field) {
  const conditionTypes = [ 'if', 'requiredIf' ];
  const getConditionKeys = conditionType => getConditionTypeExternalConditionKeys(
    field[conditionType] || {}
  );
  return [
    ...new Set(conditionTypes
      .map(getConditionKeys)
      .flat())
  ];
}

function getConditionTypeExternalConditionKeys(conditions) {
  let results = [];
  if (conditions.$or) {
    results = conditions.$or.map(getConditionTypeExternalConditionKeys).flat();
  }
  for (const key of Object.keys(conditions)) {
    if (key === '$or') {
      results = [
        ...results,
        conditions.$or.map(getConditionTypeExternalConditionKeys).flat()
      ];
    } else {
      if (key.endsWith('()')) {
        results.push(key);
      }
    }
  }
  return results;
}
