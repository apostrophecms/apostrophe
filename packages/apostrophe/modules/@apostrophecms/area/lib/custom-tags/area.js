// Implements {% area docOrWidget, 'areaName', { options... } %}

const parseWith = require('../../../../../lib/custom-tag-with.js');

module.exports = function(self) {
  return {
    // We need a custom parser because of the "with" syntax
    parse: parseWith(usage, 'area'),
    async run(context, doc, name, _with) {
      const req = context.ctx.__req;
      return self.renderAreaTag(req, doc, name, _with, { usage });
    }
  };

  function usage(message) {
    return new Error(`${message}

Usage: {% area data.page, 'areaName' with { optional object visible as data.context in widgets } %}
`
    );
  }
};
