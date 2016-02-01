var joinr = require('joinr');
var _ = require('lodash');
var async = require('async');

module.exports = {

  alias: 'schemas',

  afterConstruct: function(self) {
    self.pushAssets();
    self.pushCreateSingleton();
  },

  construct: function(self, options) {

    self.pushAssets = function() {
      self.pushAsset('script', 'user', { when: 'user' });
      self.pushAsset('stylesheet', 'user', { when: 'user' });
    };

    self.pushCreateSingleton = function() {
      self.apos.push.browserCall('user', 'apos.create("apostrophe-schemas")');
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

      if (options.addFields) {
        var nextSplice = schema.length;
        _.each(options.addFields, function(field) {
          var i;
          for (i = 0; (i < schema.length); i++) {
            if (schema[i].name === field.name) {
              schema.splice(i, 1);
              if (!(field.before || field.after)) {
                // Replace it in its old position if none was explicitly requested
                schema.splice(i, 0, field);
                return;
              }
              // before or after requested, so fall through and let them work
              break;
            }
          }
          if (field.start) {
            nextSplice = 0;
          }
          if (field.end) {
            nextSplice = schema.length;
          }
          if (field.after) {
            for (i = 0; (i < schema.length); i++) {
              if (schema[i].name === field.after) {
                nextSplice = i + 1;
                break;
              }
            }
          }
          if (field.before) {
            for (i = 0; (i < schema.length); i++) {
              if (schema[i].name === field.before) {
                nextSplice = i;
                break;
              }
            }
          }
          schema.splice(nextSplice, 0, field);
          nextSplice++;
        });
      }

      if (options.removeFields) {
        schema = _.filter(schema, function(field) {
          return !_.contains(options.removeFields, field.name);
        });
      }

      if (options.orderFields) {
        var fieldsObject = {};
        var copied = {};
        _.each(schema, function(field) {
          fieldsObject[field.name] = field;
        });
        schema = [];
        _.each(options.orderFields, function(name) {
          if (fieldsObject[name]) {
            schema.push(fieldsObject[name]);
          }
          copied[name] = true;
        });
        _.each(fieldsObject, function(field, name) {
          if (!copied[name]) {
            schema.push(field);
          }
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

      // Convenience option for grouping fields
      // together (visually represented as tabs). Any
      // fields that are not grouped go to the top and
      // appear above the tabs
      if (options.groupFields) {
        // Drop any previous groups, we're overriding them
        schema = _.filter(schema, function(field) {
          return (field.type !== 'group');
        });
        _.each(schema, function(field) {
          delete field.group;
        });

        // Check for groups and fields with the same name, which is
        // forbidden because groups are internally represented as fields
        var nameMap = {};
        _.each(schema, function(field) {
          nameMap[field.name] = true;
        });
        _.each(options.groupFields, function(group) {
          if (_.has(nameMap, group.name)) {
            throw new Error('The group ' + group.name + ' has the same name as a field. Group names must be distinct from field names.');
          }
        });

        var ungrouped = [];
        _.each(options.groupFields, function(group) {
          _.each(group.fields || [], function(name) {
            var field = _.find(schema, function(field) {
              return (field.name === name);
            });
            if (field) {
              field.group = group.name;
            } else {
              // Tolerate nonexistent fields in groupFields. This
              // will happen if a subclass uses removeFields and
              // doesn't set up a new groupFields option, which
              // is reasonable
              return;
            }
          });
        });

        var newSchema = _.map(options.groupFields, function(group) {
          return {
            type: 'group',
            name: group.name,
            label: group.label,
            icon: group.label
          };
        });

        ungrouped = _.filter(schema, function(field) {
          return !field.group;
        });

        newSchema = newSchema.concat(ungrouped);

        _.each(options.groupFields, function(group) {
          newSchema = newSchema.concat(_.filter(schema, function(field) {
            return (field.group === group.name);
          }));
        });

        schema = newSchema;
      }

      _.each(schema, function(field) {
        if (field.template) {
          if (typeof(field.template) === 'string') {
            field.partial = self.partialer(field.template);
            delete field.template;
          } else {
            field.partial = field.template;
            delete field.template;
          }
        }
      });

      _.each(schema, function(field) {
        if (field.type === 'select') {
          _.each(field.choices, function(choice){
            if (choice.showFields) {
              if (!_.isArray(choice.showFields)) {
                throw new Error('The \'showFields\' property in the choices of a select field needs to be an array.');
              }
              _.each(choice.showFields, function(showFieldName){
                if (!_.find(schema, function(schemaField){ return schemaField.name == showFieldName; })) {
                  console.error('WARNING: The field \'' + showFieldName + '\' does not exist in your schema, but you tried to toggle it\'s display with a select field using showFields. STAAAHHHHPP!');
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
      return self.compose(options);
    };

    // Return a new schema containing only the fields named in the
    // `fields` array, while maintaining existing group relationships.
    // Any empty groups are dropped. Do NOT include group names
    // in `fields`.

    self.subset = function(schema, fields) {

      var schemaSubset = _.filter(schema, function(field) {
        return _.contains(fields, field.name) || (field.type === 'group');
      });

      // Drop empty tabs
      var fieldsByGroup = _.groupBy(schemaSubset, 'group');
      schemaSubset = _.filter(schemaSubset, function(field) {
        return (field.type !== 'group') || (_.has(fieldsByGroup, field.name));
      });

      // Drop references to empty tabs
      _.each(schemaSubset, function(field) {
        if (field.group && (!_.find(schemaSubset, function(group) {
          return ((group.type === 'group') && (group.name === field.group));
        }))) {
          delete field.group;
        }
      });

      return schemaSubset;
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

    // Index the object's fields for participation in Apostrophe search
    self.indexFields = function(schema, object, lines) {
      _.each(schema, function(field) {
        if (field.search === false) {
          return;
        }
        var fieldType = self.fieldTypes[field.type];
        if (!fieldType.index) {
          return;
        }
        fieldType.index[field.type](object[field.name], field, lines);
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
      return async.eachSeries(schema, function(field, callback) {
        // Fields that are contextual are edited in the context of a
        // show page and do not appear in regular schema forms. They are
        // however legitimate in imports, so we make sure it's a form
        // and not a CSV that we're skipping it for.
        if (field.contextual && (from === 'form')) {
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

    // Export sanitized 'object' into 'object'
    self.export = function(req, schema, to, object, object, callback) {
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
        return exporter(req, object, field, field.name, object, function(err) {
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
        _.each(filters, function(val, key) {
          cursor[key](val);
        });
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
          return callback('I cannot find the instance type ' + join.withType + ', maybe you said "map" where you should have said "mapLocation"?');
        }

        // If it has a getter, use it, otherwise supply one
        var find = manager.find;

        var options = {
          // Support joining with both instance and index types. If the manager's
          // instance type matches, use .get, otherwise use .getIndexes
          find: find,
          filters: {
            joins: withJoinsNext[join._dotPath] || false
          }
        };

        // Allow options to the get() method to be
        // specified in the join configuration
        if (join.filters) {
          _.extend(options.filters, join.filters);
        }

        // Allow options to the getter to be specified in the schema,
        // notably editable: true
        return self.fieldTypes[join.type].join(req, join, _objects, options, callback);
      }, callback);
    };

    self.fieldTypes = {};

    // Add a new field type

    self.addFieldType = function(type) {
      var fieldType = type;
      if (type.extend) {
        // Allow a field type to extend another field type and merge
        // in some differences.
        fieldType = _.cloneDeep(self.fieldTypes[type.extend]);
        _.merge(fieldType, type);
      }
      // Allow a field type to reuse another converter by specifying
      // its name. Allows 'form' to expressly reuse 'csv'
      _.each(_.keys(fieldType.converters), function(key) {
        var value = fieldType.converters[key];
        if (typeof(value) === 'string') {
          fieldType.converters[key] = fieldType.converters[value];
        }
      });
      self.fieldTypes[type.name] = fieldType;
    };

    self.getFieldType = function(typeName) {
      return self.fieldTypes[typeName];
    };

    self.addHelpers({
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

    self.addFieldType({
      name: 'area',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.areas.fromText(data[name]);
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
      }
    });

    self.addFieldType({
      name: 'singleton',
      extend: 'area',
      empty: function(field, value) {
        return self.apos.areas.isEmptySingleton({ area: area, type: field.widgetType });
      }
    });

    self.addFieldType({
      name: 'string',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          if (data[name]) {
            object[name] = self.apos.launder.string(data[name], field.def);
          }
          return setImmediate(callback);
        },
        form: 'csv'
      },
      exporters: {
        csv: function(req, object, field, name, output, callback) {
          // no formating, set the field
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
      }
    });

    self.addFieldType({
      name: 'slug',
      extend: 'string',
      converters: {
        // if field.page is true, expect a page slug (slashes allowed,
        // leading slash required). Otherwise, expect a object-style slug
        // (no slashes at all)
        csv: function(req, data, name, object, field, callback) {
          var options = {};
          if (field.page) {
            options.allow = '/';
          }
          object[name] = self.apos.utils.slugify(self.apos.launder.string(data[name], field.def), options);
          if (field.page) {
            if (!(object[name].charAt(0) === '/')) {
              object[name] = '/' + object[name];
              // No runs of slashes
              object[name] = object[name].replace(/^\/+/g, '/');
              // No trailing slashes (except for root)
              if (object[name] !== '/') {
                object[name] = object[name].replace(/\/$/, '');
              }
            }
          }
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'tags',
      converters: {
        csv: function(req, data, name, object, field, callback) {
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
        }
      },
      exporters: {
        csv: function(req, object, field, name, output, callback) {
          // no formating, set the field
          output[name] = object[name].toString();
          return setImmediate(callback);
        }
      }
    });

    self.addFieldType({
      name: 'boolean',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.boolean(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      },
      empty: function(field, value) {
        return !value;
      },
      exporters: {
        csv: function(req, object, field, name, output, callback) {
          output[name] = self.apos.launder.boolean(object[name]).toString();
          return setImmediate(callback);
        }
      }
    });

    self.addFieldType({
      name: 'checkboxes',
      converters: {
        csv: function(req, data, name, object, field, callback) {
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
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.select(data[name], field.choices, field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      },
      index: function(value, field, texts) {
        var silent = (field.silent === undefined) ? true : field.silent;
        texts.push({ weight: field.weight || 15, text: value, silent: silent });
      }
    });

    self.addFieldType({
      name: 'integer',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.integer(data[name], field.def, field.min, field.max);
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'float',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.float(data[name], field.def, field.min, field.max);
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'url',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.url(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      },
      diffable: function(value) {
        // URLs are fine to diff and display
        if (typeof(value) === 'string') {
          return value;
        }
        // always return a valid string
        return '';
      }
    });

    self.addFieldType({
      name: 'date',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.date(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'time',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.time(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'password',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          if (data[name]) {
            object[name] = self.apos.launder.string(data[name], field.def);
          }
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'time',
      converters: {
        csv: function(req, data, name, object, field, callback) {
          object[name] = self.apos.launder.time(data[name], field.def);
          return setImmediate(callback);
        },
        form: 'csv'
      }
    });

    self.addFieldType({
      name: 'group'
      // visual grouping only
    });

    self.addFieldType({
      name: 'array',
      converters: {
        // would be quite painful in csv
        form: function(req, data, name, object, field, callback) {
          var schema = field.schema;
          data = data[name];
          if (!Array.isArray(data)) {
            data = [];
          }
          var results = [];
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
      }
    });

    self.addFieldType({
      name: 'joinByOne',
      converters: {
        csv: function(req, data, name, object, field, callback) {
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
        self.apos.utils.bless(req, field, 'join');
      },
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byOne, false, objects, field.idField, undefined, field.name, options, callback);
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
        csv: function(req, data, name, object, field, callback) {
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
          return async.eachSeries(object[field.idsField], function(id, callback) {
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
      },
      bless: function(req, field) {
        self.apos.utils.bless(req, field, 'join');
      },
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byArray, false, objects, field.idsField, field.relationshipsField, field.name, options, callback);
      }
    });

    self.addFieldType({
      name: 'joinByArrayReverse',
      join: function(req, field, objects, options, callback) {
        return self.joinDriver(req, joinr.byArrayReverse, false, objects, field.idsField, field.relationshipsField, field.name, options, callback);
      }
    });


    // When a page is served to a logged-in user, make sure the session contains a blessing
    // for every join configured in schemas for doc types

    self.pageServe = function(req, callback) {
      // TODO: this is very inefficient vs. just doing it as soon as Apostrophe's schema has been
      // frozen, and making it available to all reqs somehow. But, are schemas necessarily ever frozen? Hmm.
      var managers = self.apos.docs.managers;
      _.each(managers, function(manager, name) {
        var schema = manager.schema;
        self.bless(req, schema);
      });
      return setImmediate(callback);
    };

    self.bless = function(req, schema) {
      _.each(schema, function(field) {
        var fieldType = self.fieldTypes[field.type];
        if (fieldType && fieldType.bless) {
          fieldType.bless(req, field);
        }
      });
    };

  }
};
