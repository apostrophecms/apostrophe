// Supported field conditional types,
// you can add a condition type to this array to make it available to the frontend
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
// Checking if key ends with a closing parenthesis here to throw later if any argument is passed.
export function isExternalCondition(conditionKey, conditionType) {
  if (!conditionKey.endsWith(')')) {
    return false;
  }

  const [ methodDefinition ] = conditionKey.split('(');

  if (!conditionKey.endsWith('()')) {
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
// If present, followedByCategory must be either "other" or "utility", and
// the returned object will contain properties only for conditional fields
// in that category, although they may be conditional upon fields in either
// category.
// `schema` - the entire fields schema, document schema for editors,
// field.schema for complex fields
// `fields` - the subset of fields (part of the schema) that we are evaluating
// `values` - the schema (all) values
// `externalConditionsResults` - the results of the external conditions,
// as returned by `evaluateExternalConditions`
export function getConditionalFields(
  schema,
  fields,
  values,
  externalConditionsResults
) {
  const conditionalFields = getConditionTypesObject();

  for (const field of schema) {
    for (const conditionType of conditionTypes) {
      if (field[conditionType]) {
        const result = evaluate(field[conditionType], conditionType);
        conditionalFields[conditionType][field.name] = result;
      }
    }
  }

  const result = getConditionTypesObject();

  for (const field of fields) {
    for (const conditionType of conditionTypes) {
      if (field[conditionType]) {
        result[conditionType][field.name] = conditionalFields[conditionType][field.name];
      }
    }
  }

  return result;

  function evaluate(clause, conditionType) {
    for (const [ key, val ] of Object.entries(clause)) {
      if (key === '$or') {
        if (!val.some(clause => evaluate(clause, conditionType))) {
          return false;
        }

        // No need to go further here, the key is an "$or" condition...
        continue;
      }

      if (isExternalCondition(key, conditionType)) {
        if (externalConditionsResults[conditionType][key] !== val) {
          return false;
        }

        // Stop there, this is an external condition thus
        // does not need to be checked against doc fields.
        continue;
      }

      if (conditionalFields[conditionType][key] === false) {
        return false;
      }

      const fieldValue = values[key];

      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(val);
      }

      if (val.min && fieldValue < val.min) {
        return false;
      }
      if (val.max && fieldValue > val.max) {
        return false;
      }

      if (val !== fieldValue) {
        return false;
      }
    }
    return true;
  }
}
