var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.route('post', 'chooser', function(req, res) {
    var browse = !!req.body.browse;
    var autocomplete = !!req.body.autocomplete;
    return res.send(self.render(req, 'chooser', { browse: browse, autocomplete: autocomplete }));
  });

  self.route('post', 'chooser-choices', function(req, res) {

    var field = req.body.field;
    // Make sure we have an array of objects
    var choices = _.map(Array.isArray(req.body.choices) ? req.body.choices : [], function(choice) {
      if (typeof(choice) !== 'object') {
        return {};
      } else {
        return choice;
      }
    });

    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      res.statusCode = 404;
      return res.send('notfound');
    }

    // We received an array of choices in the generic format, we need to map it to the format
    // for the relevant type of join before we can use convert to validate the input

    var input = {};
    if (field.idsField) {
      input[field.idsField] = _.pluck(choices, 'value');
      if (field.relationshipsField) {
        input[field.relationshipsField] = {};
        _.each(choices, function(choice) {
          input[field.relationshipsField][choice.value] = _.omit(choice, 'value', 'label');
        });
      }
    } else {
      input[field.idField] = req.body.choices[0].value;
    }
    var manager = self.getManager(field.withType);
    var receptacle = {};
    return async.series({
      convert: function(callback) {
        return self.apos.schemas.convert(req, [ field ], 'form', input, receptacle, callback);
      },
      join: function(callback) {
        return self.apos.schemas.join(req, [ field ], receptacle, true, callback);
      }
    },function(err) {
      if (err) {
        console.error(err);
        res.statusCode = 404;
        return res.send('notfound');
      }
      var choiceTemplate = field.choiceTemplate || manager.choiceTemplate || 'chooserChoice.html';
      var choicesTemplate = field.choicesTemplate || manager.choicesTemplate || 'chooserChoices.html';
      return res.send(self.render(req, choicesTemplate, { choices: receptacle[field.name], choiceTemplate: choiceTemplate, relationship: field.relationship } ));
    });
  });

  self.route('post', 'relationship-editor', function(req, res) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      res.statusCode = 404;
      return res.send('notfound');
    }
    var manager = self.getManager(field.withType);
    return res.send(self.render(req, field.relationshipTemplate || manager.relationshipTemplate || 'relationshipEditor', { field: field }));
  });

  self.route('post', 'autocomplete', function(req, res) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      res.statusCode = 404;
      return res.send('notfound');
    }
    var term = self.apos.launder.string(req.body.term);
    return self.autocomplete(req, { field: field, term: term }, function(err, response) {
      if (err) {
        res.statusCode = 500;
        return res.send('error');
      }
      return res.send(
        JSON.stringify(response)
      );
    });
  });

};
