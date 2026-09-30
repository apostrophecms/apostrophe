// Implements {% field docOrWidget, 'fieldName' with { options... } %}

const parseWith = require('../../../../../lib/custom-tag-with.js');

module.exports = function(self) {
  return {
    // We need a custom parser because of the "with" syntax
    parse: parseWith(usage, 'field'),
    async run(context, object, name, _with) {
      const req = context.ctx.__req;
      return self.renderFieldTag(req, object, name, _with, { usage });
    }
  };

  function usage(message) {
    return new Error(`${message}

Usage: {% field data.page, 'fieldName' with { tag: 'h2', class: 'headline' } %}
`
    );
  }
};
