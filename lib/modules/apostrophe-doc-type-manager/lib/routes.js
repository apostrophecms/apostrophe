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
    var removed = {};

    // Make sure we have an array of objects
    var rawChoices = _.map(Array.isArray(req.body.choices) ? req.body.choices : [], function(choice) {
      if (typeof(choice) !== 'object') {
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
      res.statusCode = 404;
      console.error('not blessed');
      return res.send('notfound');
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
      // Bring back the `__removed` property for use in the template
      _.each(choices, function(choice) {
        if (_.has(removed, choice._id || (choice.item && choice.item._id))) {
          choice.__removed = true;
        }
      });
      var markup = self.render(req, choicesTemplate, { choices: choices, choiceTemplate: choiceTemplate, relationship: field.relationship });
      if (req.body.validate) {
        // Newer version of this API returns the validated choices, so that the chooser doesn't
        // get stuck thinking there's already a choice bringing it up to its limit when the choice
        // is actually in the trash and shouldn't count anymore
        return res.send({
          status: 'ok',
          html: markup,
          choices: format(choices)
        });
      } else {
        return res.send(markup);
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

  self.route('post', 'relationship-editor', function(req, res) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, field, 'join')) {
      res.statusCode = 404;
      return res.send('notfound');
    }
    return res.send(self.render(req, field.relationshipTemplate || self.relationshipTemplate || 'relationshipEditor', { field: field }));
  });

  self.route('post', 'autocomplete', function(req, res) {
    var field = req.body.field;
    if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
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
