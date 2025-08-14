// For now just moving postprocess logic here,
// if needed we might move more from AposEditorMixin.js

// Perform any postprocessing required by direct or nested schema fields
// before the object can be saved
export async function _postprocess(schema, data, widgetOptions) {
  // Relationship fields may have postprocessors (e.g. autocropping)
  const relationships = findRelationships(schema, data);

  for (const relationship of relationships) {
    if (!(relationship.value && relationship.field.postprocessor)) {
      continue;
    }
    const withType = relationship.field.withType;
    const mod = apos.modules[withType];
    const response = await apos.http.post(`${mod.action}/${relationship.field.postprocessor}`, {
      qs: {
        aposMode: 'draft'
      },
      body: {
        relationship: relationship.value,
        // Pass the options of the widget currently being edited, some
        // postprocessors need these
        // (e.g. autocropping cares about widget aspectRatio)
        widgetOptions
      },
      busy: true
    });
    relationship.context[relationship.field.name] = response.relationship;
  }
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
