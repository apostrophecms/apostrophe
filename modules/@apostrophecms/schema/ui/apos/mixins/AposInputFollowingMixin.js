/**
 * Provides followingValues computation for fields having
 * sub-schema (array, object).
 */

export default {
  methods: {
    // Accept a `data` object with field values and return an object
    // of the following values for each field of the underlying schema.
    computeFollowingValues(data, parentOnly = false) {
      const followingValues = {};
      const parentFollowing = {};
      for (const [ key, val ] of Object.entries(this.followingValues || {})) {
        parentFollowing[`<${key}`] = val;
      }

      if (parentOnly) {
        // If we are only interested in the parent following values, return them
        return parentFollowing;
      }

      for (const field of this.schema) {
        if (field.following) {
          const following = Array.isArray(field.following)
            ? field.following
            : [ field.following ];
          followingValues[field.name] = {};
          for (const name of following) {
            if (name.startsWith('<')) {
              followingValues[field.name][name] = parentFollowing[name];
            } else {
              followingValues[field.name][name] = data[name];
            }
          }
        }
      }

      return followingValues;
    }
  }
};
