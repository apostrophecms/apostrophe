var _ = require('@sailshq/lodash');
var util = require('util');

module.exports = function(self, options) {
  return {
    // Turn the provided string into a string suitable for use as a slug.
    // ONE punctuation character normally forbidden in slugs may
    // optionally be permitted by specifying it via options.allow.
    // The separator may be changed via options.separator.

    slugify: function(string, options) {
      return self.slugify(string, options);
    },

    // Log a message from a Nunjucks template. Great for debugging.
    // Outputs nothing to the template. Invokes apos.utils.log,
    // which by default invokes console.log.
    log: function(msg) {
      self.log.apply(self.apos, arguments);
      return '';
    },

    // Log the properties of the given object in detail.
    // Invokes `util.inspect` on the given object, down to a
    // depth of 10. Outputs nothing to the template.
    inspect: function(o) {
      self.log(util.inspect(o, { depth: 10 }));
      return '';
    },

    // Generate a globally unique ID
    generateId: function() {
      return self.generateId();
    },

    // Test whether the specified date object refers to a date in the current year.
    // The events module utilizes this

    isCurrentYear: function(date) {
      var now = new Date();
      return date.getYear() === now.getYear();
    },

    // check if something is properly undefined
    isUndefined: function(o) {
      return (o === undefined);
    },

    // check if something is strictly equal to false
    isFalse: function(o) {
      return (o === false);
    },

    // Convert string to start case (make default labels out of camelCase property names)
    startCase: function(o) {
      return _.startCase(o);
    },

    // check if something is a function (as opposd to property)
    isFunction: function(o) {
      return (typeof o === 'function');
    },

    // make up for lack of triple equals
    eqStrict: function(a, b) {
      return (a === b);
    },

    // Returns true if the list contains the specified value.
    // If value is an array, returns true if the list contains
    // *any of* the specified values
    contains: function(list, value) {
      if (_.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
          var valueItem = value[i];
          if (_.contains(list, valueItem)) {
            return true;
          }
        }
        return false;
      } else {
        return _.contains(list, value);
      }
    },

    // Returns true if the list contains at least one
    // object with the named property.

    // The first parameter may also be a single object, in
    // which case this function returns true if that object
    // has the named property.

    containsProperty: function(list, property) {
      if (_.isArray(list)) {
        return _.some(list, function(item) { return _.has(item, property); });
      } else {
        return _.has(list, property);
      }
    },

    // Reverses the order of the array. This MODIFIES the array
    // in addition to returning it
    reverse: function(array) {
      return array.reverse();
    },

    // If the `list` argument is a string, returns true if it begins
    // with `value`. If the `list` argument is an array, returns
    // true if at least one of its elements begins with `value`.
    beginsWith: function(list, value) {
      if (_.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var listItem = list[i];
          if (listItem.indexOf(value) === 0) {
            return true;
          }
        }
      } else {
        if (list.indexOf(value) === 0) {
          return true;
        }
      }
      return false;
    },

    // Find the first array element, if any, that has the specified value for
    // the specified property.

    find: function(arr, property, value) {
      return _.find(arr, function(item) {
        return (item[property] === value);
      });
    },

    // If propertyName is _id, then the keys in the returned
    // object will be the ids of each object in arr,
    // and the values will be the corresponding objects.
    // You may index by any property name.

    indexBy: function(arr, propertyName) {
      return _.indexBy(arr, propertyName);
    },

    // Find all the array elements, if any, that have the specified value for
    // the specified property.

    filter: function(arr, property, value) {
      return _.filter(arr, function(item) {
        return (item[property] === value);
      });
    },

    // Reject array elements that have the specified value for
    // the specified property.

    reject: function(arr, property, value) {
      return _.reject(arr, function(item) {
        return (item[property] === value);
      });
    },

    // Find all the array elements, if any, for which the specified property
    // is truthy.

    filterNonempty: function(arr, property) {
      return _.filter(arr, function(item) {
        return (item[property]);
      });
    },

    // Find all the array elements, if any, for which the specified property
    // is not truthy.

    filterEmpty: function(arr, property) {
      return _.filter(arr, function(item) {
        return (!item[property]);
      });
    },

    // Returns true if the specified array or object is considered empty.
    // Objects are empty if they have no own enumerable properties.
    // Arrays are considered empty if they have a length of 0.

    isEmpty: function(item) {
      return _.isEmpty(item);
    },

    // Given an array of objects with the given property, return an array with
    // the value of that property for each object.

    pluck: function(arr, property) {
      return _.pluck(arr, property);
    },

    // Given an object, return an object without
    // the named properties or array of named
    // properties (see _.omit()).

    omit: function(object, property /* , property... */) {
      return _.omit.apply(_, arguments);
    },

    // Given the arrays `array` and `without`, return
    // only the elements of `array` that do not occur
    // in `without`. If `without` is not an array it is
    // treated as an empty array.
    //
    // If `property` is present, then that property of
    // each element of array is compared to elements
    // of `without`. This is useful when `array` contains
    // full-blown choices with a `value` property, while
    // `without `just contains actual values.
    //
    // A deep comparison is performed with `_.isEqual`.

    difference: function(array, without, property) {
      return _.filter(Array.isArray(array) ? array : [], function(item) {
        return !_.find(without || [], function(other) {
          if (property) {
            return _.isEqual(item[property], other);
          } else {
            return _.isEqual(item, other);
          }
        });
      });
    },

    // Concatenate all of the given arrays and/or values
    // into a single array. If an argument is an array, all
    // of its elements are individually added to the
    // resulting array. If an argument is a value, it is
    // added directly to the array.

    concat: function(arrOrObj1, arrOrObj2 /* , ... */) {
      // I tried to implement this with call() but I kept
      // getting arrays in my values. We still get the
      // benefit of concat() and its built-in support for
      // treating arrays and scalar values differently. -Tom
      var result = [];
      var i;
      for (i = 0; (i < arguments.length); i++) {
        result = result.concat(arguments[i]);
      }
      return result;
    },

    // Groups by the property named by 'key' on each of the values.
    // If the property referred to by the string 'key' is found to be
    // an array property of the first object, apos.utils.groupByArray is called.
    //
    // ::: v-pre
    // Usage: `{{ apos.utils.groupBy(people, 'age') }}` or `{{ apos.utils.groupBy(items, 'tags') }}`
    // :::
    groupBy: function(items, key) {
      if (items.length && Array.isArray(items[0][key])) {
        return groupByArray(items, key);
      }
      return _.groupBy(items, key);

      function groupByArray(items, arrayName) {
        var results = {};
        _.each(items, function(item) {
          _.each(item[arrayName] || [], function(inner) {
            if (!results[inner]) {
              results[inner] = [];
            }
            results[inner].push(item);
          });
        });

        return results;
      }

    },

    // Given a series of alternating keys and values, this
    // function returns an object with those values for
    // those keys. For instance, apos.utils.object('name', 'bob')
    // returns { name: 'bob' }. This is useful because
    // Nunjucks does not allow you to create an object with
    // a property whose name is unknown at the time the
    // template is written.
    object: function(/* key, value, ... */) {
      var o = {};
      var i = 0;
      while (i < arguments.length) {
        o[arguments[i]] = arguments[i + 1];
        i += 2;
      }
      return o;
    },

    // Pass as many objects as you want; they will get merged via
    // `_.merge` into a new object, without modifying any of them, and
    // the resulting object will be returned. If several objects have
    // a property, the last object wins.
    //
    // This is useful to add one more option to an options object
    // which was passed to you.
    //
    // If any argument is null, it is skipped gracefully. This allows
    // you to pass in an options object without checking if it is null.

    merge: function() {
      var result = {};
      var i;
      for (i = 0; (i < arguments.length); i++) {
        if (!arguments[i]) {
          continue;
        }
        result = _.merge(result, arguments[i]);
      }
      return result;
    }

  };
};
