// This module provides schemas, a flexible and fast way to create new data types
// by specifying the fields that should make them up. Schemas power
// [apostrophe-pieces](../apostrophe-pieces/index.html),
// [apostrophe-widgets](../apostrophe-widgets/index.html), custom field
// types in page settings for [apostrophe-custom-pages](../apostrophe-custom-pages/index.html)
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
const async = require('async');
const moment = require('moment');
const tinycolor = require('tinycolor2');

module.exports = {

  alias: 'schemas',

  afterConstruct: function(self) {
    self.enableBrowserData();
  },

  construct: function(self, options) {

    require('./lib/browser')(self, options);

    // Compose a schema based on addFields, removeFields, orderFields
    // and, occasionally, alterFields options. This method is great for
    // merging the schema requirements of subclasses with the schema
    // requirements of a superclass. See the apostrophe-schemas documentation
    // for a thorough explanation of the use of each option. The
    // alterFields option should be avoided if your needs can be met
    // via another option.

    self.compose = function(options) {
      const schema = [];

      // Useful for finding good unit test cases
      // self.apos.utils.log(JSON.stringify(_.pick(options, 'addFields', 'removeFields', 'arrangeFields'), null, '  '));

      if (options.addFields) {
        // loop over our addFields
        _.each(options.addFields, function(field) {
          let i;
          // remove it from the schema if we've already added it, last one wins
          for (i = 0; (i < schema.length); i++) {
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
        schema = _.filter(schema, function(field) {
          return !_.contains(options.removeFields, field.name);
        });
      }

      if (options.requireFields) {
        _.each(options.requireFields, function(name) {
          const field = _.find(schema, function(field) {
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
      const defaultGroup = self.options.defaultGroup || {};
      let groups = [
        {
          name: defaultGroup.name || 'default',
          label: defaultGroup.label || 'Info',
          fields: _.pluck(schema, 'name')
        }
      ];

      // if we are getting arrangeFields and it's not empty
      if (options.arrangeFields && options.arrangeFields.length > 0) {
        // if it's full of strings, use them for the default group
        if (_.isString(options.arrangeFields[0])) {
          groups[0].fields = options.arrangeFields;
        // if it's full of objects, those are groups, so use them
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
      _.each(groups, function(group) {
        let index = _.findIndex(newGroups, { name: group.name });
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
      const newSchema = [];
      // loop over any groups and orders we want to respect
      _.each(groups, function(group) {

        _.each(group.fields, function(field) {
          // find the field we are ordering
          let f = _.find(schema, { name: field });
          if (!f) {
            // May have already been migrated due to subclasses re-grouping fields
            f = _.find(newSchema, { name: field });
          }

          // make sure it exists
          if (f) {
            // set the group for this field
            let g = _.clone(group, true);
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
      _.each(schema, function(field) {
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
      _.each(schema, function(field) {
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

      // Move the default group to the end, it's just too
      // obnoxious otherwise with one-off fields popping up
      // before title etc.

      schema = _.filter(schema, function(field) {
        return !(field.group && (field.group.name === 'default'));
      }).concat(_.filter(schema, function(field) {
        return field.group && (field.group.name === 'default');
      }));

      _.each(schema, function(field) {

        // A field can have a custom template, which can be a
        // template name (relative to the apostrophe-schemas module)
        // or a function (called to render it)

        if (field.template) {
          if (typeof (field.template) === 'string') {
            field.partial = self.partialer(field.template);
            delete field.template;
          } else {
            field.partial = field.template;
            delete field.template;
          }
        }

        // Extra validation for select fields, TODO move this into the field type definition

        if (field.type === 'select' || field.type === 'checkboxes') {
          _.each(field.choices, function(choice) {
            if (choice.showFields) {
              if (!_.isArray(choice.showFields)) {
                throw new Error('The \'showFields\' property in the choices of a select field needs to be an array.');
              }
              _.each(choice.showFields, function(showFieldName) {
                if (!_.find(schema, function(schemaField) { return schemaField.name === showFieldName; })) {
                  self.apos.utils.error('WARNING: The field \'' + showFieldName + '\' does not exist in your schema, but you tried to toggle its display with a select field using showFields. STAAAHHHHPP!');
                }
              });
            }
          });
        }

      });

      // Shallowly clone the fields. This allows modules
      // like workflow to patch schema fields of various modules
      // without inadvertently impacting other apos instances
      // when running with apostrophe-multisite
      return _.map(schema, function(field) {
        return _.clone(field);
      });
    };

    // refine is like compose, but it starts with an existing schema array
    // and amends it via the same options as compose.

    self.refine = function(schema, _options) {
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
      _.each(schema, function(field) {
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
    };

    // Converts a flat schema (array of field objects) into a two
    // dimensional schema, broken up by groups
    self.toGroups = function(fields) {
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
      _.each(fields, function(field) {
        if (field.contextual) {
          return;
        }
        if (!field.group) {
          field.group = { name: 'default', label: 'info' };
        }
        // first group, or not the current group
        if ((groups.length === 0) || (groups[currentGroup].name !== field.group.name)) {
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
    };

    // Return a new schema containing only the fields named in the
    // `fields` array, while maintaining existing group relationships.
    // Any empty groups are dropped. Do NOT include group names
    // in `fields`.

    self.subset = function(schema, fields) {

      let groups;

      // check if we're already grouped
      if (schema[0].type === 'group') {
        // Don't modify the original schema which may be in use elsewhere
        groups = _.cloneDeep(schema);

        // loop over each group and remove fields from them that aren't in this subset
        _.each(groups, function(group) {
          group.fields = _.filter(group.fields, function(field) {
            return _.contains(fields, field.name);
          });
        });

        // remove empty groups
        groups = _.filter(groups, function(group) {
          return group.fields.length > 0;
        });

        return groups;
      } else {
        // otherwise this is a simple filter
        return _.filter(schema, function(field) {
          return _.contains(fields, field.name);
        });
      }
    };

    // Return a new object with all default settings
    // defined in the schema
    self.newInstance = function(schema) {
      const def = {};
      _.each(schema, function(field) {
        if (field.def !== undefined) {
          def[field.name] = field.def;
        }
      });
      return def;
    };

    self.subsetInstance = function(schema, instance) {
      const subset = {};
      _.each(schema, function(field) {
        if (field.type === 'group') {
          return;
        }
        const subsetCopy = self.fieldTypes[field.type].subsetCopy;
        if (!subsetCopy) {
          // These rules suffice for our standard fields
          subset[field.name] = instance[field.name];
          if (field.idField) {
            subset[field.idField] = instance[field.idField];
          }
          if (field.idsField) {
            subset[field.idsField] = instance[field.idsField];
          }
          if (field.relationshipsField) {
            subset[field.relationshipsField] = instance[field.relationshipsField];
          }
        } else {
          subsetCopy(field.name, instance, subset, field);
        }
      });
      return subset;
    };

    // Determine whether an object is empty according to the schema.
    // Note this is not the same thing as matching the defaults. A
    // nonempty string or array is never considered empty. A numeric
    // value of 0 is considered empty

    self.empty = function(schema, object) {
      return !_.find(schema, function(field) {
        // Return true if not empty
        const value = object[field.name];
        if ((value !== null) && (value !== undefined) && (value !== false)) {
          const emptyTest = self.fieldTypes[field.type].empty;
          if (!emptyTest) {
            // Type has no method to check emptiness, so assume not empty
            return true;
          }
          return !emptyTest(field, value);
        }
      });
    };

    // Index the object's fields for participation in Apostrophe search unless
    // `searchable: false` is set for the field in question

    self.indexFields = function(schema, object, texts) {
      _.each(schema, function(field) {
        if (field.searchable === false) {
          return;
        }
        const fieldType = self.fieldTypes[field.type];
        if (!fieldType.index) {
          return;
        }
        fieldType.index(object[field.name], field, texts);
      });
    };

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

    self.convert = async function(req, schema, data, object) {
      if (Array.isArray(req)) {
        throw new Error("convert invoked without a req, do you have one in your context?");
      }

      let errors = [];

      for (const field of schema) {
        if (field.readOnly) {
          continue;
        }
        // Fields that are contextual are left alone, not blanked out, if
        // they do not appear at all in the data object.
        if (field.contextual && (!_.has(data, field.name))) {
          return;
        }
        const convert = self.fieldTypes[field.type].convert;
        try {
          await convert(req, field, data, object);
        } catch (e) {
          if (Array.isArray(e)) {
            // Nested object or array will throw an array if it
            // encounters an error or errors in its subsidiary fields
            for (let error of e) {
              errors.push({
                path: field.name + '.' + error.path,
                error: error.error
              });
            }
          } else {
            errors.push({
              path: field.name,
              error: e
            });
          }
        }
      }
    
      errors = errors.filter(error => {
        if ((typeof error.error) === 'string') {
          if (((error.error === 'required') || (error.error === 'mandatory')) && (!self.isVisible(schema, object, error.path))) {
            // It is not reasonable to enforce required for
            // fields hidden via showFields
            return false;
          }
        }
        return true;
      });
      if (errors.length) {
        throw errors;
      }
    };

    // Determine whether the given field is visible
    // based on showFields options of all fields

    self.isVisible = function(schema, object, name) {
      const hidden = {};
      _.each(schema, function(field) {
        if (!_.find(field.choices || [], function(choice) {
          return choice.showFields;
        })) {
          return;
        }
        _.each(field.choices, function(choice) {
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
        _.each(field.choices || [], function(choice) {
          _.each(choice.showFields || [], function(name) {
            hide(name);
          });
        });
      }
    };

    // Driver invoked by the "join" methods of the standard
    // join field types.
    //
    // All arguments must be present, however relationshipsField
    // may be undefined to indicate none is needed.
    self.joinDriver = async function(req, method, reverse, items, idField, relationshipsField, objectField, options) {
      if (!options) {
        options = {};
      }
      const find = options.find;
      const filters = options.filters || {};
      const hints = options.hints || {};
      const getCriteria = options.getCriteria || {};
      // Some joinr methods don't take relationshipsField
      if (method.length === 4) {
        const realMethod = method;
        method = function(items, idField, relationshipsField, objectField, getter) {
          return realMethod(items, idField, objectField, getter);
        };
      }
      const ids = await method(items, idField, relationshipsField, objectField);
      const idsCriteria = {};
      if (reverse) {
        idsCriteria[idField] = { $in: ids };
      } else {
        idsCriteria._id = { $in: ids };
      }
      const criteria = { $and: [ getCriteria, idsCriteria ] };
      const cursor = find(req, criteria);
      // Filters hardcoded as part of this join's blessed options don't
      // require any sanitization
      _.each(filters, function(val, key) {
        cursor[key](val);
      });
      // Hints, on the other hand, don't go through the blessing mechanism
      // so they must be sanitized
      cursor.queryToFilters(hints, 'manage');
      return cursor.toArray();
    };

    // Carry out all the joins in the schema on the specified object or array
    // of objects. The withJoins option may be omitted.
    //
    // If withJoins is omitted, null or undefined, all the joins in the schema
    // are performed, and also any joins specified by the 'withJoins' option of
    // each join field in the schema, if any. And that's where it stops. Infinite
    // recursion is not possible.
    //
    // If withJoins is specified and set to "false", no joins at all are performed.
    //
    // If withJoins is set to an array of join names found in the schema, then
    // only those joins are performed, ignoring any 'withJoins' options found in
    // the schema.
    //
    // If a join name in the withJoins array uses dot notation, like this:
    //
    // _events._locations
    //
    // Then the objects are joined with events, and then the events are further
    // joined with locations, assuming that _events is defined as a join in the
    // schema and _locations is defined as a join in the schema for the events
    // module. Multiple "dot notation" joins may share a prefix.
    //
    // Joins are also supported in the schemas of array fields.

    self.join = async function(req, schema, withJoins, objectOrArray) {
      if (arguments.length === 3) {
        objectOrArray = withJoins;
        withJoins = undefined;
      }

      if (withJoins === false) {
        // Joins explicitly deactivated for this call
        return;
      }

      const objects = _.isArray(objectOrArray) ? objectOrArray : [ objectOrArray ];
      if (!objects.length) {
        // Don't waste effort
        return;
      }

      // build an array of joins of interest, found at any level
      // in the schema, even those nested in array schemas. Add
      // an _arrays property to each one which contains the names
      // of the array fields leading to this join, if any, so
      // we know where to store the results. Also set a
      // _dotPath property which can be used to identify relevant
      // joins when the withJoins option is present

      let joins = [];

      function findJoins(schema, arrays) {
        const _joins = _.filter(schema, function(field) {
          return !!self.fieldTypes[field.type].join;
        });
        _.each(_joins, function(join) {
          if (!arrays.length) {
            join._dotPath = join.name;
          } else {
            join._dotPath = arrays.join('.') + '.' + join.name;
          }
          // If we have more than one object we're not interested in joins
          // with the ifOnlyOne restriction right now.
          if ((objects.length > 1) && join.ifOnlyOne) {
            return;
          }
          join._arrays = _.clone(arrays);
        });
        joins = joins.concat(_joins);
        _.each(schema, function(field) {
          if (field.type === 'array' || field.type === 'object') {
            findJoins(field.schema, arrays.concat(field.name));
          }
        });
      }

      findJoins(schema, []);

      // The withJoins option allows restriction of joins. Set to false
      // it blocks all joins. Set to an array, it allows the joins named within.
      // Dot notation can be used to specify joins in array properties,
      // or joins reached via other joins.
      //
      // By default, all configured joins will take place, but withJoins: false
      // will be passed when fetching the objects on the other end of the join,
      // so that infinite recursion never takes place.

      const withJoinsNext = {};
      // Explicit withJoins option passed to us
      if (Array.isArray(withJoins)) {
        joins = _.filter(joins, function(join) {
          const dotPath = join._dotPath;
          let winner;
          _.each(withJoins, function(withJoinName) {
            if (withJoinName === dotPath) {
              winner = true;
              return;
            }
            if (withJoinName.substr(0, dotPath.length + 1) === (dotPath + '.')) {
              if (!withJoinsNext[dotPath]) {
                withJoinsNext[dotPath] = [];
              }
              withJoinsNext[dotPath].push(withJoinName.substr(dotPath.length + 1));
              winner = true;
            }
          });
          return winner;
        });
      } else {
        // No explicit withJoins option for us, so we do all the joins
        // we're configured to do, and pass on the withJoins options we
        // have configured for those
        _.each(joins, function(join) {
          if (join.withJoins) {
            withJoinsNext[join._dotPath] = join.withJoins;
          }
        });
      }

      for (const join of joins) {
        const arrays = join._arrays;

        function findObjectsInArrays(objects, arrays) {
          if (!arrays) {
            return [];
          }
          if (!arrays.length) {
            return objects;
          }
          const array = arrays[0];
          const _objects = [];
          _.each(objects, function(object) {
            _objects = _objects.concat(object[array] || []);
          });
          return findObjectsInArrays(_objects, arrays.slice(1));
        }

        const _objects = findObjectsInArrays(objects, arrays);

        if (!join.name.match(/^_/)) {
          throw Error('Joins should always be given names beginning with an underscore (_). Otherwise we would waste space in your database storing the results statically. There would also be a conflict with the array field withJoins syntax. Join name is: ' + join._dotPath);
        }
        if (Array.isArray(join.withType)) {
          // Polymorphic join
          for (let type of join.withType) {
            const manager = self.apos.docs.getManager(type);
            if (!manager) {
              throw Error('I cannot find the instance type ' + type);
            }
            const find = manager.find;

            const options = {
              find: find,
              filters: {
                joins: withJoinsNext[join._dotPath] || false
              },
              hints: {}
            };
            const subname = join.name + ':' + type;
            const _join = _.assign({}, join, {
              name: subname,
              withType: type
            });

            // Allow options to the get() method to be
            // specified in the join configuration
            if (_join.filters) {
              _.extend(options.filters, _join.filters);
            }
            if (_join.filtersByType && _join.filtersByType[type]) {
              _.extend(options.filters, _join.filtersByType[type]);
            }
            if (_join.hints) {
              _.extend(options.hints, _join.hints);
            }
            if (_join.hintsByType && _join.hintsByType[type]) {
              _.extend(options.hints, _join.hints);
              _.extend(options.hints, _join.hintsByType[type]);
            }
            // Allow options to the getter to be specified in the schema,
            // notably editable: true
            await self.fieldTypes[_join.type].join(req, _join, options, _objects);
            _.each(_objects, function(object) {
              if (object[subname]) {
                if (Array.isArray(object[subname])) {
                  object[join.name] = (object[join.name] || []).concat(object[subname]);
                } else {
                  object[join.name] = object[subname];
                }
              }
            });
          }
          if (join.idsField) {
            _.each(_objects, function(object) {
              if (object[join.name]) {
                object[join.name] = self.apos.utils.orderById(object[join.idsField], object[join.name]);
              }
            });
          }
        }

        const manager = self.apos.docs.getManager(join.withType);
        if (!manager) {
          throw Error('I cannot find the instance type ' + join.withType);
        }

        // If it has a getter, use it, otherwise supply one
        const find = manager.find;

        const options = {
          find: find,
          filters: {
            joins: withJoinsNext[join._dotPath] || false
          },
          hints: {}
        };

        // Allow options to the get() method to be
        // specified in the join configuration
        if (join.filters) {
          _.extend(options.filters, join.filters);
        }
        if (join.hints) {
          _.extend(options.hints, join.hints);
        }

        // Allow options to the getter to be specified in the schema,
        // notably editable: true
        await self.fieldTypes[join.type].join(req, join, options, _objects);
      }
      _.each(joins, function(join) {
        // Don't confuse the blessing mechanism
        delete join._arrays;
        delete join._dotPath;
      });
    };

    self.fieldTypes = {};

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
    // ### `bless`
    //
    // Optional. A function which accepts `req, field` and calls `self.apos.utils.bless`
    // on any schemas nested within `field`, so that editors are allowed to edit content. See
    // the implementation of the `areas` field type for an example.
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

    self.addFieldType = function(type) {
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
        _.each(_.keys(fieldType.converters), function(key) {
          const value = fieldType.converters[key];
          if (typeof (value) === 'string') {
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

    };

    self.getFieldType = function(typeName) {
      return self.fieldTypes[typeName];
    };

    self.addHelpers({
      toGroups: function(fields) {
        return self.toGroups(fields);
      },
      field: function(field, readOnly) {
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
    });

    // Given a schema and a cursor, add filter methods to the cursor
    // for each of the fields in the schema, based on their field type,
    // if supported by the field type. If a field name exists in `options.override`
    // this is done even if such a filter is already present on the cursor object.

    self.addFilters = function(schema, options, cursor) {
      _.each(schema, function(field) {
        let fieldType = self.fieldTypes[field.type];
        if (cursor[field.name] && (!_.contains(options.override || [], field.name))) {
          // Don't override filters that exist in the base
          // apostrophe-cursors type, for instance `published`
          return;
        }
        if (fieldType.addFilter) {
          fieldType.addFilter(field, cursor);
        }
      });
    };

    self.addFieldType({
      name: 'area',
      convert: async function(req, field, data, object) {
        if ((typeof data[field.name]) === 'string') {
          object[field.name] = self.apos.areas.fromPlaintext(data[field.name]);
          return;
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
        items = await self.apos.areas.sanitizeItems(req, items, field.options);
        object[field.name] = { items: items, type: 'area' };
      },
      isEmpty: function(field, value) {
        return self.apos.areas.isEmpty({ area: value });
      },
      bless: function(req, field) {
        if (field.options && field.options.widgets) {
          _.each(field.options.widgets || {}, function(options, type) {
            self.apos.utils.bless(req, options, 'widget', type);
          });
        }
      }
    });

    self.addFieldType({
      name: 'singleton',
      extend: 'area',
      isEmpty: function(field, value) {
        return self.apos.areas.isEmptySingleton({ area: value, type: field.widgetType });
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, field.options || {}, 'widget', field.widgetType);
      }
    });

    self.addFieldType({
      name: 'string',
      convert: function(req, field, data, object) {
        object[field.name] = self.apos.launder.string(data[field.name], field.def);
        if (object[field.name] && field.min && (object[field.name].length < field.min)) {
          // Would be unpleasant, but shouldn't happen since the browser
          // also implements this. We're just checking for naughty scripts
          throw 'min';
        }
        // If max is longer than allowed, trim the value down to the max length
        if (object[field.name] && field.max && (object[field.name].length > field.max)) {
          object[field.name] = object[field.name].substr(0, field.max);
        }
        // If field is required but empty (and client side didn't catch that)
        // This is new and until now if JS client side failed, then it would
        // allow the save with empty values -Lars
        if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
          throw 'required';
        }
      },
      index: function(value, field, texts) {
        let silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: value, silent: silent });
      },
      isEmpty: function(field, value) {
        return !value.length;
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              criteria[field.name] = new RegExp(self.apos.utils.regExpQuote(cursor.get(field.name)), 'i');
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(s) {
            return self.apos.launder.string(s);
          },
          choices: async function() {
            return self.sortedDistinct(field.name, cursor);
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
      convert: function(req, field, data, object) {
        const options = {};
        if (field.page) {
          options.allow = '/';
        }
        object[field.name] = self.apos.utils.slugify(self.apos.launder.string(data[field.name], field.def), options);
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
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              let slugifyOptions = {};
              if (field.page) {
                slugifyOptions = { allow: '/' };
              }
              criteria[field.name] = new RegExp(self.apos.utils.regExpQuote(self.apos.utils.slugify(cursor.get(field.name), slugifyOptions)));
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          choices: async function() {
            return self.sortedDistinct(field.name, cursor);
          }
        });
      }
    });

    self.addFieldType({
      name: 'tags',
      convert: function(req, field, data, object) {
        let tags = self.apos.launder.tags(data[field.name]);
        if (field.options && field.options.limit) {
          tags = tags.slice(0, field.options.limit);
        }
        object[field.name] = tags;
        if (field.required && (!tags.length)) {
          throw 'required';
        }
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              criteria[field.name] = { $in: cursor.get(field.name) };
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(tags) {
            tags = self.apos.launder.tags(tags);
            if (!tags.length) {
              tags = null;
            }
            return tags;
          },
          choices: async function() {
            return self.sortedDistinct(field.name, cursor);
          }
        });
      },
      index: function(value, field, texts) {
        // Make sure fields of type "tags" that aren't the default "tags" field participate
        // in search at some level
        let silent = (field.silent === undefined) ? true : field.silent;
        if (!Array.isArray(value)) {
          value = [];
        }
        texts.push({ weight: field.weight || 15, text: value.join(' '), silent: silent });
      },
      exporters: {
        string: function(req, field, object, output) {
          // no formating, set the field
          output[field.name] = object[field.name].toString();
        }
      }
    });

    self.addFieldType({
      name: 'boolean',
      convert: function(req, field, data, object) {
        object[field.name] = self.apos.launder.boolean(data[field.name], field.def);
      },
      isEmpty: function(field, value) {
        return !value;
      },
      exporters: {
        string: function(req, field, object, output) {
          output[field.name] = self.apos.launder.boolean(object[field.name]).toString();
        }
      },
      addFilter: function(field, cursor) {
        let criteria;
        cursor.addFilter(field.name, {
          finalize: function() {
            if (cursor.get(field.name) === false) {
              criteria = {};
              criteria[field.name] = { $ne: true };
              cursor.and(criteria);
            } else if (cursor.get(field.name) === true) {
              criteria = {};
              criteria[field.name] = true;
              cursor.and(criteria);
            } else {
              // Don't care (null/undefined)
            }
          },
          safeFor: 'manage',
          launder: function(b) {
            return self.apos.launder.booleanOrNull(b);
          },
          choices: async function() {
            const values = cursor.toDistinct(field.name);
            let choices = [];
            if (_.contains(values, true)) {
              choices.push({
                value: '1',
                label: 'Yes'
              });
            }
            if (_.contains(values, true)) {
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
      convert: async function(req, field, data, object) {
        if ((typeof data[field.name]) === 'string') {
          data[field.name] = self.apos.launder.string(data[field.name]).split(',');

          if (!Array.isArray(data[field.name])) {
            object[field.name] = [];
            return;
          }

          object[field.name] = _.filter(data[field.name], function(choice) {
            return _.contains(_.pluck(field.choices, 'value'), choice);
          });
        } else {
          if (!Array.isArray(data[field.name])) {
            object[field.name] = [];
          } else {
            object[field.name] = _.filter(data[field.name], function(choice) {
              return _.contains(_.pluck(field.choices, 'value'), choice);
            });
          }
        }
      },
      index: function(value, field, texts) {
        let silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: (value || []).join(' '), silent: silent });
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              let v = cursor.get(field.name);
              // Allow programmers to pass just one value too (sanitize doesn't apply to them)
              if (!Array.isArray(v)) {
                v = [ v ];
              }
              criteria[field.name] = { $in: v };
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(value) {
            // Support one or many
            if (Array.isArray(value)) {
              return _.map(value, function(v) {
                return self.apos.launder.select(v, field.choices, field.def);
              });
            } else {
              return [ self.apos.launder.select(value, field.choices, field.def) ];
            }
          },
          choices: async function() {
            const values = await cursor.toDistinct(field.name);
            const choices = _.map(values, function(value) {
              const choice = _.find(field.choices, { value: value });
              return {
                value: value,
                label: (choice && choice.label) || value
              };
            });
            self.apos.utils.insensitiveSortByProperty(choices, 'label');
            return choices;
          }
        });
      }
    });

    self.addFieldType({
      name: 'select',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.select(data[field.name], field.choices, field.def);
      },
      index: function(value, field, texts) {
        let silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: value, silent: silent });
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              let v = cursor.get(field.name);
              // Allow programmers to pass just one value too (sanitize doesn't apply to them)
              if (!Array.isArray(v)) {
                v = [ v ];
              }
              criteria[field.name] = { $in: v };
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(value) {
            // Support one or many
            if (Array.isArray(value)) {
              return _.map(value, function(v) {
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
          choices: async function() {
            const values = await cursor.toDistinct(field.name);
            const choices = _.map(values, function(value) {
              const choice = _.find(field.choices, { value: value });
              return {
                value: value,
                label: (choice && choice.label) || value
              };
            });
            self.apos.utils.insensitiveSortByProperty(choices, 'label');
            return choices;
          }
        });
      }
    });

    self.addFieldType({
      name: 'integer',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.integer(data[field.name], field.def, field.min, field.max);
        if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
          throw 'required';
        }
        if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
          throw 'invalid';
        }
        // This makes it possible to have a field that is not required, but min / max defined.
        // This allows the form to be saved and sets the value to null if no value was given by
        // the user.
        if (!data[field.name] && data[field.name] !== 0) {
          object[field.name] = null;
        }
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            let criteria;
            let value = cursor.get(field.name);
            if ((value !== undefined) && (value !== null)) {
              if (Array.isArray(value) && (value.length === 2)) {
                criteria = {};
                criteria[field.name] = { $gte: value[0], $lte: value[1] };
              } else {
                criteria = {};
                criteria[field.name] = self.apos.launder.integer(value);
                cursor.and(criteria);
              }
            }
          },
          choices: async function() {
            return self.sortedDistinct(field.name, cursor);
          },
          launder: function(s) {
            return self.apos.launder.integer(s, null);
          }
        });
      }
    });

    self.addFieldType({
      name: 'float',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
        if (field.required && (_.isUndefined(data[field.name]) || !data[field.name].toString().length)) {
          throw 'required';
        }
        if (data[field.name] && isNaN(parseFloat(data[field.name]))) {
          throw 'invalid';
        }
        if (!data[field.name] && data[field.name] !== 0) {
          object[field.name] = null;
        }
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            let criteria;
            let value = cursor.get(field.name);
            if ((value !== undefined) && (value !== null)) {
              if (Array.isArray(value) && (value.length === 2)) {
                criteria = {};
                criteria[field.name] = { $gte: value[0], $lte: value[1] };
              } else {
                criteria = {};
                criteria[field.name] = self.apos.launder.float(value);
                cursor.and(criteria);
              }
            }
          },
          choices: async function() {
            return self.sortedDistinct(field.name, cursor);
          }
        });
      }
    });

    self.addFieldType({
      name: 'color',
      convert: async function(req, field, data, object) {
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
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.float(data[field.name], field.def, field.min, field.max);
      }
    });

    self.addFieldType({
      name: 'url',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.url(data[field.name], field.def);
      },
      diffable: function(value) {
        // URLs are fine to diff and display
        if (typeof (value) === 'string') {
          return value;
        }
        // always return a valid string
        return '';
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let criteria = {};
              criteria[field.name] = new RegExp(self.apos.utils.regExpQuote(cursor.get(field.name)), 'i');
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(s) {
            // Don't be too strict, just enough that we can safely pass it to
            // regExpQuote, partial URLs are welcome
            return self.apos.launder.string(s);
          },
          choices: async function() {
            return self.sortDistinct(field.name, cursor);
          }
        });
      }
    });

    self.addFieldType({
      name: 'date',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.date(data[field.name], field.def);
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              let value = cursor.get(field.name);
              let criteria;
              if (Array.isArray(value)) {
                criteria = {};
                criteria[field.name] = { $gte: value[0], $lte: value[1] };
              } else {
                criteria = {};
                criteria[field.name] = self.apos.launder.date(value);
                cursor.and(criteria);
              }
            }
          },
          safeFor: 'manage',
          launder: function(value) {
            if (Array.isArray(value) && (value.length === 2)) {
              if (value[0] instanceof Date) {
                value[0] = moment(value[0]).format('YYYY-MM-DD');
              }
              if (value[1] instanceof Date) {
                value[1] = moment(value[1]).format('YYYY-MM-DD');
              }
              value[0] = self.apos.launder.date(value[0]);
              value[1] = self.apos.launder.date(value[1]);
              return value;
            } else {
              if (value instanceof Date) {
                value = moment(value).format('YYYY-MM-DD');
              }
              return self.apos.launder.date(value, null);
            }
          },
          choices: async function() {
            return self.sortDistinct(field.name, cursor);
          }
        });
      }
    });

    self.addFieldType({
      name: 'time',
      convert: async function(req, field, data, object) {
        object[field.name] = self.apos.launder.time(data[field.name], field.def);
      }
    });

    self.addFieldType({
      name: 'password',
      convert: async function(req, field, data, object) {
        // This is the only field type that we never update unless
        // there is actually a new value — a blank password is not cool. -Tom
        if (data[field.name]) {
          object[field.name] = self.apos.launder.string(data[field.name], field.def);
        }
      }
    });

    self.addFieldType({
      name: 'group'
      // visual grouping only
    });

    self.addFieldType({
      name: 'array',
      convert: async function(req, field, data, object) {
        const schema = field.schema;
        data = data[field.name];
        if (!Array.isArray(data)) {
          data = [];
        }
        const results = [];
        if (field.limit && (data.length > field.limit)) {
          data = data.slice(0, field.limit);
        }
        let i = 0;
        const errors = [];
        for (const datum of data) {
          const result = {};
          result.id = self.apos.launder.id(datum.id) || self.apos.utils.generateId();
          try {
            await self.convert(req, schema, datum, result);
          } catch (e) {
            for (const error of e) {
              errors.push({
                path: i + '.' + error.path,
                error: error.error
              });
            }
          }
          i++;
          results.push(result);
        }
        object[field.name] = results;
        if (field.required && (!results.length)) {
          throw 'required';
        }
        if (errors.length) {
          throw errors;
        }
      },
      isEmpty: function(field, value) {
        return !value.length;
      },
      bless: function(req, field) {
        // So array items can be fired back at the server for rendering
        self.apos.utils.bless(req, field, 'array');
        // So the individual subfields, like joins, can be edited too
        self.bless(req, field.schema || []);
      },
      index: function(value, field, texts) {
        _.each(value || [], function(item) {
          self.apos.schemas.indexFields(field.schema, item, texts);
        });
      }
    });

    self.addFieldType({
      name: 'object',
      convert: async function(req, field, data, object) {
        const schema = field.schema;
        data = data[field.name];
        if (data == null || typeof data !== 'object' || Array.isArray(data)) {
          data = {};
        }
        const result = {};
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
      }
    });

    self.addFieldType({
      name: 'joinByOne',
      convert: async function(req, field, data, object) {

        const manager = self.apos.docs.getManager(field.withType);
        if (!manager) {
          throw Error('join with type ' + field.withType + ' unrecognized');
        }
        if (_.has(data, field.name)) {
          let titleOrId = self.apos.launder.string(data[field.name]);
          let criteria = { $or: [ { titleSortified: self.apos.utils.sortify(titleOrId) }, { _id: titleOrId } ] };
          const result = await manager.find(req, criteria, { _id: 1 }).joins(false).published(null).toObject();
          if (result) {
            object[field.idField] = result._id;
          } else {
            delete object[field.idField];
          }
        } else if (_.has(data, field.idField)) {
          object[field.idField] = self.apos.launder.id(data[field.idField]);
        }
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, _.omit(field, 'hints'), 'join');
      },
      join: async function(req, field, objects, options) {
        return self.joinDriver(req, joinr.byOne, false, objects, field.idField, undefined, field.name, options);
      },
      addFilter: function(field, cursor) {
        // for joinByOne only the "OR" case makes sense
        cursor.addFilter(field.name, {
          finalize: function() {
            if (!self.cursorFilterInterested(cursor, field.name)) {
              return;
            }
            const value = cursor.get(field.name);
            const criteria = {};
            // Even programmers appreciate shortcuts, so it's not enough that the
            // sanitizer (which doesn't apply to programmatic use) accepts these
            if (Array.isArray(value)) {
              criteria[field.idField] = { $in: value };
            } else if (value === 'none') {
              criteria.$or = [];
              const clause = {};
              clause[field.idField] = null;
              criteria.$or.push(clause);
              clause = {};
              clause[field.idField] = { $exists: 0 };
              criteria.$or.push(clause);
            } else {
              criteria[field.idField] = value;
            }
            cursor.and(criteria);
          },
          choices: self.joinFilterChoices(field, cursor, '_id'),
          safeFor: 'manage',
          launder: joinFilterLaunder
        });

        self.addJoinSlugFilter(field, cursor, '');
      },
      validate: function(field, options, warn, fail) {
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.idField) {
          if (field.idsField) {
            fail('joinByOne takes idField, not idsField. You can also omit it, in which case a reasonable value is supplied.');
          }
          // Supply reasonable value
          field.idField = field.name.replace(/^_/, '') + 'Id';
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name
          const withType = field.name.replace(/^_/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. If you are defining only one join, you can omit withType and give your join the same name as the other type, with a leading _.');
          }
          field.withType = withType;
        }
        if (Array.isArray(field.withType)) {
          _.each(field.withType, function(type) {
            if (!_.find(self.apos.docs.managers, { name: type })) {
              fail('withType property, ' + type + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
            }
          });
        } else {
          if (!_.find(self.apos.docs.managers, { name: field.withType })) {
            fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
          }
        }
      }
    });

    self.addFieldType({
      name: 'joinByOneReverse',
      join: async function(req, field, objects, options) {
        return self.joinDriver(req, joinr.byOneReverse, true, objects, field.idField, undefined, field.name, options);
      },
      validate: function(field, options, warn, fail) {
        let forwardJoin;
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name
          const withType = field.name.replace(/^_/, '').replace(/s$/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type.  Or omit it and give your join the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        const otherModule = _.find(self.apos.docs.managers, { name: field.withType });
        if (!otherModule) {
          fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
        }
        if (!(field.reverseOf || field.idField)) {
          // Look for a join with our type in the other type
          // Mjust validate it first to add any implied fields there too
          self.validate(otherModule.schema, { type: 'doc type', subtype: otherModule.name });
          forwardJoin = _.find(otherModule.schema, { withType: options.subtype });
          if (forwardJoin) {
            field.reverseOf = forwardJoin.name;
          }
        }
        if (field.reverseOf) {
          forwardJoin = _.find(otherModule.schema, { type: 'joinByOne', name: field.reverseOf });
          if (!forwardJoin) {
            fail('reverseOf property does not match the name property of any join in the schema for ' + field.withType + '. Hint: you are taking advantage of a join already being edited in the schema for that type, "reverse" must match "name".');
          }
          // Make sure the other join has any missing fields auto-supplied before
          // trying to access them
          self.validate([ forwardJoin ], { type: 'doc type', subtype: otherModule.name });
          field.idField = forwardJoin.idField;
        }
        if (!field.idField) {
          if (field.idsField) {
            fail('joinByOneReverse takes idField, not idsField. Hint: just use reverseOf instead and specify the name of the join you are reversing.');
          } else {
            fail('joinByOneReverse requires either the reverseOf option or the idField option. Hint: just use reverseOf and specify the name of the join you are reversing.');
          }
        }
        if (!forwardJoin) {
          forwardJoin = _.find(otherModule.schema, { type: 'joinByOne', idField: field.idField });
          if (!forwardJoin) {
            fail('idField property does not match the idField property of any join in the schema for ' + field.withType + '. Hint: you are taking advantage of a join already being edited in the schema for that type, your idField must be the same to find the data there.');
          }
        }
      }
    });

    self.addFieldType({
      name: 'joinByArray',
      convert: async function(req, field, data, object) {
        let manager = self.apos.docs.getManager(field.withType);
        if (!manager) {
          throw Error('join with type ' + field.withType + ' unrecognized');
        }
        if (_.has(data, field.name)) {
          const titlesOrIds = self.apos.launder.string(data[field.name]).split(/\s*,\s*/);
          if ((!titlesOrIds) || (titlesOrIds[0] === undefined)) {
            return;
          }
          let clauses = [];
          _.each(titlesOrIds, function(titleOrId) {
            clauses.push({ titleSortified: self.apos.utils.sortify(titleOrId) });
            clauses.push({ _id: titleOrId });
          });
          const results = await manager.find(req, { $or: clauses }, { _id: 1 }).joins(false).published(null).toArray();
          object[field.idsField] = _.pluck(results, '_id');
        } else {
          object[field.idsField] = self.apos.launder.ids(data[field.idsField]);
          if (!field.relationshipsField) {
            return;
          }
          object[field.relationshipsField] = {};
          if (field.removedIdsField) {
            object[field.removedIdsField] = self.apos.launder.ids(data[field.removedIdsField]);
          }
          const allIds = object[field.idsField];
          // We record relationships with things just removed to provide support
          // for properties of the removal action itself. (This might not be
          // essential now that we no longer implement a super-granular version
          // of "apply to subpages." That feature was a UX nightmare.)
          if (field.removedIdsField) {
            allIds = allIds.concat(object[field.removedIdsField] || []);
          }
          for (let id of allIds) {
            let e = data[field.relationshipsField] && data[field.relationshipsField][id];
            if (!e) {
              e = {};
            }
            // Validate the relationship (aw)
            const validatedRelationship = {};
            object[field.relationshipsField][id] = validatedRelationship;
            await self.convert(req, field.relationship, e, validatedRelationship);
          }
        }
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, field, 'join');
      },
      join: async function(req, field, objects, options) {
        return self.joinDriver(req, joinr.byArray, false, objects, field.idsField, field.relationshipsField, field.name, options);
      },
      addFilter: function(field, cursor) {

        addOperationFilter('', '$in');
        addOperationFilter('And', '$all');
        self.addJoinSlugFilter(field, cursor, '');
        self.addJoinSlugFilter(field, cursor, 'And');

        function addOperationFilter(suffix, operator) {
          return cursor.addFilter(field.name + suffix, {
            finalize: function() {

              if (!self.cursorFilterInterested(cursor, field.name + suffix)) {
                return;
              }

              const value = cursor.get(field.name + suffix);
              const criteria = {};
              // Even programmers appreciate shortcuts, so it's not enough that the
              // sanitizer (which doesn't apply to programmatic use) accepts these
              if (Array.isArray(value)) {
                criteria[field.idsField] = {};
                criteria[field.idsField][operator] = value;
              } else if (value === 'none') {
                criteria.$or = [];
                let clause = {};
                clause[field.idsField] = null;
                criteria.$or.push(clause);
                clause = {};
                clause[field.idsField] = { $exists: 0 };
                criteria.$or.push(clause);
                clause = {};
                clause[field.idsField + '.0'] = { $exists: 0 };
                criteria.$or.push(clause);
              } else {
                criteria[field.idsField] = { $in: [ value ] };
              }
              cursor.and(criteria);
            },
            choices: self.joinFilterChoices(field, cursor, '_id'),
            safeFor: 'manage',
            launder: joinFilterLaunder
          });
        }
      },
      validate: function(field, options, warn, fail) {
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.idsField) {
          if (field.idField) {
            fail('joinByArray takes idsField, not idField. You can also omit it, in which case a reasonable value is supplied.');
          }
          // Supply reasonable value
          field.idsField = field.name.replace(/^_/, '') + 'Ids';
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name. Join name will be plural,
          // so consider that too
          let withType = field.name.replace(/^_/, '').replace(/s$/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. Or omit it and give your join the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        if (!field.idsField) {
          fail('idsField property is missing. Hint: joinByArray takes idsField, NOT idField.');
        }
        if (!field.withType) {
          fail('withType property is missing. Hint: it must match the "name" property of a doc type.');
        }
        if (Array.isArray(field.withType)) {
          _.each(field.withType, function(type) {
            if (!_.find(self.apos.docs.managers, { name: type })) {
              fail('withType property, ' + type + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
            }
          });
        } else {
          if (!_.find(self.apos.docs.managers, { name: field.withType })) {
            fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
          }
        }
        if (field.relationship && (!field.relationshipsField)) {
          field.relationshipsField = field.name.replace(/^_/, '') + 'Relationships';
        }
        if (field.relationship && (!Array.isArray(field.relationship))) {
          // TODO more validation here
          fail('relationship field should be an array if present');
        }
      }
    });

    function joinFilterLaunder(v) {
      if (Array.isArray(v)) {
        return self.apos.launder.ids(v);
      } else if ((typeof (v) === 'string') && (v.length)) {
        return [ self.apos.launder.id(v) ];
      } else if (v === 'none') {
        return 'none';
      }
      return undefined;
    };

    function joinFilterSlugLaunder(v) {
      if (Array.isArray(v)) {
        return self.apos.launder.strings(v);
      } else if ((typeof (v) === 'string') && (v.length)) {
        return [ self.apos.launder.string(v) ];
      } else if (v === 'none') {
        return 'none';
      }
      return undefined;
    };

    // You don't need to call this. It returns an async function that, when later called
    // with no arguments, will give you filter choices based on the given field, cursor
    // and value field of interest. Join field types use this method to implement
    // their filter `choices`.

    self.joinFilterChoices = function(field, cursor, valueField) {
      return async function() {
        let idsField;
        if (field.type === 'joinByOne') {
          idsField = field.idField;
        } else {
          idsField = field.idsField;
        }
        const ids = await cursor.toDistinct(idsField);
        const manager = self.apos.docs.getManager(field.withType);
        const joinCursor = manager.find(cursor.req, { _id: { $in: ids } }).projection(manager.getAutocompleteProjection({ field: field }));
        if (field.filters) {
          _.each(field.filters, function(val, key) {
            joinCursor[key](val);
          });
        }
        const docs = await joinCursor.toArray();
        _.each(docs, function(doc) {
          doc.label = doc.title;
          doc.value = doc[valueField];
          delete doc.title;
          delete doc[valueField];
        });
        self.apos.utils.insensitiveSortByProperty(docs, 'label');
        return docs;
      }
    };

    // You don't need to call this. It is called for you as part of the mechanism that
    // adds cursor filter methods for all joins.
    //
    // If you named your join properly (leading _), you also get a filter
    // *without* the `_` that accepts slugs rather than ids - it's suitable
    // for public use in URLs (and it's good naming because the public would find the _ weird).
    //
    // If you're wondering, you should have had the leading _ anyway to keep it from
    // persisting the loaded data for the join back to your doc, which could easily blow
    // mongodb's doc size limit and in any case is out of data info in your database.
    //

    self.addJoinSlugFilter = function(field, cursor, suffix) {

      suffix = suffix || '';
      let name = field.name.replace(/^_/, '');

      if (name === field.name) {
        // Nope, your join is not well-named
        return;
      }
      if (cursor.filters[name + suffix]) {
        // Don't crush an existing filter by this name
        return;
      }

      cursor.addFilter(name + suffix, {
        prefinalize: async function() {
          if (!self.cursorFilterInterested(cursor, name + suffix)) {
            return;
          }
          const value = cursor.get(name + suffix);
          if (value === 'none') {
            cursor.set(field.name + suffix, 'none');
            cursor.set(name + suffix, undefined);
            return;
          }
          const joinCursor = self.apos.docs.getManager(field.withType).find(cursor.req).joins(false).areas(false);
          const criteria = {};
          // Even programmers appreciate shortcuts, so it's not enough that the
          // sanitizer (which doesn't apply to programmatic use) accepts these
          if (Array.isArray(value)) {
            criteria.slug = { $in: value };
          } else {
            criteria.slug = value;
          }
          joinCursor.and(criteria);
          joinCursor.projection({ _id: 1 });
          const docs = await joinCursor.toArray();
          cursor.set(field.name + suffix, _.map(docs, '_id'));
          cursor.set(name + suffix, undefined);
          return;
        },
        choices: self.joinFilterChoices(field, cursor, 'slug'),
        safeFor: 'manage',
        launder: joinFilterSlugLaunder
      });
    };

    self.addFieldType({
      name: 'joinByArrayReverse',
      join: async function(req, field, objects, options) {
        return self.joinDriver(req, joinr.byArrayReverse, true, objects, field.idsField, field.relationshipsField, field.name, options);
      },
      validate: function(field, options, warn, fail) {
        let forwardJoin;
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name
          let withType = field.name.replace(/^_/, '').replace(/s$/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. Or omit it and give your join the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        let otherModule = _.find(self.apos.docs.managers, { name: field.withType });
        if (!otherModule) {
          fail('withType property, ' + field.withType + ', does not match the "name" property of any doc type. Hint: this is not the same thing as a module name. Usually singular.');
        }
        if (!(field.reverseOf || field.idsField)) {
          self.validate(otherModule.schema, { type: 'doc type', subtype: otherModule.name });
          // Look for a join with our type in the other type
          forwardJoin = _.find(otherModule.schema, { withType: options.subtype });
          if (forwardJoin) {
            field.reverseOf = forwardJoin.name;
          }
        }
        if (field.reverseOf) {
          forwardJoin = _.find(otherModule.schema, { type: 'joinByArray', name: field.reverseOf });
          if (!forwardJoin) {
            fail('reverseOf property does not match the name property of any joinByArray in the schema for ' + field.withType + '. Hint: you are taking advantage of a join already being edited in the schema for that type, "reverse" must match "name".');
          }
          // Make sure the other join has any missing fields auto-supplied before
          // trying to access them
          self.validate([ forwardJoin ], { type: 'doc type', subtype: otherModule.name });
          field.idsField = forwardJoin.idsField;
        }
        if (!field.idsField) {
          if (field.idField) {
            fail('joinByOne takes reverseOf or idsField, not idField. Hint: just use reverseOf instead and specify the name of the join you are reversing.');
          }
          field.idsField = field.name.replace(/^_/, '') + 'Ids';
        }
        if (!forwardJoin) {
          forwardJoin = _.find(otherModule.schema, { type: 'joinByArray', idsField: field.idsField });
          if (!forwardJoin) {
            fail('idsField property does not match the idsField property of any join in the schema for ' + field.withType + '. Hint: you are taking advantage of a join already being edited in the schema for that type, your idField must be the same to find the data there.');
          }
        }
      }
    });

    // When a page is served to a logged-in user, make sure the session contains a blessing
    // for every join configured in schemas for doc types

    self.on('apostrophe-pages:serve', 'blessDocTypeSchemas', function(req) {
      if (req.user) {
        const managers = self.apos.docs.managers;
        _.each(managers, function(manager, name) {
          self.bless(req, manager.allowedSchema(req));
        });
      }
    });

    // Bless a schema. Makes a note in the user's session that
    // the various area, widget and array schema options found
    // within this schema are genuine. This allows the server to later
    // re-render those things based on new edits without the need
    // for sanitization of the options being sent back by the browser,
    // provided the option set was blessed in this manner.

    self.bless = function(req, schema) {
      _.each(schema, function(field) {
        const fieldType = self.fieldTypes[field.type];
        if (fieldType && fieldType.bless) {
          fieldType.bless(req, field);
        }
      });
    };

    // Fetch the distinct values for the specified property via the specified
    // cursor and sort them before returning them.
    //
    // Like `toDistinct`, but sorted. A convenience used by the standard filters
    // for many field types.

    self.sortedDistinct = async function(property, cursor) {
      const results = await cursor.toDistinct(property);
      self.apos.utils.insensitiveSort(results);
      return results;
    };

    // For most cursor filters, if the value is undefined or null,
    // the filter should do nothing. This method implements that test.

    self.cursorFilterInterested = function(cursor, name) {
      const value = cursor.get(name);
      return ((value !== undefined) && (value !== null));
    };

    // Validate schemas. We wait this long so that we can know if
    // `withType` and friends make sense

    self.on('apostrophe:afterInit', 'validateAllSchemas', function() {
      _.each(self.apos.docs.managers, function(manager, type) {
        self.validate(manager.schema, { type: 'doc type', subtype: type });
      });
      _.each(self.apos.areas.widgetManagers, function(manager, type) {
        self.validate(manager.schema, { type: 'widget type', subtype: type });
      });
    });

    self.validatedSchemas = {};

    // Validate a schema for errors. This is about validating the schema itself,
    // not a data object. For instance, a field without a type property is flagged.
    // Serious errors throw an exception, while certain lesser errors just print a message
    // to stderr for bc.
    //
    // This method may also prevent errors by automatically supplying
    // reasonable values for certain properties, such as the `idField` property
    // of a `joinByOne` field, or the `label` property of anything.

    self.validate = function(schema, options) {
      // Infinite recursion prevention
      if (self.validatedSchemas[options.type + ':' + options.subtype]) {
        return;
      }
      self.validatedSchemas[options.type + ':' + options.subtype] = true;

      _.each(schema, function(field) {
        const fieldType = self.fieldTypes[field.type];
        if (!fieldType) {
          fail('Unknown schema field type.');
        }
        if (!field.name) {
          fail('name property is missing.');
        }
        if ((!field.label) && (!field.contextual)) {
          field.label = _.startCase(field.name.replace(/^_/, ''));
        }
        if (fieldType.validate) {
          fieldType.validate(field, options, warn, fail);
        }
        function fail(s) {
          throw new Error(format(s));
        }
        function warn(s) {
          self.apos.utils.error(format(s));
        }
        function format(s) {
          return '\n' + options.type + ' ' + options.subtype + ', field name ' + field.name + ':\n\n' + s + '\n';
        }
      });
    };

  }
};
