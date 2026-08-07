// Everything that runs once at boot and kills the process on a bad
// configuration: option validation, provider activation and the tool
// registry's activation pass.

const startCase = require('lodash/startCase');
const {
  NAMED_ASPECTS, QUALITIES, TOOL_KINDS
} = require('./constants');
const {
  isObject, parseAspect, startupFail: fail
} = require('./util');

module.exports = (self) => {
  return {
    // Activate every configured provider entry: instantiate the adapter
    // it names with the entry's config, validate it, merge the entry's
    // service description over the adapter's declared data, then build
    // the effort routing table. An entry's key prefers the environment:
    // the variable named by its envKey (the entry's own over the
    // adapter's default) overrides the configured apiKey.
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
        const envKey = entry.envKey || adapter.envKey;
        const envApiKey = envKey && process.env[envKey];
        const instance = {
          ...adapter,
          provider: name,
          apiKey: envApiKey || entry.apiKey,
          baseUrl: entry.baseUrl || adapter.baseUrl
        };
        if (!self.mockMode) {
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
        self.validateAspects(name, self.providers[name].models);
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
      if (image) {
        if (!self.providers[image.provider]) {
          fail(`"image" references unconfigured provider "${image.provider}"`);
        }
        if (!self.providers[image.provider].capabilities.image) {
          fail(`"image" references provider "${image.provider}" which does not declare the "image" capability`);
        }
      }

      self.effortTable = self.buildEffortTable();
      if (self.defaultProvider && !self.effortTable[self.effortDefault]) {
        fail(`the default effort level "${self.effortDefault}" resolves to no routing entry; add it to "effort.levels" or configure a default provider whose adapter declares it`);
      }

      self.active = Object.keys(self.providers).length > 0 ||
        self.mockMode;
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
    // Validate every registered tool definition (the shape is
    // documented on addTool) and replace it in the registry with its
    // activated canonical form, `handler` always a callable. A
    // 'moduleName:methodName' reference is resolved here, which is why
    // activation waits for "apostrophe:ready": every module's init has
    // run by then, so references resolve and overrides are settled
    // regardless of registration order. The registry is frozen
    // afterwards.
    activateTools() {
      for (const [ name, tool ] of Object.entries(self.tools)) {
        self.tools[name] = activate(tool, `tool "${name}"`);
      }
      self.toolList = Object.values(self.tools);
      self.toolsByTag = new Map();
      for (const tool of self.toolList) {
        for (const tag of tool.tags) {
          const tools = self.toolsByTag.get(tag);
          if (tools) {
            tools.push(tool);
          } else {
            self.toolsByTag.set(tag, [ tool ]);
          }
        }
      }
      self.toolsActive = true;

      function activate(tool, name) {
        if (typeof tool.description !== 'string' || !tool.description) {
          fail(`${name}: "description" must be a non-empty string`);
        }
        if (tool.label !== undefined &&
          (typeof tool.label !== 'string' || !tool.label)) {
          fail(`${name}: "label" must be a non-empty string`);
        }
        if (tool.tags !== undefined && (!Array.isArray(tool.tags) ||
          tool.tags.some(tag => typeof tag !== 'string' || !tag))) {
          fail(`${name}: "tags" must be an array of tag strings`);
        }
        if (!isObject(tool.input) || tool.input.type !== 'object') {
          fail(`${name}: "input" must be a JSON Schema with an object root`);
        }
        let validateArgs;
        try {
          validateArgs = self.ajvArgs.compile(tool.input);
        } catch (e) {
          fail(`${name}: "input" is not a valid JSON Schema: ${e.message}`);
        }
        let validateResult;
        if (tool.schema !== undefined) {
          if (!isObject(tool.schema) || tool.schema.type !== 'object') {
            fail(`${name}: "schema" must be a JSON Schema with an object root`);
          }
          try {
            validateResult = self.ajv.compile(tool.schema);
          } catch (e) {
            fail(`${name}: "schema" is not a valid JSON Schema: ${e.message}`);
          }
        }
        const kind = tool.kind === undefined ? 'action' : tool.kind;
        if (!TOOL_KINDS.includes(kind)) {
          fail(`${name}: "kind" must be "query", "action" or "agent"`);
        }
        if (tool.maxResultChars !== undefined &&
          (!Number.isInteger(tool.maxResultChars) || tool.maxResultChars < 1)) {
          fail(`${name}: "maxResultChars" must be a positive integer`);
        }
        return {
          name: tool.name,
          label: tool.label || startCase(tool.name),
          description: tool.description,
          tags: tool.tags || [],
          input: tool.input,
          validateArgs,
          schema: tool.schema,
          validateResult,
          maxResultChars: tool.maxResultChars,
          kind,
          handler: resolveHandler(tool.handler, name)
        };
      }

      // The handler option → the callable the loop runs, resolving a
      // 'moduleName:methodName' reference against the named module
      function resolveHandler(value, name) {
        if (typeof value === 'function') {
          return value;
        }
        if (typeof value !== 'string') {
          fail(`${name}: "handler" must be a function or a "moduleName:methodName" string`);
        }
        const [ moduleName, methodName, ...rest ] = value.split(':');
        if (!moduleName || !methodName || rest.length) {
          fail(`${name}: handler "${value}" must name a module and a method, like "moduleName:methodName"`);
        }
        // Own-property checks: a reference must never resolve
        // through the prototype chain ('constructor', 'toString', …)
        if (!Object.hasOwn(self.apos.modules, moduleName)) {
          fail(`${name}: handler names unknown module "${moduleName}"`);
        }
        const module = self.apos.modules[moduleName];
        if (!Object.hasOwn(module, methodName) ||
          typeof module[methodName] !== 'function') {
          fail(`${name}: handler names unknown method "${methodName}" of "${moduleName}"`);
        }
        return (req, args) => module[methodName](req, args);
      }
    },
    // Fail startup when a model's declared image `aspects` are
    // malformed. resolveAspect (aspect.js) trusts these to be
    // well-formed 'W:H' strings at call time, so a bad declaration is
    // caught here, once, rather than surfacing as a caller-facing error
    // on a real call.
    validateAspects(providerName, models) {
      for (const [ model, meta ] of Object.entries(models)) {
        if (meta.aspects === undefined) {
          continue;
        }
        if (!Array.isArray(meta.aspects) || !meta.aspects.length) {
          fail(`"providers.${providerName}" model "${model}": "aspects" must be a non-empty array of "W:H" ratios`);
        }
        for (const aspect of meta.aspects) {
          if (!parseAspect(aspect)) {
            fail(`"providers.${providerName}" model "${model}" declares an invalid aspect "${aspect}"; use a "W:H" ratio`);
          }
        }
      }
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
    // Validate the shape of the module options, naming the offending
    // entry. Checks that need the adapter registry (unknown adapters,
    // dangling routing references, effort levels with no row) happen
    // later, at activation.
    validateOptions(options) {
      function checkString(value, name) {
        if (value !== undefined && typeof value !== 'string') {
          fail(`"${name}" must be a string`);
        }
      }
      function checkEffortRow(row, name, { provider = false } = {}) {
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
        providers, provider, effort, image, maxSteps, mock, mockImage,
        retryAttempts, retryBaseDelay, retryMaxElapsed,
        jobExpireAfter, jobPollInterval
      } = options;

      if (!isObject(providers)) {
        fail('"providers" must be an object of provider entries');
      }
      for (const [ name, entry ] of Object.entries(providers)) {
        if (!isObject(entry)) {
          fail(`"providers.${name}" must be an object`);
        }
        checkString(entry.apiKey, `providers.${name}.apiKey`);
        checkString(entry.envKey, `providers.${name}.envKey`);
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
        if (image.aspect !== undefined &&
          !Object.hasOwn(NAMED_ASPECTS, image.aspect) &&
          !parseAspect(image.aspect)) {
          fail('"image.aspect" must be "square", "portrait", "landscape" or a "W:H" ratio');
        }
        if (image.quality !== undefined &&
          !QUALITIES.includes(image.quality)) {
          fail('"image.quality" must be "low", "medium" or "high"');
        }
        // Inline model metadata on the routing entry participates in
        // aspect resolution, so it gets the same startup vetting as a
        // declared model's
        if (image.aspects !== undefined && (
          !Array.isArray(image.aspects) || !image.aspects.length ||
          image.aspects.some((aspect) => !parseAspect(aspect))
        )) {
          fail('"image.aspects" must be a non-empty array of "W:H" ratios');
        }
      }

      if (!Number.isInteger(maxSteps) || maxSteps < 1) {
        fail('"maxSteps" must be a positive integer');
      }

      if (mock !== undefined && typeof mock !== 'function') {
        fail('"mock" must be a function');
      }

      if (mockImage !== undefined && typeof mockImage !== 'function') {
        fail('"mockImage" must be a function');
      }

      for (const [ name, value ] of Object.entries({
        retryAttempts,
        retryBaseDelay,
        retryMaxElapsed,
        jobPollInterval
      })) {
        if (!Number.isInteger(value) || value < 1) {
          fail(`"${name}" must be a positive integer`);
        }
      }

      if (!Number.isInteger(jobExpireAfter) || jobExpireAfter < 0) {
        fail('"jobExpireAfter" must be a non-negative integer');
      }
    }
  };
};
