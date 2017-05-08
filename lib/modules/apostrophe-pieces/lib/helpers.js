var _ = require('lodash');

module.exports = function(self, options) {

  var helpers = {

    // Emit controls section of pieces editor modal: the cancel/save buttons, etc.
    editControls: function() {
      var controls = _.cloneDeep(self.editControls);
      // An override opportunity: modify the controls property
      self.apos.emit('piecesEditControls', {
        req: self.apos.templates.contextReq,
        type: self.name,
        controls: controls
      });
      return self.partial('controls', { controls: controls });
    },
    
    // Emit controls section of pieces create modal: the cancel/save buttons, etc.
    createControls: function() {
      var controls = _.cloneDeep(self.createControls);
      // An override opportunity: modify the controls property
      self.apos.emit('piecesCreateControls', {
        req: self.apos.templates.contextReq,
        type: self.name,
        controls: controls
      });
      return self.partial('controls', { controls: controls });
    },
    
    // Obsolete

    stringifyBooleanFilterChoices: function(choices) {

      return _.map(choices, function(choice) {
        return {
          label: choice.label,
          value: stringifyValue(choice.value)
        };
      });

    },
    
    // Obsolete

    stringifyBooleanFilterValue: function(value) {
      return stringifyValue(value);
    },

    // Obsolete. Translates filter data for use with Pill component
    filterChoicesToPillChoices: function(filter, choice) {
      var choices = [];
      for (var i = 0; i < filter.choices.length; i++) {
        choices.push({
          label: filter.choices[i].label,
          action: filter.name,
          value: filterValueToChoiceValue(filter.choices[i].value, choice),
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

  function filterValueToChoiceValue(state, choice) {
    switch (state) {
      case true:
        return '1';
      case false:
        return '0';
      case null:
        return 'any';
    }
  }

};
