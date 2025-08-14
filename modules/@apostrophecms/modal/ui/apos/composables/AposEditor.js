import { isEqual } from 'lodash';
// For now just moving postprocess logic here,
// if needed we might move more from AposEditorMixin.js

// Perform any postprocessing required by direct or nested schema fields
// before the object can be saved
export async function _postprocess(schema, data, widgetOptions, oldData) {
  // Relationship fields may have postprocessors (e.g. autocropping)
  const [ relationships, oldRelationships ] = findRelationships(schema, data, oldData);

  for (const [ i, relationship ] of relationships.entries()) {
    const oldRelationship = oldRelationships[i];
    if (!(relationship.value && relationship.field.postprocessor)) {
      continue;
    }
    if (checkSameRelationships(relationship.value, oldRelationship)) {
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

function findRelationships(schema, object, oldObject) {
  let relationships = [];
  const oldRelationships = [];
  for (const field of schema) {
    if (field.type === 'relationship') {
      relationships.push({
        context: object,
        field,
        value: object[field.name]
      });
      if (oldObject) {
        oldRelationships.push(oldObject[field.name]);
      }
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
  return [ relationships, oldRelationships ];
}

function checkSameRelationships(relationship, oldRelationship) {
  for (const piece of relationship) {
    const oldPiece = oldRelationship.find((p) => p._id === piece._id);
    console.log('piece', piece);
    console.log('oldPiece', oldPiece);
    if (!oldPiece) {
      return false;
    }
    if (!isEqual(piece._fields, oldPiece._fields)) {
      return false;
    }
  }
  return true;
}
