// Project-level file for a module that is ALSO configured (with fields)
// via the apostrophe() config object, to reproduce PRO-9564.
module.exports = {
  // An index.js-only option: it should survive via the gap-fill pass, unlike
  // the project-level fields, which get dropped wholesale.
  options: {
    fromProjectFile: true
  },
  fields: {
    add: {
      projectField: {
        type: 'string',
        label: 'Project Field'
      }
    },
    group: {
      projectGroup: {
        label: 'Project Group',
        fields: [ 'projectField' ]
      }
    }
  }
};
