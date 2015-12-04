var _ = require('lodash');

module.exports = function(self, options) {

  var helpers = {

    menu: function() {
      return self.partial('menu', { options: options });
    },

    stringifyBooleanFilterChoices: function(choices) {

      return _.map(choices, function(choice) {
        return {
          label: choice.label,
          value: stringifyValue(choice.value)
        };
      });

    },

    stringifyBooleanFilterValue: function(value) {
      return stringifyValue(value);
    },

    // Translates filter data for use with Pill component
    filterChoicesToPillChoices: function(filter) {
      var choices = [];
      for (var i = 0; i < filter.choices.length; i++) {
        choices.push({
          label: filter.choices[i].label, 
          action: 'toggle-' + filter.choices[i].label.toLowerCase(), 
          default: filter.choices[i].value === filter.def ? true : false
        });
      };
      return choices;
    }

  };

  self.addHelpers(helpers);

  function stringifyValue(value) {
    if ((value === undefined) || (value === null)) {
      return 'any';
    } else if (value) {
      return '1';
    } else {
      return '0';
    }
  }

};

