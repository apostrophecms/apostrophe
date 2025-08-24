// Perform any postprocessing required by direct or nested schema fields
// before the object can be saved
export async function postprocessRelationships(schema, data, widgetOptions) {
  // Relationship fields may have postprocessors (e.g. autocropping)
  const relationships = findRelationships(schema, data);

  for (const {
    value, field, context
  } of relationships) {
    context[field.name] = await getPostprocessedRelationship(
      value,
      field,
      widgetOptions
    );
  }
}

export async function getPostprocessedRelationship(
  value,
  field,
  widgetOptions
) {
  if (!field.postprocessor || !value) {
    return value;
  }
  const mod = apos.modules[field.withType];
  const response = await apos.http.post(`${mod.action}/${field.postprocessor}`, {
    qs: {
      aposMode: 'draft'
    },
    body: {
      relationship: value,
      // Pass the options of the widget currently being edited, some
      // postprocessors need these
      // (e.g. autocropping cares about widget aspectRatio)
      widgetOptions
    },
    busy: true
  });

  return response.relationship;
}

function findRelationships(schema, object) {
  let relationships = [];
  for (const field of schema) {
    if (field.type === 'relationship') {
      relationships.push({
        context: object,
        field,
        value: object[field.name]
      });
    } else if (field.type === 'array') {
      for (const value of (object[field.name] || [])) {
        relationships = [
          ...relationships,
          findRelationships(field.schema, value)
        ];
      }
    } else if (field.type === 'object') {
      relationships = [
        ...relationships,
        findRelationships(field.schema, object[field.name] || {})
      ];
    }
  }
  return relationships;
}
