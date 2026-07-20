// This module provides `apos.ai`, the provider-agnostic AI engine. Feature
// code talks only to this surface; provider adapters register here and
// translate the normalized shapes to their service dialects.
//
// Providers are opt-in: the module ships no provider and no key. Configure
// each provider under `options.providers[name]` and (with more than one)
// name the default with `options.provider`.

module.exports = {
  options: {
    alias: 'ai',
    // providers: { name: { apiKey, baseUrl, adapter, models, effort, capabilities } }
    providers: {},
    // provider: the default provider name; inferred when only one is configured
    // effort: { default, levels: { name: { provider, model, reasoning } } }
    // image: { provider, model, aspect, quality }
    // mock: (request) => assistant turn, consulted only under APOS_AI_MOCK
    // Conservative agent-loop cap; any call may override it
    maxSteps: 5
  },
  init(self) {
    self.validateOptions(self.options);
  },
  methods(self) {
    return {
      // Validate the shape of the module options, throwing a clear error
      // naming the offending entry. Checks that need the adapter registry
      // (unknown adapters, dangling routing references, effort levels with
      // no row) happen later, at activation.
      validateOptions(options) {
        const fail = (message) => {
          throw new Error(message);
        };
        const isObject = (value) => value && typeof value === 'object' &&
          !Array.isArray(value);
        const checkString = (value, name) => {
          if (value !== undefined && typeof value !== 'string') {
            fail(`"${name}" must be a string`);
          }
        };
        const checkEffortRow = (row, name, { provider = false } = {}) => {
          if (!isObject(row)) {
            fail(`"${name}" must be an object like { provider, model }`);
          }
          if (provider && typeof row.provider !== 'string') {
            fail(`"${name}.provider" must be a string`);
          }
          if (typeof row.model !== 'string') {
            fail(`"${name}.model" must be a string`);
          }
          checkString(row.reasoning, `${name}.reasoning`);
        };

        const {
          providers, provider, effort, image, maxSteps, mock
        } = options;

        if (!isObject(providers)) {
          fail('"providers" must be an object of provider entries');
        }
        for (const [ name, entry ] of Object.entries(providers)) {
          if (!isObject(entry)) {
            fail(`"providers.${name}" must be an object`);
          }
          checkString(entry.apiKey, `providers.${name}.apiKey`);
          checkString(entry.baseUrl, `providers.${name}.baseUrl`);
          checkString(entry.adapter, `providers.${name}.adapter`);
          if (entry.models !== undefined) {
            if (!isObject(entry.models)) {
              fail(`"providers.${name}.models" must be an object of model entries`);
            }
            for (const [ model, info ] of Object.entries(entry.models)) {
              if (!isObject(info)) {
                fail(`"providers.${name}.models.${model}" must be an object`);
              }
            }
          }
          if (entry.effort !== undefined) {
            if (!isObject(entry.effort)) {
              fail(`"providers.${name}.effort" must be an object of effort rows`);
            }
            for (const [ level, row ] of Object.entries(entry.effort)) {
              // The provider is implicit (the entry itself), rows carry model
              checkEffortRow(row, `providers.${name}.effort.${level}`);
            }
          }
          if (entry.capabilities !== undefined) {
            if (!isObject(entry.capabilities)) {
              fail(`"providers.${name}.capabilities" must be an object`);
            }
            for (const [ capability, value ] of Object.entries(entry.capabilities)) {
              if (typeof value !== 'boolean') {
                fail(`"providers.${name}.capabilities.${capability}" must be a boolean`);
              }
            }
          }
        }

        checkString(provider, 'provider');
        if (provider && !providers[provider]) {
          fail(`"provider" names "${provider}" which is not a configured provider`);
        }

        if (effort !== undefined) {
          if (!isObject(effort)) {
            fail('"effort" must be an object like { default, levels }');
          }
          checkString(effort.default, 'effort.default');
          if (effort.levels !== undefined) {
            if (!isObject(effort.levels)) {
              fail('"effort.levels" must be an object of routing entries');
            }
            for (const [ level, row ] of Object.entries(effort.levels)) {
              checkEffortRow(row, `effort.levels.${level}`, { provider: true });
            }
          }
        }

        if (image !== undefined) {
          checkEffortRow(image, 'image', { provider: true });
          checkString(image.aspect, 'image.aspect');
          checkString(image.quality, 'image.quality');
        }

        if (!Number.isInteger(maxSteps) || maxSteps < 1) {
          fail('"maxSteps" must be a positive integer');
        }

        if (mock !== undefined && typeof mock !== 'function') {
          fail('"mock" must be a function');
        }
      }
    };
  }
};
