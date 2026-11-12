// The assistant's options, checked at startup: a bad one stops the boot.

const EFFORT_OPTIONS = [ 'effort', 'titleEffort', 'delegationEffort', 'summaryEffort' ];
const USAGE_DISPLAYS = [ 'tokens', 'none' ];

module.exports = (self) => {
  return {
    validateOptions() {
      const {
        enabled, maxSteps, screenWait, usageDisplay, modelDisplay
      } = self.options;
      for (const [ name, value ] of Object.entries({
        enabled,
        modelDisplay
      })) {
        if (typeof value !== 'boolean') {
          fail(name, 'must be a boolean');
        }
      }
      for (const [ name, value ] of Object.entries({
        maxSteps,
        screenWait
      })) {
        if (!Number.isInteger(value) || (value < 1)) {
          fail(name, 'must be a positive integer');
        }
      }
      if (!USAGE_DISPLAYS.includes(usageDisplay)) {
        fail('usageDisplay', `must be one of: ${USAGE_DISPLAYS.join(', ')}`);
      }
      for (const name of EFFORT_OPTIONS) {
        const value = self.options[name];
        if ((value !== undefined) && ((typeof value !== 'string') || !value)) {
          fail(name, 'must be the name of an effort level');
        }
      }
    },

    // Every effort option names a level of the engine's effort table, built
    // when the engine activates. Mock mode with no provider routes nothing,
    // so there is nothing to check against
    validateEffortOptions() {
      const levels = Object.keys(self.apos.ai.modelCatalog().effort.levels);
      if (!levels.length) {
        return;
      }
      for (const name of EFFORT_OPTIONS) {
        const value = self.options[name];
        if ((value === undefined) || ((name === 'titleEffort') && (value === 'none'))) {
          continue;
        }
        if (!levels.includes(value)) {
          fail(name, `names the effort level "${value}", which is not one of: ${levels.join(', ')}`);
        }
      }
    }
  };

  function fail(name, message) {
    throw new Error(`The "${self.__meta.name}" module's ${name} option ${message}.`);
  }
};
