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
    self.adapters = {};
    self.providers = {};
    self.effortTable = {};
    // "Is AI operational?" — true only once activation has configured
    // at least one provider, so feature code can ask before calling
    self.active = false;
    self.validateOptions(self.options);
    self.defaultProvider = self.options.provider ||
      Object.keys(self.options.providers)[0] || null;
    self.effortDefault = self.options.effort?.default || 'medium';
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        async activate() {
          await self.activateProviders();
        }
      }
    };
  },
  methods(self) {
    function fail(message) {
      throw new Error(`@apostrophecms/ai: ${message}`);
    }

    return {
      // Register a provider adapter. Adapters self-register in their own
      // module's init; re-registering an existing name overrides, so a
      // custom adapter can replace a standard one.
      addAdapter(adapter) {
        if (!adapter || typeof adapter.name !== 'string') {
          fail('addAdapter requires an adapter definition with a "name" string');
        }
        self.adapters[adapter.name] = adapter;
      },
      getAdapter(name) {
        return self.adapters[name];
      },
      // Activate every configured provider entry: instantiate the adapter
      // it names with the entry's config, validate it, merge the entry's
      // service description (models, effort rows, capabilities) over the
      // adapter's declared data, then build the effort routing table.
      // Misconfigurations fail the startup.
      async activateProviders() {
        const {
          providers = {}, effort = {}, image
        } = self.options;

        self.active = false;

        for (const [ name, entry ] of Object.entries(providers)) {
          const adapterName = entry.adapter || name;
          const adapter = self.getAdapter(adapterName);
          if (!adapter) {
            fail(`"providers.${name}" names unknown adapter "${adapterName}"`);
          }
          if (typeof adapter.validate !== 'function') {
            fail(`adapter "${adapterName}" does not implement validate()`);
          }
          const aliased = adapterName !== name;
          const instance = {
            ...adapter,
            provider: name,
            apiKey: entry.apiKey,
            baseUrl: entry.baseUrl || adapter.baseUrl
          };
          if (!process.env.APOS_AI_MOCK) {
            await instance.validate();
          }
          self.providers[name] = {
            name,
            adapterName,
            adapter: instance,
            capabilities: {
              ...adapter.capabilities,
              ...entry.capabilities
            },
            models: self.mergeModels(adapter.models, entry.models),
            // An aliased entry describes a different service than the
            // adapter's native one, so the native effort rows do not apply
            effort: aliased
              ? { ...entry.effort }
              : {
                ...adapter.effort,
                ...entry.effort
              }
          };
        }

        if (Object.keys(providers).length &&
          !self.providers[self.defaultProvider]) {
          fail('no default provider is available; name one with the "provider" option');
        }

        for (const [ level, row ] of Object.entries(effort.levels || {})) {
          if (!self.providers[row.provider]) {
            fail(`"effort.levels.${level}" references unconfigured provider "${row.provider}"`);
          }
        }
        if (image && !self.providers[image.provider]) {
          fail(`"image" references unconfigured provider "${image.provider}"`);
        }

        self.effortTable = self.buildEffortTable();
        if (self.defaultProvider && !self.effortTable[self.effortDefault]) {
          fail(`the default effort level "${self.effortDefault}" resolves to no routing entry; add it to "effort.levels" or configure a default provider whose adapter declares it`);
        }

        self.active = Object.keys(self.providers).length > 0;
      },
      // The routing table: the default provider's rows are the base,
      // the project's "effort.levels" replace it level by level
      buildEffortTable() {
        const table = {};
        const base = self.providers[self.defaultProvider];
        if (base) {
          for (const [ level, row ] of Object.entries(base.effort)) {
            table[level] = {
              ...row,
              provider: base.name
            };
          }
        }
        for (const [ level, row ] of Object.entries(self.options.effort?.levels || {})) {
          table[level] = { ...row };
        }
        return table;
      },
      // Resolve a call's routing options to a concrete routing entry,
      // with the same precedence generate will use: explicit
      // provider+model, else the call's effort level, else the default
      // level. Throws "invalid" on unresolvable calls; unknown models
      // are not an error.
      //
      // Options:
      // `provider`, `model` (strings, only together): the explicit
      //   target, bypassing the routing table;
      // `effort` (string): the routing level to resolve;
      // `capability` (only 'image'): resolve the image route instead of
      //   the effort table;
      // `reasoning` (string): override the resolved entry's reasoning.
      resolve(options = {}) {
        const invalid = (message) => {
          throw self.apos.error('invalid', message);
        };
        const {
          provider, model, effort, capability, reasoning
        } = options;

        if (capability !== undefined && capability !== 'image') {
          invalid(`unknown capability "${capability}"`);
        }
        if (provider || model) {
          if (!provider || !model) {
            invalid('"provider" and "model" must be given together');
          }
          if (!self.providers[provider]) {
            invalid(`"${provider}" is not a configured provider`);
          }
          return {
            provider,
            model,
            ...(reasoning !== undefined && { reasoning })
          };
        }
        let row;
        if (capability === 'image') {
          if (!self.options.image) {
            invalid('no "image" route is configured');
          }
          row = self.options.image;
        } else {
          const level = effort || self.effortDefault;
          row = self.effortTable[level];
          if (!row) {
            invalid(`effort level "${level}" resolves to no routing entry`);
          }
        }
        return {
          ...row,
          ...(reasoning !== undefined && { reasoning })
        };
      },
      // Synchronous introspection: the model a call with these options
      // would hit and what it offers. Accepts the same options as
      // `resolve` and resolves exactly like a call would, including
      // its "invalid" errors — a call that cannot resolve here would
      // fail the same way for real. An unknown model is different: the
      // call would work, so it yields undefined limits, never an error.
      // Check `self.active` first to ask whether AI is configured at
      // all.
      //
      // Returns `{ provider, model, reasoning?, contextWindow,
      // maxOutputTokens, capabilities }`, plus the model's declared
      // `aspects` for an image resolution. Model metadata merges the
      // provider's model maps with any fields carried inline on the
      // routing entry.
      modelInfo(options = {}) {
        const {
          provider, model, reasoning, aspect, quality, ...inline
        } = self.resolve(options);
        const record = self.providers[provider];
        const metadata = {
          ...record.models[model],
          ...inline
        };
        const info = {
          provider,
          model,
          ...(reasoning !== undefined && { reasoning }),
          contextWindow: metadata.contextWindow,
          maxOutputTokens: metadata.maxOutputTokens,
          capabilities: { ...record.capabilities }
        };
        if (options.capability === 'image') {
          info.aspects = metadata.aspects;
        }
        return info;
      },
      // Union of the adapter's and the entry's model metadata,
      // merged per model id with the entry's fields winning
      mergeModels(adapterModels = {}, entryModels = {}) {
        const models = {};
        for (const id of Object.keys({
          ...adapterModels,
          ...entryModels
        })) {
          models[id] = {
            ...adapterModels[id],
            ...entryModels[id]
          };
        }
        return models;
      },
      // Validate the shape of the module options, throwing a clear error
      // naming the offending entry. Checks that need the adapter registry
      // (unknown adapters, dangling routing references, effort levels with
      // no row) happen later, at activation.
      validateOptions(options) {
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
        if (!provider && Object.keys(providers).length > 1) {
          fail('"provider" must name the default provider when several providers are configured');
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
