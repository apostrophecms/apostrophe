var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function(self, options) {

  self.renderRoute('post', 'chooser', function(req, res, next) {
    var browse = !!req.body.browse;
    var autocomplete = !!req.body.autocomplete;
    return next(null, {
      template: 'chooser',
      data: {
        browse: browse,
        autocomplete: autocomplete
      }
    });
  });

  self.route('post', 'chooser-choices', function(req, res) {

    // For this route we are stuck using self.route because it has a legacy history
    // that includes both HTML responses and API responses. :eyeroll: But we can use the
    // new htmlResponder and apiResponder methods directly as a workaround to keep the
    // improved logging.

    var field = req.body.field;
    var removed = {};

    // Make sure we have an array of objects
    var rawChoices = _.map(Array.isArray(req.body.choices) ? req.body.choices : [], function(choice) {
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
      return self.htmlResponder(req, 'notfound');
    }

    // We received an array of choices in the generic format, we need to map it to the format
    // for the relevant type of join before we can use convert to validate the input

    var input = {};
    if (field.idsField) {
      input[field.idsField] = _.pluck(rawChoices, 'value');
      if (field.relationshipsField) {
        input[field.relationshipsField] = {};
        _.each(rawChoices, function(choice) {
          input[field.relationshipsField][choice.value] = _.omit(choice, 'value', 'label');
        });
      }
    } else {
      input[field.idField] = rawChoices[0] && rawChoices[0].value;
    }
    var receptacle = {};
    return async.series({
      convert: function(callback) {
        // For purposes of previewing, it's OK to ignore readOnly so we can tell which
        // inputs are plausible
        return self.apos.schemas.convert(req, [ _.omit(field, 'readOnly') ], 'form', input, receptacle, callback);
      },
      join: function(callback) {
        return self.apos.schemas.join(req, [ field ], receptacle, true, callback);
      }
    }, function(err) {
      if (err) {
        return self.htmlResponder(req, err);
      }
      var choiceTemplate = field.choiceTemplate || self.choiceTemplate || 'chooserChoice.html';
      var choicesTemplate = field.choicesTemplate || self.choicesTemplate || 'chooserChoices.html';
      var choices = receptacle[field.name];
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
      var markup;
      try {
        markup = self.render(req, choicesTemplate, { field: field, choices: choices, choiceTemplate: choiceTemplate, relationship: field.relationship, hints: field.hints });
      } catch (e) {
        return self.htmlResponder(req, e);
      }
      if (req.body.validate) {
        // Newer version of this API returns the validated choices, so that the chooser doesn't
        // get stuck thinking there's already a choice bringing it up to its limit when the choice
        // is actually in the trash and shouldn't count anymore
        return self.apiResponder(req, null, {
          status: 'ok',
          html: markup,
          choices: format(choices)
        });
      } else {
        return self.htmlResponser(req, null, markup);
      }
    });
    function format(choices) {
      // After the join, the "choices" array is actually an array of docs, or objects with .item and .relationship
      // properties. As part of our validation services for the chooser object in the browser, recreate what the browser
      // side is expecting: objects with a "value" property (the _id) and relationship properties, if any
      return _.map(choices, function(item) {
        var object, relationship;
        if (item.item) {
          object = item.item;
          relationship = item.relationship;
        } else {
          object = item;
          relationship = {};
        }
        var choice = {
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

  self.renderRoute('post', 'relationship-editor', function(req, res, next) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      return next('notfound');
    }
    return next(null, {
      template: field.relationshipTemplate || self.relationshipTemplate || 'relationshipEditor',
      data: {
        field: field
      }
    });
  });

  self.apiRoute('post', 'autocomplete', function(req, res, next) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
      return next('invalid');
    }
    var term = self.apos.launder.string(req.body.term);
    return self.autocomplete(req, { field: field, term: term }, next);
  });

};
