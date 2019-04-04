var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  var helpers = {

    // Emit controls section of pieces editor modal: the cancel/save buttons, etc.
    editControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getEditControls(req), options: self.options });
    },

    // Emit controls section of pieces create modal: the cancel/save buttons, etc.
    createControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getCreateControls(req), options: self.options });
    },

    // Render controls section of manager modal
    managerControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getManagerControls(req), options: self.options });
    },

    // Render controls section of chooser modal (manager functioning as an expanded chooser)
    chooserControls: function() {
      var req = self.apos.templates.contextReq;
      return self.partial('controls', { controls: self.getChooserControls(req), options: self.options });
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
          default: filter.choices[i].value === filter.def
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
