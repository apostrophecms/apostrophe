/*
 * Provides:
 *
 * A scaffold for handling conditional fields, via the
 * `conditionalFields` method
 *
 * `schema()` (computed) prop is required in the
 * component implementing this mixin (typically `this.field.schema`).
 *
 * This mixin is designed to detect field visibility withing components
 * having sub-schema (like `AposInputObject`).
 */

import {
  getConditionalFields, evaluateExternalConditions, getConditionTypesObject
} from '../lib/conditionalFields';

export default {
  data() {
    return {
      externalConditionsResults: getConditionTypesObject(),
      conditionalFields: getConditionTypesObject()
    };
  },

  methods: {
    // Evaluate the external conditions found in each field
    // via API calls - made in parallel for performance-
    // and store their result for reusability.
    async evaluateExternalConditions() {
      this.externalConditionsResults = await evaluateExternalConditions(
        this.schema,
        this.docId,
        this.$t
      );
    },

    // The returned object contains a property for each field that is
    // conditional on other fields, `true` if that field's conditions are
    // satisfied and `false` if they are not. There will be no properties for
    // fields that are not conditional.
    //
    // Any condition on a field that is itself conditional fails if the second
    // field's conditions fail.
    //
    // If present, followedByCategory must be either "other" or "utility", and
    // the returned object will contain properties only for conditional fields
    // in that category, although they may be conditional upon fields in either
    // category.
    // `values` - the schema (all) values
    getConditionalFields(values) {
      return getConditionalFields(
        this.schema,
        values,
        this.externalConditionsResults
      );
    },

    evaluateConditions(values = {}) {
      this.conditionalFields = this.getConditionalFields(values);
    }
  }
};
