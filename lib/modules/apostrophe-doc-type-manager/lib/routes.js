let _ = require('lodash');

module.exports = function(self, options) {

  self.apiRoute('post', 'chooser', async function(req) {
    const browse = !!req.body.browse;
    const autocomplete = !!req.body.autocomplete;
    return self.render(req, 'chooser', { browse: browse, autocomplete: autocomplete });
  });

  self.apiRoute('post', 'chooser-choices', async function(req) {
    const field = req.body.field;
    const removed = {};

    // Make sure we have an array of objects
    const rawChoices = _.map(Array.isArray(req.body.choices) ? req.body.choices : [], function(choice) {
      if (typeof (choice) !== 'object') {
        return {};
      } else {
        return choice;
      }
    });
    _.each(rawChoices, function(choice) {
      if (choice.__removed) {
        removed[choice.value] = true;
      }
    });

    if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
      throw 'notfound';
    }

    // We received an array of choices in the generic format, we need to map it to the format
    // for the relevant type of join before we can use convert to validate the input

    const input = {};
    if (field.idsField) {
      input[field.idsField] = _.map(rawChoices, 'value');
      if (field.relationshipsField) {
        input[field.relationshipsField] = {};
        _.each(rawChoices, function(choice) {
          input[field.relationshipsField][choice.value] = _.omit(choice, 'value', 'label');
        });
      }
    } else {
      input[field.idField] = rawChoices[0] && rawChoices[0].value;
    }
    const receptacle = {};
    // For purposes of previewing, it's OK to ignore readOnly so we can tell which
    // inputs are plausible
    await self.apos.schemas.convert(req, [ _.omit(field, 'readOnly') ], 'form', input, receptacle);
    await self.apos.schemas.join(req, [ field ], receptacle, true);
    const choiceTemplate = field.choiceTemplate || self.choiceTemplate || 'chooserChoice.html';
    const choicesTemplate = field.choicesTemplate || self.choicesTemplate || 'chooserChoices.html';
    let choices = receptacle[field.name];
    if (!Array.isArray(choices)) {
      // by one case
      if (choices) {
        choices = [ choices ];
      } else {
        choices = [];
      }
    }
    // Add "readOnly" property and bring back the `__removed` property for use in the template
    _.each(choices, function(choice) {
      choice.readOnly = field.readOnly;
      if (_.has(removed, choice._id || (choice.item && choice.item._id))) {
        choice.__removed = true;
      }
    });
    const markup = self.render(req, choicesTemplate, { choices: choices, choiceTemplate: choiceTemplate, relationship: field.relationship, hints: field.hints });
    // Newer version of this API returns the validated choices, so that the chooser doesn't
    // get stuck thinking there's already a choice bringing it up to its limit when the choice
    // is actually in the trash and shouldn't count anymore
    return {
      html: markup,
      choices: format(choices)
    };

    function format(choices) {
      // After the join, the "choices" array is actually an array of docs, or objects with .item and .relationship
      // properties. As part of our validation services for the chooser object in the browser, recreate what the browser
      // side is expecting: objects with a "value" property (the _id) and relationship properties, if any
      return _.map(choices, function(item) {
        const object = item;
        const relationship = item._relationship || {};
        const choice = {
          value: object._id
        };
        if (item.__removed) {
          choice.__removed = true;
        }
        _.defaults(choice, relationship);
        return choice;
      });
    }
  });

  self.apiRoute('post', 'relationship-editor', async function(req) {
    const field = req.body.field;
    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      throw 'notfound';
    }
    return self.render(req, field.relationshipTemplate || self.relationshipTemplate || 'relationshipEditor', { field: field });
  });

  self.apiRoute('post', 'autocomplete', async function(req, res) {
    const field = req.body.field;
    if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
      throw 'notfound';
    }
    const term = self.apos.launder.string(req.body.term);
    return self.autocomplete(req, { field: field, term: term });
  });

};
