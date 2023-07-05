// Evaluate the external conditions found in each field
// via API calls - made in parallel for performance-
// and store their result for reusability.
// `schema` - the fields schema
// `docId` - the current docId (from prop or context)
// `$t` - the i18n function (usually `this.$t`)
export async function evaluateExternalConditions(schema, docId, $t) {
  let externalConditionsResults = {};

  for (const field of schema) {
    if (field.if) {
      const externalConditionKeys = Object
        .entries(field.if)
        .flatMap(getExternalConditionKeys)
        .filter(Boolean);

      const uniqExternalConditionKeys = [ ...new Set(externalConditionKeys) ];

      let results = [];

      try {
        const promises = uniqExternalConditionKeys
          .map(key => externalConditionsResults[key] !== undefined
            ? null
            : evaluateExternalCondition(key, field._id, docId)
          )
          .filter(Boolean);

        results = await Promise.all(promises);

        externalConditionsResults = {
          ...externalConditionsResults,
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
  return externalConditionsResults;

  function getExternalConditionKeys([ key, val ]) {
    if (key === '$or') {
      return val.flatMap(nested => Object.entries(nested).map(getExternalConditionKeys));
    }
    if (isExternalCondition(key)) {
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
export function isExternalCondition(conditionKey) {
  if (!conditionKey.endsWith(')')) {
    return false;
  }

  const [ methodDefinition ] = conditionKey.split('(');

  if (!conditionKey.endsWith('()')) {
    console.warn(`Warning in \`if\` definition: "${methodDefinition}()" should not be passed any argument.`);
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
export function conditionalFields(
  schema,
  fields,
  values,
  externalConditionsResults
) {
  const conditionalFields = {};

  while (true) {
    let change = false;
    for (const field of schema) {
      if (field.if) {
        const result = evaluate(field.if);
        const previous = conditionalFields[field.name];
        if (previous !== result) {
          change = true;
        }
        conditionalFields[field.name] = result;
      }
    }
    if (!change) {
      break;
    }
  }

  const result = {};
  for (const field of fields) {
    if (field.if) {
      result[field.name] = conditionalFields[field.name];
    }
  }
  return result;

  function evaluate(clause) {
    let result = true;
    for (const [ key, val ] of Object.entries(clause)) {
      if (key === '$or') {
        if (!val.some(clause => evaluate(clause))) {
          result = false;
          break;
        }

        // No need to go further here, the key is an "$or" condition...
        continue;
      }

      if (isExternalCondition(key)) {
        if (externalConditionsResults[key] !== val) {
          result = false;
          break;
        }

        // Stop there, this is an external condition thus
        // does not need to be checked against doc fields.
        continue;
      }

      if (conditionalFields[key] === false) {
        result = false;
        break;
      }

      const fieldValue = values[key];

      if (Array.isArray(fieldValue)) {
        result = fieldValue.includes(val);
        break;
      }
      if (val !== fieldValue) {
        result = false;
        break;
      }
    }
    return result;
  }
}
