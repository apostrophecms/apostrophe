import checkIfConditions, { isExternalCondition as isExtCondition } from 'apostrophe/lib/universal/check-if-conditions.mjs';

// Supported field conditional types,
// you can add a condition type to this array to make it available to the
// frontend
const conditionTypes = [ 'if', 'requiredIf' ];
export const getConditionTypesObject = () => Object
  .fromEntries(conditionTypes.map((key) => ([ key, {} ])));

// Evaluate the external conditions found in each field
// via API calls - made in parallel for performance-
// and store their result for reusability.
// `schema` - the fields schema
// `docId` - the current docId (from prop or context)
// `$t` - the i18n function (usually `this.$t`)
export async function evaluateExternalConditions(schema, docId, $t) {
  const externalConditionsResults = getConditionTypesObject();

  for (const field of schema) {
    for (const conditionType of conditionTypes) {
      if (field[conditionType]) {
        const externalConditionKeys = Object
          .entries(field[conditionType])
          .flatMap((entry) => getExternalConditionKeys(entry, conditionType))
          .filter(Boolean);

        const uniqExternalConditionKeys = [ ...new Set(externalConditionKeys) ];

        try {
          const promises = uniqExternalConditionKeys
            .map(key => (externalConditionsResults[conditionType][key] !== undefined
              ? null
              : evaluateExternalCondition(key, field._id, docId))
            )
            .filter(Boolean);

          const results = await Promise.all(promises);

          externalConditionsResults[conditionType] = {
            ...externalConditionsResults[conditionType],
            ...Object.fromEntries(results)
          };
        } catch (error) {
          await apos.notify($t('apostrophe:errorEvaluatingExternalCondition', { name: field.name }), {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            localize: false
          });
        }
      }
    }
  }
  return externalConditionsResults;

  function getExternalConditionKeys([ key, val ], conditionType) {
    if (key === '$or') {
      return val.flatMap(nested => Object.entries(nested)
        .map((entry) => getExternalConditionKeys(entry, conditionType)));
    }
    if (isExternalCondition(key, conditionType)) {
      return key;
    }
    return null;
  }
}

export async function evaluateExternalCondition(conditionKey, fieldId, docId) {
  const { result } = await apos.http.get(
    `${apos.schema.action}/evaluate-external-condition`,
    {
      qs: {
        fieldId,
        docId,
        conditionKey
      },
      busy: true
    }
  );

  return [ conditionKey, result ];
}
// Checking if key ends with a closing parenthesis here
// to throw later if any argument is passed.
export function isExternalCondition(conditionKey, conditionType) {
  if (!isExtCondition(conditionKey)) {
    return false;
  }

  const [ methodDefinition ] = conditionKey.split('(');

  if (!conditionKey.endsWith('()')) {
    // eslint-disable-next-line no-console
    console.warn(`Warning in \`${conditionType}\` definition: "${methodDefinition}()" should not be passed any argument.`);
  }

  return true;
}

// The returned object contains a property for each field that is
// conditional on other fields, `true` if that field's conditions are
// satisfied and `false` if they are not. There will be no properties for
// fields that are not conditional.
//
// Any condition on a field that is itself conditional fails if the second
// field's conditions fail.
//
// `schema` - the field schema, document schema for editors,
// field.schema for complex fields that we are evaluating
// `values` - the schema (all) values
// `externalConditionsResults` - the results of the external conditions,
// as returned by `evaluateExternalConditions`
export function getConditionalFields(
  schema,
  values,
  externalConditionsResults
) {
  const result = getConditionTypesObject();

  for (const field of schema) {
    for (const conditionType of conditionTypes) {
      if (field[conditionType]) {
        result[conditionType][field.name] = checkIfConditions(
          values,
          field[conditionType],
          (propName, condition, docValue) =>
            evaluateExternalAndHidden(propName, condition, conditionType)
        );
      }
    }
  }

  return result;

  // Handle external conditions as a voter function.
  // Non-boolean returns are ignored by the `checkIfConditions` function.
  function evaluateExternalAndHidden(propName, conditionValue, conditionType) {
    if (isExternalCondition(propName, conditionType)) {
      return externalConditionsResults[conditionType]?.[propName] === conditionValue;
    }

    if (result[conditionType]?.[propName] === false) {
      return false;
    }
  }
}

// Check if any of the conditional fields has a parent following value.
// This can be used in components to determine if they need to recalculate
// the conditional fields when the parent following values change (performance
// optimization).
export function hasParentConditionalField(schema) {
  // Detect of any of the conditional fields has a parent following value
  const hasParentCondition = schema
    .filter(field => conditionTypes.some(type => field[type]))
    .flatMap(field => conditionTypes.map(type => field[type]).filter(Boolean))
    .some(hasParentField);

  return hasParentCondition;

  // A recursive function to check if any condition has a parent field.
  // The condition is an object where keys are field names or operators like `$or`
  function hasParentField(condition) {
    if (!condition) {
      return false;
    }
    for (const [ key, value ] of Object.entries(condition)) {
      if (key.startsWith('<')) {
        return true;
      }
      if (Array.isArray(value)) {
        if (value.some(item => hasParentField(item))) {
          return true;
        }
        continue;
      }
      if (value && typeof value === 'object' && hasParentField(value)) {
        return true;
      }
    }
    return false;
  }
}
