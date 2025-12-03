// A mixin to be implemented by the registered external metadata components.
// Registers the component props and provides useful util methods.

import isPlainObject from 'lodash/isPlainObject';

export default {
  props: {
    field: {
      type: Object,
      required: true
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    },
    meta: {
      type: Object,
      default: () => ({})
    },
    namespace: {
      type: String,
      default: ''
    },
    metaRaw: {
      type: Object,
      default: () => ({})
    }
  },

  methods: {
    /**
     * Recursively search for a namespace and optional key. Optionally
     * match a value if a key and value are provided. If no key is provided,
     * the namespace is matched.
     * Meta keys (inside `metaObject`) starting with '@' are ignored,
     * if not explicitly set otherwise, as they are absolute paths
     * and will be yielding false positives.
     *
     * @param {object} metaObject the meta object or any object inside it
     * @param {string} namespace
     * @param {string} [key] optional key to match
     * @param {string|number|boolean} [value] optional value to match
     * @param {boolean} [searchAbsolute] whether to search in absolute paths
     * @returns {boolean}
     */
    hasMeta(metaObject, namespace, key, value, searchAbsolute = false) {
      if (!metaObject) {
        return false;
      }
      const theKey = `${namespace}:${key || ''}`;
      const withValue = key && typeof value !== 'undefined' && value !== null;

      for (const [ k, v ] of Object.entries(metaObject)) {
        // Do not search in absolute paths as it will
        // lead to false positives.
        if (!searchAbsolute && k.startsWith('@')) {
          continue;
        }
        if (evaluateKey(k)) {
          return evaluateValue(v);
        }

        if (isPlainObject(v) && this.hasMeta(v, namespace, key, value)) {
          return true;
        }
      }

      return false;

      function evaluateKey(aKey) {
        if (key) {
          return aKey === theKey;
        }

        return aKey.startsWith(theKey);
      }

      function evaluateValue(aValue) {
        if (!withValue) {
          return true;
        }

        if (isPlainObject(aValue)) {
          return this.hasMeta(aValue, namespace, key, value);
        }

        return aValue === value;
      }
    }
  }
};
