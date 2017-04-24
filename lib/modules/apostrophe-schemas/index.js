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

var joinr = require('joinr');
var _ = require('lodash');
var async = require('async');
var moment = require('moment');

module.exports = {

  alias: 'schemas',

  afterConstruct: function(self) {
    self.createRoutes();
    self.pushAssets();
    self.pushCreateSingleton();
  },

  construct: function(self, options) {

    require('./lib/routes')(self, options);

    self.pushAssets = function() {

      self.pushAsset('script', 'user', { when: 'user' });
      self.pushAsset('script', 'array-modal', { when: 'user' });
      self.pushAsset('stylesheet', 'user', { when: 'user' });
    };

    self.pushCreateSingleton = function() {
      self.apos.push.browserCall('user', 'apos.create("apostrophe-schemas", ?)', { action: self.action });
    };

    // Compose a schema based on addFields, removeFields, orderFields
    // and, occasionally, alterFields options. This method is great for
    // merging the schema requirements of subclasses with the schema
    // requirements of a superclass. See the apostrophe-schemas documentation
    // for a thorough explanation of the use of each option. The
    // alterFields option should be avoided if your needs can be met
    // via another option.

    self.compose = function(options) {
      var schema = [];

      // Useful for finding good unit test cases
      // console.log(JSON.stringify(_.pick(options, 'addFields', 'removeFields', 'arrangeFields'), null, '  '));

      if (options.addFields) {
        // loop over our addFields
        _.each(options.addFields, function(field) {
          var i;
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
          var field = _.find(schema, function(field) {
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
      var defaultGroup = self.options.defaultGroup || {};
      var groups = [
        {
          name: defaultGroup.name || 'default',
          label: defaultGroup.label || 'Info',
          fields: _.pluck(schema, 'name')
        }
      ];

      // if we are getting arrangeFields and it's not empty
      if(options.arrangeFields && options.arrangeFields.length > 0) {
        // if it's full of strings, use them for the default group
        if( _.isString(options.arrangeFields[0]) ) {
          groups[0].fields = options.arrangeFields;
        // if it's full of objects, those are groups, so use them
        } else if(_.isPlainObject(options.arrangeFields[0])) {
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

      var newGroups = [];
      _.each(groups, function(group) {
        var index = _.findIndex(newGroups, { name: group.name });
        if (index !== -1) {
          newGroups.splice(index, 1);
        }
        var i = _.findIndex(newGroups, { last: true });
        if (i === -1) {
          i = groups.length;
        }
        newGroups.splice(i, 0, group);
      });
      groups = newGroups;

      // all fields in the schema will end up in this variable
      var newSchema = [];
      // loop over any groups and orders we want to respect
      _.each(groups, function(group) {

        _.each(group.fields, function(field) {
          // find the field we are ordering
          var f = _.find(schema, { name: field });
          if (!f) {
            // May have already been migrated due to subclasses re-grouping fields
            f = _.find(newSchema, { name: field });
          }

          // make sure it exists
          if (f) {
            // set the group for this field
            var g = _.clone(group, true);
            delete g.fields;
            f.group = g;

            // push the field to the new schema, if it is a
            // duplicate due to subclasses pushing more
            // groupings, remove the earlier instance
            var fIndex = _.findIndex(newSchema, { name: field });
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
        var g = _.clone(groups[0], true);
        delete g.fields;
        field.group = g;
      });

      // add any fields not in defined groups to the end of the schema
      schema = newSchema.concat(schema);

      // If a field is not consecutive with other fields in its group,
      // move it after the last already encountered in its group,
      // to simplify rendering logic

      newSchema = [];
      var groupIndexes = {};
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
          if (typeof(field.template) === 'string') {
            field.partial = self.partialer(field.template);
            delete field.template;
          } else {
            field.partial = field.template;
            delete field.template;
          }
        }

        // Extra validation for select fields, TODO move this into the field type definition

        if (field.type === 'select') {
          _.each(field.choices, function(choice){
            if (choice.showFields) {
              if (!_.isArray(choice.showFields)) {
                throw new Error('The \'showFields\' property in the choices of a select field needs to be an array.');
              }
              _.each(choice.showFields, function(showFieldName){
                if (!_.find(schema, function(schemaField){ return schemaField.name == showFieldName; })) {
                  console.error('WARNING: The field \'' + showFieldName + '\' does not exist in your schema, but you tried to toggle its display with a select field using showFields. STAAAHHHHPP!');
                }
              });
            }
          });
        }
      });
      return schema;
    };

    // refine is like compose, but it starts with an existing schema array
    // and amends it via the same options as compose.

    self.refine = function(schema, _options) {
      // Don't modify the original schema which may be in use elsewhere
      schema = _.cloneDeep(schema);
      // Deep clone is not required here, we just want
      // to modify the addFields property
      var options = _.clone(_options);
      options.addFields = schema.concat(options.addFields || []);
      // The arrangeFields option is trickier because we've already
      // done a compose() and so the groups are now denormalized as
      // properties of each field. Reconstruct the old
      // arrangeFields option so we can concatenate the new one
      var oldArrangeFields = [];
      _.each(schema, function(field) {
        if (field.group) {
          var group = _.find(oldArrangeFields, { name: field.group.name });
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
      if (fields.length == 0) {
        return [];
      }

      // bail if we're already in groups
      if (fields[0].type === 'group') {
        return fields;
      }

      var groups = [];
      var currentGroup = -1;
      _.each(fields, function(field){
        if (field.contextual) {
          return;
        }
        if (!field.group) {
          field.group = { name: 'default', label: 'info' };
        }
        // first group, or not the current group
        if (groups.length == 0 || (groups[currentGroup].name !== field.group.name)) {
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

      // check if we're already grouped
      if (schema[0].type === 'group') {
        // Don't modify the original schema which may be in use elsewhere
        groups = _.cloneDeep(schema);

        // loop over each group and remove fields from them that aren't in this subset
        _.each(groups, function(group) {
          group.fields = _.filter(group.fields, function(field){
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
      var def = {};
      _.each(schema, function(field) {
        if (field.def !== undefined) {
          def[field.name] = field.def;
        }
      });
      return def;
    };

    self.subsetInstance = function(schema, instance) {
      var subset = {};
      _.each(schema, function(field) {
        if (field.type === 'group') {
          return;
        }
        var subsetCopy = self.fieldTypes[field.type].subsetCopy;
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
          subsetCopy(name, instance, subset, field);
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
        var value = object[field.name];
        if ((value !== null) && (value !== undefined) && (value !== false)) {
          var emptyTest = self.fieldTypes[field.type].empty;
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
        var fieldType = self.fieldTypes[field.type];
        if (!fieldType.index) {
          return;
        }
        fieldType.index(object[field.name], field, texts);
      });
    };

    // Convert submitted `data`, sanitizing it and populating `object` with it
    self.convert = function(req, schema, from, data, object, callback) {
      if (arguments.length !== 6) {
        throw new Error("convert now takes 6 arguments, with req added in front and callback added at the end");
      }
      if (!req) {
        throw new Error("convert invoked without a req, do you have one in your context?");
      }
      // bc
      if (from === 'csv') {
        from = 'string';
      }
      return async.eachSeries(schema, function(field, callback) {
        // Fields that are contextual are edited in the context of a
        // show page and do not appear in regular schema forms. They are
        // however legitimate in imports, so we make sure it's a form import
        // and not a string import that we're skipping it for. We also have to
        // accept them when contextualConvertArea causes them to be
        // kicked upstairs into a contextual area save operation. So
        // if they are defined in the data, sanitize them normally;
        // otherwise leave them untouched. -Tom and Jimmy
        if (field.contextual && (from === 'form') && (!_.has(data, field.name))) {
          return setImmediate(callback);
        }
        var convert = self.fieldTypes[field.type].converters && self.fieldTypes[field.type].converters[from];
        if (!convert) {
          // whatever, some field types are not supported in some formats
          return setImmediate(callback);
        }
        return convert(req, data, field.name, object, field, callback);
      }, function(err) {
        return callback(err);
      });
    };

    // Export sanitized 'object' into 'output'
    self.export = function(req, schema, to, object, output, callback) {
      return async.eachSeries(schema, function(field, callback) {
        var exporter = self.fieldTypes[field.type].exporters && self.fieldTypes[field.type].exporters[to];
        if (!exporter) {
          // A type without an explicit exporter is not exported
          return setImmediate(callback);
        }
        if (exporter.length !== 6) {
          console.error(exporter.toString());
          throw new Error("Schema export methods must now take the following arguments: req, object, field, field.name, output, callback. They must also invoke the callback.");
        }
        return exporter(req, object, field, field.name, output, function(err) {
          return callback(err);
        });
      }, function(err) {
        return callback(err);
      });
    };

    // Driver invoked by the "join" methods of the standard
    // join field types.
    //
    // All arguments must be present, however relationshipsField
    // may be undefined to indicate none is needed.
    self.joinDriver = function(req, method, reverse, items, idField, relationshipsField, objectField, options, callback) {
      if (!options) {
        options = {};
      }
      var find = options.find;
      var filters = options.filters || {};
      var hints = options.hints || {};
      var getCriteria = options.getCriteria || {};
      // Some joinr methods don't take relationshipsField
      if (method.length === 5) {
        var realMethod = method;
        method = function(items, idField, relationshipsField, objectField, getter, callback) {
          return realMethod(items, idField, objectField, getter, callback);
        };
      }
      return method(items, idField, relationshipsField, objectField, function(ids, callback) {
        var idsCriteria = {};
        if (reverse) {
          idsCriteria[idField] = { $in: ids };
        } else {
          idsCriteria._id = { $in: ids };
        }
        var criteria = { $and: [ getCriteria, idsCriteria ] };
        var cursor = find(req, criteria);
        // Filters hardcoded as part of this join's blessed options don't
        // require any sanitization
        _.each(filters, function(val, key) {
          cursor[key](val);
        });
        // Hints, on the other hand, don't go through the blessing mechanism
        // so they must be sanitized
        cursor.queryToFilters(hints, 'manage');
        return cursor.toArray(callback);
      }, callback);
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

    self.join = function(req, schema, objectOrArray, withJoins, callback) {
      if (arguments.length === 3) {
        callback = withJoins;
        withJoins = undefined;
      }

      if (withJoins === false) {
        // Joins explicitly deactivated for this call
        return callback(null);
      }

      var objects = _.isArray(objectOrArray) ? objectOrArray : [ objectOrArray ];
      if (!objects.length) {
        // Don't waste effort
        return callback(null);
      }

      // build an array of joins of interest, found at any level
      // in the schema, even those nested in array schemas. Add
      // an _arrays property to each one which contains the names
      // of the array fields leading to this join, if any, so
      // we know where to store the results. Also set a
      // _dotPath property which can be used to identify relevant
      // joins when the withJoins option is present

      var joins = [];

      function findJoins(schema, arrays) {
        var _joins = _.filter(schema, function(field) {
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
          if (field.type === 'array') {
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

      var withJoinsNext = {};
      // Explicit withJoins option passed to us
      if (Array.isArray(withJoins)) {
        joins = _.filter(joins, function(join) {
          var dotPath = join._dotPath;
          var winner;
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

      return async.eachSeries(joins, function(join, callback) {
        var arrays = join._arrays;

        function findObjectsInArrays(objects, arrays) {
          if (!arrays) {
            return [];
          }
          if (!arrays.length) {
            return objects;
          }
          var array = arrays[0];
          var _objects = [];
          _.each(objects, function(object) {
            _objects = _objects.concat(object[array] || []);
          });
          return findObjectsInArrays(_objects, arrays.slice(1));
        }

        var _objects = findObjectsInArrays(objects, arrays);

        if (!join.name.match(/^_/)) {
          return callback(new Error('Joins should always be given names beginning with an underscore (_). Otherwise we would waste space in your database storing the results statically. There would also be a conflict with the array field withJoins syntax. Join name is: ' + join._dotPath));
        }

        var manager = self.apos.docs.getManager(join.withType);
        if (!manager) {
          return callback(new Error('I cannot find the instance type ' + join.withType));
        }

        // If it has a getter, use it, otherwise supply one
        var find = manager.find;

        var options = {
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
        return self.fieldTypes[join.type].join(req, join, _objects, options, callback);
      }, callback);
    };

    self.fieldTypes = {};

    // Add a new field type. The `type` object may contain the following properties:
    //
    // ### `name`
    //
    // Required. The name of the field type, such as `select`. Use a unique prefix to avoid
    // collisions with future official Apostrophe field types.
    //
    // ### `converters`
    //
    // Required. An object with  `string` and `form` sub-properties, functions which are invoked for
    // strings (as often needed for imports) and Apostrophe-specific form submissions respectively.
    // These are functions which accept:
    //
    // `req, data, name, object, field, callback`
    //
    // Sanitize the contents of `data[name]` and copy values
    // known to be safe to `object[name]`. Then invoke the callback.
    //
    // `field` contains the schema field definition, useful to access
    // `def`, `min`, `max`, etc.
    //
    // If `form` can use the same logic as `string` you may write:
    //
    // form: 'string'
    //
    // To reuse it.
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
    //```javascript
    // index: function(value, field, texts) {
    //   var silent = (field.silent === undefined) ? true : field.silent;
    //   texts.push({ weight: field.weight || 15, text: (value || []).join(' '), silent: silent });
    // }
    //```
    //
    // Note that areas are *always* indexed.

    self.addFieldType = function(type) {
      var fieldType = type;
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
          var value = fieldType.converters[key];
          if (typeof(value) === 'string') {
            if (value === 'csv') {
              // bc
              value = 'string';
            }
            fieldType.converters[key] = fieldType.converters[value];
          }
        });
      }
      self.fieldTypes[type.name] = fieldType;
    };

    self.getFieldType = function(typeName) {
      return self.fieldTypes[typeName];
    };

    self.addHelpers({
      toGroups: function(fields) {
        return self.toGroups(fields);
      },
      field: function(field) {
        // Alow custom partials for types and for individual fields
        var partial = field.partial || self.fieldTypes[field.type].partial;
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
        var fieldType = self.fieldTypes[field.type];
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
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.areas.fromPlaintext(data[name]);
          return setImmediate(callback);
        },
        form: function(req, data, name, object, field, callback) {
          var items = [];
          // accept either an array of items, or a complete
          // area object
          try {
            items = (data[name].type === 'area') ? data[name].items : data[name];
            if (!Array.isArray(items)) {
              items = [];
            }
          } catch (e) {
            // Always recover graciously and import something reasonable, like an empty area
          }
          return self.apos.areas.sanitizeItems(req, items, function(err, items) {
            if (err) {
              return callback(err);
            }
            object[name] = { items: items, type: 'area' };
            return callback(null);
          });
        }
      },
      empty: function(field, value) {
        return self.apos.areas.isEmpty({ area: area });
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
      empty: function(field, value) {
        return self.apos.areas.isEmptySingleton({ area: area, type: field.widgetType });
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, field.options || {}, 'widget', field.widgetType);
      }
    });

    self.addFieldType({
      name: 'string',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.string(data[name], field.def);
          if (field.min && (object[name].length < field.min)) {
            // Would be unpleasant, but shouldn't happen since the browser
            // also implements this. We're just checking for naughty scripts
            return callback('min');
          }
          if (field.max && (object[name].length > field.max)) {
            object[name] = object[name].substr(0, field.max);
          }
          return setImmediate(callback);
        },
        form: 'string'
      },
      exporters: {
        string: function(req, object, field, name, output, callback) {
          // no formatting, set the field
          output[name] = object[name];
          return setImmediate(callback);
        }
      },
      index: function(value, field, texts) {
        var silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: value, silent: silent });
      },
      empty: function(field, value) {
        return !value.length;
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
              criteria[field.name] = new RegExp(self.apos.utils.regExpQuote(cursor.get(field.name)), 'i');
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(s) {
            return self.apos.launder.string(s);
          },
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'slug',
      extend: 'string',
      converters: {
        // if field.page is true, expect a page slug (slashes allowed,
        // leading slash required). Otherwise, expect a object-style slug
        // (no slashes at all)
        string: function(req, data, name, object, field, callback) {
          var options = {};
          if (field.page) {
            options.allow = '/';
          }
          object[name] = self.apos.utils.slugify(self.apos.launder.string(data[name], field.def), options);
          if (field.page) {
            if (!(object[name].charAt(0) === '/')) {
              object[name] = '/' + object[name];
            }
            // No runs of slashes
            object[name] = object[name].replace(/\/+/g, '/');
            // No trailing slashes (except for root)
            if (object[name] !== '/') {
              object[name] = object[name].replace(/\/$/, '');
            }
          }
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
              var slugifyOptions = {};
              if (field.page) {
                slugifyOptions = { allow: '/' };
              }
              criteria[field.name] = new RegExp(self.apos.utils.regExpQuote(self.apos.utils.slugify(cursor.get(field.name), slugifyOptions)));
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'tags',
      converters: {
        string: function(req, data, name, object, field, callback) {
          var tags;
          tags = self.apos.launder.tags(data[name]);
          object[name] = tags;
          return setImmediate(callback);
        },
        form: function(req, data, name, object, field, callback) {

          var tags = self.apos.launder.tags(data[name]);

          //enforce limit if provided, take first N elements
          if (field.options && field.options.limit) {
            tags = tags.slice(0, field.options.limit);
          }

          if (!self.apos.tags.options.lock) {
            // It's OK to specify a tag that doesn't exist yet
            object[field.name] = tags;
            return setImmediate(callback);
          }

          // tags must exist

          return self.apos.tags.get(req, { tags: tags }, function(err, tags) {
            if (err) {
              return callback(err);
            }
            object[field.name] = tags;
            return callback(null);
          });
        },
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
              criteria[field.name] = { $in: cursor.get(field.name) };
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(tags) {
            var tags = self.apos.launder.tags(tags);
            if (!tags.length) {
              tags = null;
            }
            return tags;
          },
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          }
        });
      },
      index: function(value, field, texts) {
        // Make sure fields of type "tags" that aren't the default "tags" field participate
        // in search at some level
        var silent = (field.silent === undefined) ? true : field.silent;
        if (!Array.isArray(value)) {
          value = [];
        }
        texts.push({ weight: field.weight || 15, text: value.join(' '), silent: silent });
      },
      exporters: {
        string: function(req, object, field, name, output, callback) {
          // no formating, set the field
          output[name] = object[name].toString();
          return setImmediate(callback);
        }
      }
    });

    self.addFieldType({
      name: 'boolean',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.boolean(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'string'
      },
      empty: function(field, value) {
        return !value;
      },
      exporters: {
        string: function(req, object, field, name, output, callback) {
          output[name] = self.apos.launder.boolean(object[name]).toString();
          return setImmediate(callback);
        }
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (cursor.get(field.name) === false) {
              var criteria = {};
              criteria[field.name] = { $ne: true };
              cursor.and(criteria);
            } else if (cursor.get(field.name) === true) {
              var criteria = {};
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
          choices: function(callback) {
            return cursor.toDistinct(field.name, function(err, values) {
              if (err) {
                return callback(err);
              }
              var choices = [];
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
              return callback(null, choices);
            });
          }
        });
      }
    });

    self.addFieldType({
      name: 'checkboxes',
      converters: {
        string: function(req, data, name, object, field, callback) {
          data[name] = self.apos.launder.string(data[name]).split(',');

          if (!Array.isArray(data[name])) {
            object[name] = [];
            return setImmediate(callback);
          }

          object[name] = _.filter(data[name], function(choice) {
            return _.contains(_.pluck(field.choices, 'value'), choice);
          });

          return setImmediate(callback);
        },
        form: function(req, data, name, object, field, callback) {
          if (!Array.isArray(data[name])) {
            object[name] = [];
            return setImmediate(callback);
          }

          object[name] = _.filter(data[name], function(choice) {
            return _.contains(_.pluck(field.choices, 'value'), choice);
          });

          return setImmediate(callback);
        }
      },
      index: function(value, field, texts) {
        var silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: (value || []).join(' '), silent: silent });
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
              var v = cursor.get(field.name);
              // Allow programmers to pass just one value too (sanitize doesn't apply to them)
              if (!Array.isArray(v)) {
                v = [ v ];
              }
              criteria[field.name] = { $in:v };
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
          choices: function(callback) {
            return cursor.toDistinct(field.name, function(err, values) {
              if (err) {
                return callback(err);
              }
              var choices = _.map(values, function(value) {
                var choice = _.find(field.choices, { value: value });
                return {
                  value: value,
                  label: (choice && choice.label) || value
                };
              });
              self.apos.utils.insensitiveSortByProperty(choices, 'label');
              return callback(null, choices);
            });
          }
        });
      }
    });

    self.addFieldType({
      name: 'radioTable',
      converters: {
        form: function(req, data, name, object, field, callback) {
          var submission = (typeof(data[name]) === 'object') ? data[name] : {};
          // Now build up an object of clean content
          // { blog: 'admin', event: 'editor' }
          // type: radioTable,
          // def: 'ripe',
          // choices: [
          //   {
          //     label: 'Ripe',
          //     value: 'ripe'
          //   },
          //   {
          //     label: 'Underripe',
          //     value: 'underripe'
          //   }
          // ],
          // rows: [
          //   {
          //     name: 'apples',
          //     label: 'Apples'
          //   },
          //   {
          //     name: 'oranges',
          //     label: 'Oranges'
          //   }
          // ]
          var results = {};
          _.each(field.rows, function(row){
            if(_.has(submission, row.name)){
              results[row.name] = self.apos.launder.select(submission[row.name], field.choices, field.def);
            } else {
              results[row.name] = field.def;
            }
          });

          object[name] = results;
          return setImmediate(function() {
            return callback(null);
          });
        }
      }
    });

    self.addFieldType({
      name: 'select',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.select(data[name], field.choices, field.def);
          return setImmediate(callback);
        },
        form: 'string'
      },
      index: function(value, field, texts) {
        var silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: value, silent: silent });
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
              var v = cursor.get(field.name);
              // Allow programmers to pass just one value too (sanitize doesn't apply to them)
              if (!Array.isArray(v)) {
                v = [ v ];
              }
              criteria[field.name] = { $in:v };
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
          choices: function(callback) {
            return cursor.toDistinct(field.name, function(err, values) {
              if (err) {
                return callback(err);
              }
              var choices = _.map(values, function(value) {
                var choice = _.find(field.choices, { value: value });
                return {
                  value: value,
                  label: (choice && choice.label) || value
                };
              });
              self.apos.utils.insensitiveSortByProperty(choices, 'label');
              return callback(null, choices);
            });
          }
        });
      }
    });

    self.addFieldType({
      name: 'integer',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.integer(data[name], field.def, field.min, field.max);
          return setImmediate(callback);
        },
        form: 'string',
        addFilter: function(field, cursor) {
          return cursor.addFilter(field.name, {
            finalize: function() {
              var value = cursor.get(field.name);
              if ((value !== undefined) && (value !== null)) {
                if (Array.isArray(value) && (value.length === 2)) {
                  var criteria = {};
                  criteria[field.name] = { $gte: value[0], $lte: value[1] };
                } else {
                  var criteria = {};
                  criteria[field.name] = self.apos.launder.integer(value);
                  cursor.and(criteria);
                }
              }
            },
            choices: function(callback) {
              return self.sortedDistinct(field.name, cursor, callback);
            }
          });
        }
      }
    });

    self.addFieldType({
      name: 'float',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.float(data[name], field.def, field.min, field.max);
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            var value = cursor.get(field.name);
            if ((value !== undefined) && (value !== null)) {
              if (Array.isArray(value) && (value.length === 2)) {
                var criteria = {};
                criteria[field.name] = { $gte: value[0], $lte: value[1] };
              } else {
                var criteria = {};
                criteria[field.name] = self.apos.launder.float(value);
                cursor.and(criteria);
              }
            }
          },
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'url',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.url(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'string'
      },
      diffable: function(value) {
        // URLs are fine to diff and display
        if (typeof(value) === 'string') {
          return value;
        }
        // always return a valid string
        return '';
      },
      addFilter: function(field, cursor) {
        cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var criteria = {};
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
          choices: function(callback) {
            return self.sortDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'date',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.date(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var value = cursor.get(field.name);
              if (Array.isArray(value)) {
                var criteria = {};
                criteria[field.name] = { $gte: value[0], $lte: value[1] };
              } else {
                var criteria = {};
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
          choices: function(callback) {
            return self.sortDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'time',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.time(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'string'
      }
    });

    self.addFieldType({
      name: 'password',
      converters: {
        string: function(req, data, name, object, field, callback) {
          // This is the only field type that we never update unless
          // there is actually a new value — a blank password is not cool. -Tom
          if (data[name]) {
            object[name] = self.apos.launder.string(data[name], field.def);
          }
          return setImmediate(callback);
        },
        form: 'string'
      }
    });

    self.addFieldType({
      name: 'group'
      // visual grouping only
    });

    self.addFieldType({
      name: 'array',
      converters: {
        // no string converter, would be beyond awkward
        form: function(req, data, name, object, field, callback) {
          var schema = field.schema;
          data = data[name];
          if (!Array.isArray(data)) {
            data = [];
          }
          var results = [];
          if (field.limit && (data.length > field.limit)) {
            data = data.slice(0, field.limit);
          }
          return async.eachSeries(data, function(datum, callback) {
            var result = {};
            result.id = self.apos.launder.id(datum.id) || self.apos.utils.generateId();
            return self.convert(req, schema, 'form', datum, result, function(err) {
              if (err) {
                return callback(err);
              }
              results.push(result);
              return callback(null);
            });
          }, function(err) {
            object[name] = results;
            return callback(err);
          });
        }
      },
      empty: function(field, value) {
        return !value.length;
      },
      bless: function(req, field) {
        self.bless(req, field.schema || []);
      },
      index: function(value, field, texts) {
        _.each(value || [], function(item) {
          self.apos.schemas.indexFields(field.schema, item, texts);
        });
      }
    });

    self.addFieldType({
      name: 'joinByOne',
      converters: {
        string: function(req, data, name, object, field, callback) {
          var manager = self.apos.docs.getManager(field.withType);
          if (!manager) {
            return callback(new Error('join with type ' + field.withType + ' unrecognized'));
          }
          var titleOrId = self.apos.launder.string(data[name]);
          var criteria = { $or: [ { titleSortified: self.apos.utils.sortify(titleOrId) }, { _id: titleOrId } ] };
          return manager.find(req, criteria, { _id: 1 }).joins(false).published(null).toObject(function(err, result) {
            if (err) {
              return callback(err);
            }
            if (result) {
              object[field.idField] = result._id;
            } else {
              delete object[field.idField];
            }
            return callback(null);
          });
        },
        form: function(req, data, name, object, field, callback) {
          object[field.idField] = self.apos.launder.id(data[field.idField]);
          return setImmediate(callback);
        }
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, _.omit(field, 'hints'), 'join');
      },
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byOne, false, objects, field.idField, undefined, field.name, options, callback);
      },
      addFilter: function(field, cursor) {
        // for joinByOne only the "OR" case makes sense
        cursor.addFilter(field.name, {
          finalize: function() {
            if (!self.cursorFilterInterested(cursor, field.name)) {
              return;
            }
            var value = cursor.get(field.name);
            var criteria = {};
            // Even programmers appreciate shortcuts, so it's not enough that the
            // sanitizer (which doesn't apply to programmatic use) accepts these
            if (Array.isArray(value)) {
              criteria[field.idField] = { $in: value };
            } else if (value === 'none') {
              criteria.$or = [];
              var clause = {};
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
      }
    });

    self.addFieldType({
      name: 'joinByOneReverse',
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byOneReverse, true, objects, field.idField, undefined, field.name, options, callback);
      }
    });

    self.addFieldType({
      name: 'joinByArray',
      converters: {
        string: function(req, data, name, object, field, callback) {
          var manager = self.apos.docs.getManager(field.withType);
          if (!manager) {
            return callback(new Error('join with type ' + field.withType + ' unrecognized'));
          }
          var titlesOrIds = self.apos.launder.string(data[name]).split(/\s*,\s*/);
          if ((!titlesOrIds) || (titlesOrIds[0] === undefined)) {
            return setImmediate(callback);
          }
          var clauses = [];
          _.each(titlesOrIds, function(titleOrId) {
            clauses.push({ titleSortified: self.apos.utils.sortify(titleOrId) });
            clauses.push({ _id: titleOrId });
          });
          return manager.find(req, { $or: clauses }, { _id: 1 }).joins(false).published(null).toArray(function(err, results) {
            if (err) {
              return callback(err);
            }
            object[field.idsField] = _.pluck(results, '_id');
            return callback(null);
          });
        },
        form: function(req, data, name, object, field, callback) {
          object[field.idsField] = self.apos.launder.ids(data[field.idsField]);
          if (!field.relationshipsField) {
            return setImmediate(callback);
          }
          object[field.relationshipsField] = {};
          if (field.removedIdsField) {
            object[field.removedIdsField] = self.apos.launder.ids(data[field.removedIdsField]);
          }
          return async.series({
            relationships: function(callback) {
              var allIds = object[field.idsField];
              // Yes, we record relationships with things just removed. Some relationships
              // matter specifically at that time, like "apply to subpages" for
              // page permissions
              if (field.removedIdsField) {
                allIds = allIds.concat(object[field.removedIdsField] || []);
              }
              return async.eachSeries(allIds, function(id, callback) {
                var e = data[field.relationshipsField] && data[field.relationshipsField][id];
                if (!e) {
                  e = {};
                }
                // Validate the relationship (aw)
                var validatedRelationship = {};
                object[field.relationshipsField][id] = validatedRelationship;
                return self.convert(req, field.relationship, 'form', e, validatedRelationship, callback);
              }, callback);
            }
          }, callback);
        }
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, field, 'join');
      },
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byArray, false, objects, field.idsField, field.relationshipsField, field.name, options, callback);
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

              var value = cursor.get(field.name + suffix);
              var criteria = {};
              // Even programmers appreciate shortcuts, so it's not enough that the
              // sanitizer (which doesn't apply to programmatic use) accepts these
              if (Array.isArray(value)) {
                criteria[field.idsField] = {};
                criteria[field.idsField][operator] = value;
              } else if (value === 'none') {
                criteria.$or = [];
                var clause = {};
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
      }
    });
    
    function joinFilterLaunder(v) {
      if (Array.isArray(v)) {
        return self.apos.launder.ids(v);
      } else if ((typeof(v) === 'string') && (v.length)) {
        return [ self.apos.launder.id(v) ];
      } else if (v === 'none') {
        return 'none';
      }
      return undefined;
    };

    function joinFilterSlugLaunder(v) {
      if (Array.isArray(v)) {
        return self.apos.launder.strings(v);
      } else if ((typeof(v) === 'string') && (v.length)) {
        return [ self.apos.launder.string(v) ];
      } else if (v === 'none') {
        return 'none';
      }
      return undefined;
    };
    
    // You don't need to call this. It is called for you when you invoke `toChoices` for any
    // cursor filter based on a join. It delivers an array of choice objects to its callback.

    self.joinFilterChoices = function(field, cursor, valueField) {

      return function(callback) {
        var idsField;
        if (field.type === 'joinByOne') {
          idsField = field.idField;
        } else {
          idsField = field.idsField;
        }
        var ids;
        var docs;

        return async.series([
          distinct,
          fetch
        ], function(err) {
          if (err) {
            return callback(err);
          }
          _.each(docs, function(doc) {
            doc.label = doc.title;
            doc.value = doc[valueField];
            delete doc.title;
            delete doc[valueField];
          });
          self.apos.utils.insensitiveSortByProperty(docs, 'label');
          return callback(null, docs);
        });

        function distinct(callback) {
          return cursor.toDistinct(idsField, function(err, _ids) {
            if (err) {
              return callback(err);
            }
            ids = _ids;
            return callback(null);
          });
        }

        function fetch(callback) {
          var manager = self.apos.docs.getManager(field.withType);
          var joinCursor = manager.find(cursor.get('req'), { _id: { $in: ids } }).projection(manager.getAutocompleteProjection({ field: field }));
          if (field.filters) {
            _.each(field.filters, function(val, key) {
              joinCursor[key](val);
            });
          }
          return joinCursor.toArray(function(err, _docs) {
            if (err) {
              return callback(err);
            }
            docs = _docs;
            return callback(null);
          });
        }

      };
      
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

      var suffix = suffix || '';
      var name = field.name.replace(/^_/, '');
      
      if (name === field.name) {
        // Nope, your join is not well-named
        return;
      }
      if (cursor.filters[name + suffix]) {
        // Don't crush an existing filter by this name
        return;
      }
      
      cursor.addFilter(name + suffix, {
        finalize: function(callback) {
          if (!self.cursorFilterInterested(cursor, name + suffix)) {
            return callback(null);
          }
          var value = cursor.get(name + suffix);
          if (value === 'none') {
            cursor.set(field.name + suffix, 'none');
            cursor.set(name + suffix, undefined);
            return callback('refinalize');
          }
          var joinCursor = self.apos.docs.getManager(field.withType).find(cursor.get('req')).joins(false).areas(false);
          var criteria = {};
          // Even programmers appreciate shortcuts, so it's not enough that the
          // sanitizer (which doesn't apply to programmatic use) accepts these
          if (Array.isArray(value)) {
            criteria.slug = { $in: value };
          } else {
            criteria.slug = value;
          }
          joinCursor.and(criteria);
          joinCursor.projection({ _id: 1 });
          return joinCursor.toArray(function(err, docs) {
            if (err) {
              return callback(err);
            }
            cursor.set(field.name + suffix, _.pluck(docs, '_id'));
            cursor.set(name + suffix, undefined);
            return callback('refinalize');
          });
        },
        choices: self.joinFilterChoices(field, cursor, 'slug'),
        safeFor: 'manage',
        launder: joinFilterSlugLaunder
      });
    };

    self.addFieldType({
      name: 'joinByArrayReverse',
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byArrayReverse, true, objects, field.idsField, field.relationshipsField, field.name, options, callback);
      }
    });

    // When a page is served to a logged-in user, make sure the session contains a blessing
    // for every join configured in schemas for doc types

    self.pageServe = function(req) {
      if (req.user) {
        var managers = self.apos.docs.managers;
        _.each(managers, function(manager, name) {
          var schema = manager.schema;
          self.bless(req, manager.allowedSchema(req));
        });
      }
    };

    // Bless a schema. Makes a note in the user's session that
    // the various area, widget and array schema options found
    // within this schema are genuine. This allows the server to later
    // re-render those things based on new edits without the need
    // for sanitization of the options being sent back by the browser,
    // provided the option set was blessed in this manner.

    self.bless = function(req, schema) {
      _.each(schema, function(field) {
        var fieldType = self.fieldTypes[field.type];
        if (fieldType && fieldType.bless) {
          fieldType.bless(req, field);
        }
      });
    };
    
    // Fetch the distinct values for the specified property via the specified
    // cursor and sort them before delivering them to the callback as the
    // second argument. Like `toDistinct`, but sorted. A convenience used
    // by the standard filters for many field types.

    self.sortedDistinct = function(property, cursor, callback) {
      return cursor.toDistinct(property, function(err, results) {
        if (err) {
          return callback(err);
        }
        self.apos.utils.insensitiveSort(results);
        return callback(null, results);
      });
    };
    
    // For most cursor filters, if the value is undefined or null,
    // the filter should do nothing. This method implements that test.

    self.cursorFilterInterested = function(cursor, name) {
      var value = cursor.get(name);
      return ((value !== undefined) && (value !== null));
    };

  }
};
