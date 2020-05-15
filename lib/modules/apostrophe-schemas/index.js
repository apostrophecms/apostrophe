// This module provides schemas, a flexible and fast way to create new data types
// by specifying the fields that should make them up. Schemas power
// [apostrophe-pieces](/reference/modules/apostrophe-pieces),
// [apostrophe-widgets](/reference/modules/apostrophe-widgets), custom field
// types in page settings for [apostrophe-custom-pages](/reference/modules/apostrophe-custom-pages)
// and more.
//
// A schema is simply an array of "plain old objects." Each object describes one field in the schema
// via `type`, `name`, `label` and other properties.
//
// See the [schema guide](/advanced-topics/schema-guide.md) for a complete
// overview and list of schema field types. The methods documented here on this page are most often
// used when you choose to work independently with schemas, such as in a custom project
// that requires forms.

var joinr = require('joinr');
var _ = require('@sailshq/lodash');
var async = require('async');
var moment = require('moment');
var tinycolor = require('tinycolor2');
var Promise = require('bluebird');

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
    //
    // If present, the `module` option is used to resolve method
    // names lacking a module name, for instance when a method name
    // is given for the `choices` property of a `select` field.

    self.compose = function(options, module) {
      var schema = [];

      // Useful for finding good unit test cases
      // self.apos.utils.log(JSON.stringify(_.pick(options, 'addFields', 'removeFields', 'arrangeFields'), null, '  '));

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
          if (typeof (field.template) === 'string') {
            field.partial = self.partialer(field.template);
            delete field.template;
          } else {
            field.partial = field.template;
            delete field.template;
          }
        }

      });

      // Shallowly clone the fields. This allows modules
      // like workflow to patch schema fields of various modules
      // without inadvertently impacting other apos instances
      // when running with apostrophe-multisite
      schema = _.map(schema, function(field) {
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
    };

    // Recursively set moduleName property of the field and any subfields,
    // as might be found in array or object fields. `module` is an actual module

    self.setModuleName = function(field, module) {
      field.moduleName = field.moduleName || (module && module.__meta.name);
      if ((field.type === 'array') || (field.type === 'object')) {
        _.each(field.schema || [], function(subfield) {
          self.setModuleName(subfield, module);
        });
      }
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
      if (fields.length === 0) {
        return [];
      }

      // bail if we're already in groups
      if (fields[0].type === 'group') {
        return fields;
      }

      var groups = [];
      var currentGroup = -1;
      _.each(fields, function(field) {
        if (field.contextual) {
          return;
        }
        if (self.fieldTypes[field.type].ui === false) {
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
    // in `fields`. If `fields` contains a property that is not a
    // field name but does match the `idField` or `idsField` property
    // of a field, that also includes the field in the subset. This is
    // convenient when basing this call on the keys in `req.body`.

    self.subset = function(schema, fields) {

      var groups;

      if (!schema.length) {
        // Do not crash on empty input
        return [];
      }

      // check if we're already grouped
      if (schema[0].type === 'group') {
        // Don't modify the original schema which may be in use elsewhere
        groups = _.cloneDeep(schema);

        // loop over each group and remove fields from them that aren't in this subset
        _.each(groups, function(group) {
          group.fields = _.filter(group.fields, function(field) {
            return includes(fields, field);
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
          return includes(fields, field);
        });
      }

      function includes(fields, field) {
        return _.includes(fields, field.name) || (field.idField && _.includes(fields, field.idField)) || (field.idsField && _.includes(fields, field.idsField));
      }

    };

    // Return a new object with all default settings
    // defined in the schema
    self.newInstance = function(schema) {
      var def = {};
      _.each(schema, function(field) {
        var fieldType = self.fieldTypes[field.type];
        if (field.def !== undefined) {
          def[field.name] = field.def;
        } else if (fieldType.getDefault) {
          def[field.name] = fieldType.getDefault();
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

    // Convert submitted `data`, sanitizing it and populating `object` with it.

    self.convert = function(req, schema, from, data, object, callback) {
      if (!req) {
        throw new Error("convert invoked without a req, do you have one in your context?");
      }
      // bc
      if (from === 'csv') {
        from = 'string';
      }
      var errors = {};
      return async.eachSeries(schema, function(field, callback) {
        if (field.readOnly) {
          return setImmediate(callback);
        }
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
        return convert(req, data, field.name, object, field, function(err) {
          if (err) {
            errors[field.name] = err;
            return callback(null);
          }
          return callback(err);
        });
      }, function(err) {
        if (err) {
          // Not expected, errors accumulate in the errors object
          return callback(err);
        }
        var finalError;
        _.each(errors, function(err, name) {
          if ((typeof err) === 'string') {
            // We care if it's a "required" error, ignore any nested
            // property name prepended to it
            var visibilityError = err.split('.').pop();
            if ((visibilityError === 'required') && (!self.isVisible(schema, object, name))) {
              // It is not reasonable to enforce required for
              // fields hidden via showFields
            } else if (req.tolerantSanitization && (err !== 'error')) {
              data[name] = _.find(schema, { name: name }).def;
            } else {
              finalError = name + '.' + err;
            }
          } else {
            finalError = err;
          }
          if (finalError) {
            return false;
          }
        });
        return callback(finalError);
      });
    };

    // Determine whether the given field is visible
    // based on showFields options of all fields

    self.isVisible = function(schema, object, name) {
      var hidden = {};
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
        var field = _.find(schema, { name: name });
        if (!field) {
          // Do not crash. The linter at startup also catches this,
          // but is a nonfatal warning for bc, so we should also catch it
          self.apos.utils.warnDev('⚠️ showFields misconfigured, attempts to show/hide ' + name + ' which does not exist');
          return;
        }
        _.each(field.choices || [], function(choice) {
          _.each(choice.showFields || [], function(name) {
            hide(name);
          });
        });
      }
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
          self.apos.utils.error(exporter.toString());
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
        if (Array.isArray(join.withType)) {
          // Polymorphic join
          return async.eachSeries(join.withType, function(type, callback) {
            var manager = self.apos.docs.getManager(type);
            if (!manager) {
              return callback(new Error('I cannot find the instance type ' + type));
            }
            var find;
            if ((join.type === 'joinByOne') || (join.type === 'joinByArray')) {
              find = function(req, criteria, projection) {
                // For these types, the order is implicit (there is one match)
                // or explicit (handpicked id order), and sort() is not
                // useful in either case; the default sort can lead MongoDB
                // to make bad index choices
                return manager.find(req, criteria, projection).sort(false);
              };
            } else {
              find = manager.find;
            }

            var options = {
              find: find,
              filters: {
                joins: withJoinsNext[join._dotPath] || false
              },
              hints: {}
            };
            var subname = join.name + ':' + type;
            var _join = _.assign({}, join, {
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
            return self.fieldTypes[_join.type].join(req, _join, _objects, options, function(err) {
              if (err) {
                return callback();
              }
              _.each(_objects, function(object) {
                if (object[subname]) {
                  if (Array.isArray(object[subname])) {
                    object[join.name] = (object[join.name] || []).concat(object[subname]);
                  } else {
                    object[join.name] = object[subname];
                  }
                }
              });
              return callback(null);
            });
          }, function(err) {
            if (err) {
              return callback(err);
            }
            if (join.idsField) {
              _.each(_objects, function(object) {
                if (object[join.name]) {
                  object[join.name] = self.apos.utils.orderById(object[join.idsField], object[join.name]);
                }
              });
            }
            return callback(null);
          });
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

        // For reverse joins with a projection, it is common for
        // developers to leave out the idField or idsField without
        // which the join can't work, especially since `reverseOf`
        // was introduced, making it less likely that the developer
        // is thinking about these automatic properties

        if (join.type === 'joinByOneReverse') {
          const projection = options.filters && options.filters.projection;
          if (projection) {
            const keys = Object.keys(projection);
            // If there is a nonempty projection and the first
            // thing projected is omitted (falsy) rather than included
            // (truthy), then we should not try to add an inclusion,
            // because mongo only allows one or the other
            if ((!keys.length) || projection[keys[0]]) {
              projection[join.idField] = 1;
            }
          }
        } else if (join.type === 'joinByArrayReverse') {
          const projection = options.filters && options.filters.projection;
          if (projection) {
            const keys = Object.keys(projection);
            // If there is a nonempty projection and the first
            // thing projected is omitted (falsy) rather than included
            // (truthy), then we should not try to add an inclusion,
            // because mongo only allows one or the other
            if ((!keys.length) || projection[keys[0]]) {
              projection[join.idsField] = 1;
            }
          }
        }
        // Allow options to the getter to be specified in the schema,
        // notably editable: true
        return self.fieldTypes[join.type].join(req, join, _objects, options, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        _.each(joins, function(join) {
          // Don't confuse the blessing mechanism
          delete join._arrays;
          delete join._dotPath;
        });
        return callback(err);
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
    // ```javascript
    // index: function(value, field, texts) {
    //   var silent = (field.silent === undefined) ? true : field.silent;
    //   texts.push({ weight: field.weight || 15, text: (value || []).join(' '), silent: silent });
    // }
    // ```
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
          if (field.importAsRichText) {
            object[name] = self.apos.areas.fromRichText(data[name]);
          } else {
            object[name] = self.apos.areas.fromPlaintext(data[name]);
          }
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
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.string(data[name]);
          if (object[name] && field.min && (object[name].length < field.min)) {
            // Would be unpleasant, but shouldn't happen since the browser
            // also implements this. We're just checking for naughty scripts
            return callback('min');
          }
          // If max is longer than allowed, trim the value down to the max length
          if (object[name] && field.max && (object[name].length > field.max)) {
            object[name] = object[name].substr(0, field.max);
          }
          // If field is required but empty (and client side didn't catch that)
          // This is new and until now if JS client side failed, then it would
          // allow the save with empty values -Lars
          if (field.required && ((data[name] == null) || !data[name].toString().length)) {
            return callback('required');
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
      isEmpty: function(field, value) {
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
          object[name] = self.apos.utils.slugify(self.apos.launder.string(data[name]), options);
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
          if (field.prefix && object[name].length) {
            if (object[name].substring(0, field.prefix.length) !== field.prefix) {
              return callback('prefix');
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

          // enforce limit if provided, take first N elements
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
        }
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
            tags = self.apos.launder.tags(tags);
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
          object[name] = self.apos.launder.boolean(data[name]);
          if (field.mandatory && object[name] === false) {
            return callback('mandatory');
          }
          return setImmediate(callback);
        },
        form: 'string'
      },
      isEmpty: function(field, value) {
        return !value;
      },
      exporters: {
        string: function(req, object, field, name, output, callback) {
          output[name] = self.apos.launder.boolean(object[name]).toString();
          return setImmediate(callback);
        }
      },
      addFilter: function(field, cursor) {
        var criteria;
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
      },
      validate: function(field, options, warn, fail, schema) {
        if (!field.choices) {
          // optional for booleans
          return;
        }
        if (!Array.isArray(field.choices)) {
          warn('If present, field.choices must be an array');
          return;
        }
        _.each(field.choices, function(choice) {
          _.each(choice.showFields || [], function(name) {
            if (!_.find(schema, { name: name })) {
              warn('showFields includes ' + name + ', a field that does not exist in the schema');
            }
          });
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

          return Promise.try(function() {
            if ((typeof field.choices) === 'string') {
              return self.apos.modules[field.moduleName][field.choices](req, field);
            } else {
              return field.choices;
            }
          }).then(function(choices) {
            object[name] = _.filter(data[name], function(choice) {
              return _.contains(_.pluck(choices, 'value'), choice);
            });
            return setImmediate(callback);
          }).catch(callback);
        },
        form: function(req, data, name, object, field, callback) {
          if (!Array.isArray(data[name])) {
            object[name] = [];
            return setImmediate(callback);
          }
          return Promise.try(function() {
            if ((typeof field.choices) === 'string') {
              return self.apos.modules[field.moduleName][field.choices](req, field);
            } else {
              return field.choices;
            }
          }).then(function(choices) {
            object[name] = _.filter(data[name], function(choice) {
              return _.contains(_.pluck(choices, 'value'), choice);
            });
            return setImmediate(callback);
          }).catch(callback);
        }
      },
      index: function(value, field, texts) {
        var silent = (field.silent === undefined) ? true : field.silent;
        var text = Array.isArray(value) ? value : [];
        texts.push({ weight: field.weight || 15, text: text.join(' '), silent: silent });
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
              criteria[field.name] = { $in: v };
              cursor.and(criteria);
            }
          },
          safeFor: 'manage',
          launder: function(value) {
            // Support one or many
            if (Array.isArray(value)) {
              return _.map(value, function(v) {
                return (typeof field.choices) === 'string'
                  ? self.apos.launder.string(v)
                  : self.apos.launder.select(v, field.choices, field.def);
              });
            } else {
              value = (typeof field.choices) === 'string'
                ? self.apos.launder.string(value)
                : self.apos.launder.select(value, field.choices, field.def);
              return [ value ];
            }
          },
          choices: function(callback) {
            Promise.try(function() {
              if ((typeof field.choices) === 'string') {
                return self.apos.modules[field.moduleName][field.choices](cursor.get('req'), field);
              } else {
                return field.choices;
              }
            }).then(function(allChoices) {
              return cursor.toDistinct(field.name, function(err, values) {
                if (err) {
                  return callback(err);
                }
                var choices = _.map(values, function(value) {
                  var choice = _.find(allChoices, { value: value });
                  return {
                    value: value,
                    label: (choice && choice.label) || value
                  };
                });
                self.apos.utils.insensitiveSortByProperty(choices, 'label');
                return callback(null, choices);
              });
            }).catch(callback);
          }
        });
      },
      validate: function(field, options, warn, fail, schema) {
        if (!field.choices) {
          warn('choices property is missing for field of type checkboxes');
          return;
        }
        if (typeof field.choices === 'string') {
          // A module method name that will return the choices dynamically later
          return;
        }
        if (!Array.isArray(field.choices)) {
          warn('field.choices must be an array, or a string giving the name of the method of your module that returns a promise for the choices array');
          return;
        }
        _.each(field.choices || [], function(choice) {
          _.each(choice.showFields || [], function(name) {
            if (!_.find(schema, { name: name })) {
              warn('showFields for the choice ' + choice.value + ' includes ' + name + ', a field that does not exist in the schema');
            }
          });
        });
      },
      bless: function(req, field) {
        if ((typeof field.choices) === 'string') {
          self.apos.utils.bless(req, field, 'field');
        }
      }
    });

    self.addFieldType({
      name: 'radioTable',
      converters: {
        form: function(req, data, name, object, field, callback) {
          var submission = (typeof (data[name]) === 'object') ? data[name] : {};
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
          _.each(field.rows, function(row) {
            if (_.has(submission, row.name)) {
              results[row.name] = self.apos.launder.select(submission[row.name], field.choices);
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
          return Promise.try(function() {
            if ((typeof field.choices) === 'string') {
              return self.apos.modules[field.moduleName][field.choices](req, field);
            } else {
              return field.choices;
            }
          }).then(function(choices) {
            object[name] = self.apos.launder.select(data[name], choices);
            return setImmediate(callback);
          }).catch(callback);
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
              value = (typeof field.choices) === 'string'
                ? self.apos.launder.string(value)
                : self.apos.launder.select(value, field.choices, null);

              if (value === null) {
                return null;
              }
              return [ value ];
            }
          },
          choices: function(callback) {
            Promise.try(function() {
              if ((typeof field.choices) === 'string') {
                return self.apos.modules[field.moduleName][field.choices](cursor.get('req'), field);
              } else {
                return field.choices;
              }
            }).then(function(allChoices) {
              return cursor.toDistinct(field.name, function(err, values) {
                if (err) {
                  return callback(err);
                }
                var choices = _.map(values, function(value) {
                  var choice = _.find(allChoices, { value: value });
                  return {
                    value: value,
                    label: (choice && choice.label) || value
                  };
                });
                self.apos.utils.insensitiveSortByProperty(choices, 'label');
                return callback(null, choices);
              });
            }).catch(callback);
          }
        });
      },
      validate: function(field, options, warn, fail, schema) {
        if (!field.choices) {
          warn('choices property is missing for field of type select');
          return;
        }
        if (typeof field.choices === 'string') {
          // A module method name that will return the choices dynamically later
          return;
        }
        if (!Array.isArray(field.choices)) {
          warn('field.choices must be an array, or a string giving the name of the method of your module that returns a promise for the choices array');
          return;
        }
        _.each(field.choices, function(choice) {
          _.each(choice.showFields || [], function(name) {
            if (!_.find(schema, { name: name })) {
              warn('showFields for the choice ' + choice.value + ' includes ' + name + ', a field that does not exist in the schema');
            }
          });
        });
      },
      bless: function(req, field) {
        if ((typeof field.choices) === 'string') {
          self.apos.utils.bless(req, field, 'field');
        }
      }
    });

    self.addFieldType({
      name: 'integer',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.integer(data[name], undefined, field.min, field.max);
          if (field.required && ((data[name] == null) || !data[name].toString().length)) {
            return callback('required');
          }
          if (data[name] && isNaN(parseFloat(data[name]))) {
            return callback('invalid');
          }
          // This makes it possible to have a field that is not required, but min / max defined
          // This allows the form to be saved and sets the value to null if no value was given by
          // the user.
          if (!data[name] && data[name] !== 0) {
            object[name] = null;
          }
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            var criteria;
            var value = cursor.get(field.name);
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
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          },
          launder: function(s) {
            return self.apos.launder.integer(s, null);
          }
        });
      }
    });

    self.addFieldType({
      name: 'float',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.float(data[name], undefined, field.min, field.max);
          if (field.required && ((data[name] == null) || !data[name].toString().length)) {
            return callback('required');
          }
          if (data[name] && isNaN(parseFloat(data[name]))) {
            return callback('invalid');
          }
          if (!data[name] && data[name] !== 0) {
            object[name] = null;
          }
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            var criteria;
            var value = cursor.get(field.name);
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
          choices: function(callback) {
            return self.sortedDistinct(field.name, cursor, callback);
          }
        });
      }
    });

    self.addFieldType({
      name: 'email',
      converters: {
        string: function (req, data, name, object, field, callback) {
          data[name] = self.apos.launder.string(data[name], undefined, field.min, field.max);

          if (!data[name].length) {
            if (field.required) {
              return callback('required');
            }
            object[name] = data[name];
            return callback(null);
          }

          // regex source: https://emailregex.com/
          // eslint-disable-next-line no-useless-escape
          var matches = data[name].match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
          if (!matches) {
            return callback('invalid');
          }
          object[name] = data[name];
          return setImmediate(callback);
        },
        form: 'string'
      }
    });

    self.addFieldType({
      name: 'color',
      converters: {
        string: function (req, data, name, object, field, callback) {
          var test = self.apos.launder.string(data[name]);
          if (tinycolor(test).isValid()) {
            object[name] = test;
          } else {
            object[name] = null;
          }
          return setImmediate(callback);
        },
        form: 'string'
      }
    });

    self.addFieldType({
      name: 'range',
      converters: {
        string: function (req, data, name, object, field, callback) {
          object[name] = self.apos.launder.float(data[name], undefined, field.min, field.max);
          return setImmediate(callback);
        },
        form: 'string'
      }
    });

    self.addFieldType({
      name: 'url',
      converters: {
        string: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.url(data[name]);
          return setImmediate(callback);
        },
        form: 'string'
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
          if (!data[name]) {
            object[name] = null;

            return setImmediate(callback);
          }

          object[name] = self.apos.launder.date(data[name]);
          return setImmediate(callback);
        },
        form: 'string'
      },
      addFilter: function(field, cursor) {
        return cursor.addFilter(field.name, {
          finalize: function() {
            if (self.cursorFilterInterested(cursor, field.name)) {
              var value = cursor.get(field.name);
              var criteria;
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
          if (!data[name]) {
            object[name] = null;

            return setImmediate(callback);
          }

          object[name] = self.apos.launder.time(data[name]);
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
            object[name] = self.apos.launder.string(data[name]);
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
          var i = 0;
          return async.eachSeries(data, function(datum, callback) {
            var result = {};
            result.id = self.apos.launder.id(datum.id) || self.apos.utils.generateId();
            return self.convert(req, schema, 'form', datum, result, function(err) {
              if (err) {
                if ((typeof err) === 'string') {
                  return callback(i + '.' + err);
                } else {
                  return callback(err);
                }
              }
              i++;
              results.push(result);
              return callback(null);
            });
          }, function(err) {
            object[name] = results;
            if (field.required && (results.length === 0)) {
              // Do not use Error constructor, this is always intentionally a string error for
              // comparison purposes and network friendliness
              return callback('required');
            }
            return callback(err);
          });
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
      },
      getDefault: function() {
        return [];
      },
      validate: function(field, options, warn, fail) {
        if (!field.schema) {
          warn('Field of type array has no schema property');
        }
        self.validate(field.schema, {
          subtype: options.subtype ? (options.subtype + '.' + field.name) : field.name
        });
      }
    });

    self.addFieldType({
      name: 'object',
      converters: {
        form: function(req, data, name, object, field, callback) {
          var schema = field.schema;
          data = data[name];
          if (data == null || typeof data !== 'object' || Array.isArray(data)) {
            data = {};
          }
          var result = {};
          return self.convert(req, schema, 'form', data, result, function(err) {
            if (err) {
              return callback(err);
            }
            object[name] = result;
            return callback(null);
          });
        }
      },
      getDefault: function() {
        return {};
      },
      validate: function(field, options, warn, fail) {
        if (!field.schema) {
          warn('Field of type object has no schema property');
        }
        self.validate(field.schema, {
          type: options.type,
          subtype: options.subtype ? (options.subtype + '.' + field.name) : field.name
        });
      },
      bless: function (req, field) {
        // Bless nested field types inside object.
        _.each(field.schema || [], function (field) {
          const fieldType = field.type;
          if (self.fieldTypes[fieldType].bless) {
            self.fieldTypes[fieldType].bless(req, field);
          }
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
          return manager.find(req, criteria, { _id: 1 }).sort(false).joins(false).published(null).toObject(function(err, result) {
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
          const value = self.apos.launder.id(data[field.idField]);

          if (field.required && _.isEmpty(value)) {
            return callback("required");
          }

          object[field.idField] = value;
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
          var withType = field.name.replace(/^_/, '');
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
      ui: false,
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byOneReverse, true, objects, field.idField, undefined, field.name, options, callback);
      },
      validate: function(field, options, warn, fail) {
        var forwardJoin;
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name
          var withType = field.name.replace(/^_/, '').replace(/s$/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type.  Or omit it and give your join the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        var otherModule = _.find(self.apos.docs.managers, { name: field.withType });
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
          self.validate(otherModule.schema, { type: 'doc type', subtype: otherModule.name });
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
        _.each(field.relationship, function (elem) {
          if (elem.schema) {
            self.bless(req, elem.schema);
          }
        });
        if (field.relationship) {
          self.bless(req, field.relationship);
        }
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
          var withType = field.name.replace(/^_/, '').replace(/s$/, '');
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

      suffix = suffix || '';
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
      ui: false,
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byArrayReverse, true, objects, field.idsField, field.relationshipsField, field.name, options, callback);
      },
      validate: function(field, options, warn, fail) {
        var forwardJoin;
        if (!field.name.match(/^_/)) {
          warn('Name of join field does not start with _. This is permitted for bc but it will fill your database with duplicate outdated data. Please fix it.');
        }
        if (!field.withType) {
          // Try to supply reasonable value based on join name
          var withType = field.name.replace(/^_/, '').replace(/s$/, '');
          if (!_.find(self.apos.docs.managers, { name: withType })) {
            fail('withType property is missing. Hint: it must match the "name" property of a doc type. Or omit it and give your join the same name as the other type, with a leading _ and optional trailing s.');
          }
          field.withType = withType;
        }
        var otherModule = _.find(self.apos.docs.managers, { name: field.withType });
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

    self.pageServe = function(req) {
      if (req.user) {
        var managers = self.apos.docs.managers;
        _.each(managers, function(manager, name) {
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

    // Validate schemas. We wait this long so that we can know if
    // `withType` and friends make sense

    self.afterInit = function() {
      _.each(self.apos.docs.managers, function(manager, type) {
        self.validate(manager.schema, { type: 'doc type', subtype: type });
      });
      _.each(self.apos.areas.widgetManagers, function(manager, type) {
        self.validate(manager.schema, { type: 'widget type', subtype: type });
      });
    };

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
      var unarranged = [];
      _.each(schema, function(field) {
        var fieldType = self.fieldTypes[field.type];
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
          fieldType.validate(field, options, warn, fail, schema);
        }
        // If at least one field is in a non-default group and this one is in the
        // default group, complain about halfassed grouping. The "Info" tab indicates
        // insufficient UX consideration, unless it contains all the fields, which
        // usually indicates a simple array schema that does not need any groups.
        // Don't ding the developer for things that aren't their fault and are
        // probably not that obnoxious in practice, like the withTags field of all
        // pieces-pages, which is usually alone in the default group.
        if (
          field.group &&
            (!field.contextual) &&
            (field.name !== 'withTags') &&
            (!field.type.match(/Reverse$/)) &&
            (field.group.name === 'default') &&
            (_.find(schema, function(field) {
              return (field.group) && (field.group.name !== 'default');
            }))) {
          unarranged.push(field);
        }
        function fail(s) {
          throw new Error(format(s));
        }
        function warn(s) {
          self.apos.utils.warnDev(format(s));
        }
        function format(s) {
          return '\n⚠️  ' + options.type + ' ' + options.subtype + ', field name ' + field.name + ':\n\n' + s + '\n';
        }
      });
      if (unarranged.length) {
        self.apos.utils.warnDevOnce('unarranged-fields', '\n⚠️ ' + options.type + ' ' + options.subtype + ' contains unarranged field(s): ' + _.pluck(unarranged, 'name').join(', ') + '.\nArrange all of your fields with arrangeFields, using meaningful group labels.\nhttps://apos.dev/arrange-fields');
      }
    };

    // Return all standard field names currently associated with permissions editing,
    // for consistency in arrangeFields, batch permissions schemas, etc.
    self.getPermissionsFieldNames = function() {
      return [ 'loginRequired', '_viewUsers', '_viewGroups', '_editUsers', '_editGroups', 'applyToSubpages' ];
    };

  }
};
