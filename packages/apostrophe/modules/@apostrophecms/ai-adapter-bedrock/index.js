// Amazon Bedrock adapters for `apos.ai`. Bedrock is a gateway: it serves
// other vendors' models behind its own endpoint, key and model ids, so
// each adapter here composes a standard vendor adapter with Bedrock's
// transport. The vendor's catalog, effort rows and capabilities are read
// from its registered definition, and its dialect methods are called at
// request time, so a project's override of the vendor module applies
// through Bedrock too. This module owns only the door: the runtime URL,
// the key, the model id actually sent and the error's request id.
//
// The adapters register themselves with the AI engine at startup:
//
// - `bedrock-anthropic`, the Anthropic Messages dialect, Claude models.
//
// An entry names its AWS `region` and, for a vendor catalog, the
// cross-region inference `profile` Bedrock routes through (`us`, `eu`,
// `global`, …). Both decide the price, so both are reported on every
// usage record. The key is a Bedrock API key (`APOS_BEDROCK_KEY`), or an
// `apiKey` function minting short-term Bedrock tokens.

module.exports = {
  options: {
    // The catalog ids of the anthropic adapter that Bedrock serves.
    // Extend the list when Bedrock serves a model the catalog knows
    anthropicModels: [
      'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'
    ]
  },
  init(self) {
    self.apos.ai.addAdapter(self.anthropicAdapter());
  },
  methods(self) {
    // Both price the request: the profile carries a premium over
    // `global`, and the region is what the AWS bill is split by
    const SETTINGS = {
      region: { usage: true },
      profile: { usage: true }
    };
    return {
      // The `bedrock-anthropic` adapter definition registered with
      // `apos.ai`: the anthropic adapter's lineup, filtered to the
      // models Bedrock serves, behind Bedrock's Anthropic endpoint. Model
      // ids are sent as `<profile>.anthropic.<catalog id>`, for models
      // the catalog does not know yet too; the turn reports the catalog
      // id, which is what Bedrock echoes for Claude anyway.
      anthropicAdapter() {
        const vendor = self.apos.ai.getAdapter('anthropic');
        return {
          name: 'bedrock-anthropic',
          label: `${vendor.label} on Amazon Bedrock`,
          envKey: 'APOS_BEDROCK_KEY',
          settings: SETTINGS,
          // Chat only: Bedrock serves no image output
          capabilities: {
            ...vendor.capabilities,
            image: false
          },
          effort: vendor.effort,
          models: served(vendor.models, self.options.anthropicModels),
          validate() {
            validate(this, 'anthropicModels');
          },
          wireModel(model) {
            return `${this.profile}.anthropic.${model}`;
          },
          async chat(req, request) {
            const dialect = self.apos.modules['@apostrophecms/ai-adapter-anthropic'];
            // The dialect keys on the catalog id (adaptive thinking, for
            // one), so only the finished body carries the wire id
            const body = {
              ...dialect.buildBody(request),
              model: this.wireModel(request.model)
            };
            const response = await self.apos.http.post(`${origin(this)}/anthropic/v1/messages`, {
              headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': dialect.options.version
              },
              body,
              timeout: dialect.options.timeout,
              ...(request.signal && { signal: request.signal })
            });
            return {
              ...dialect.parseResponse(response, request),
              model: request.model
            };
          },
          normalizeError(error) {
            return self.normalizeError(error);
          }
        };
      },
      // Map any error the transport produced to a normalized apos error:
      // the engine's shared status ladder, plus Bedrock's request id
      // header, the same for every vendor it fronts.
      normalizeError(error) {
        return self.apos.ai.normalizeHttpError(error, {
          requestIdHeader: 'x-amzn-requestid'
        });
      }
    };

    // The vendor catalog narrowed to the ids Bedrock serves
    function served(models, ids) {
      return Object.fromEntries(Object.entries(models)
        .filter(([ id ]) => ids.includes(id)));
    }
    // An entry's own baseUrl (an egress proxy, say) wins over the
    // runtime endpoint of its region
    function origin(adapter) {
      return adapter.baseUrl ||
        `https://bedrock-runtime.${adapter.region}.amazonaws.com`;
    }
    // Fail the boot on an entry Bedrock cannot route: a missing key,
    // region or profile, or a native effort row naming a model off the
    // served list. Those rows are the shipped defaults, so they must
    // work as configured; an aliased entry gets none of them.
    function validate(adapter, servedOption) {
      self.apos.ai.requireApiKey(adapter);
      if (!adapter.region) {
        throw new Error(`the "${adapter.provider}" provider requires a "region"`);
      }
      if (!/^[a-z]{2}(-gov)?-[a-z]+-\d+$/.test(adapter.region)) {
        throw new Error(`the "${adapter.provider}" provider's "region" "${adapter.region}" is not an AWS region`);
      }
      if (!adapter.profile) {
        throw new Error(`the "${adapter.provider}" provider requires a "profile"`);
      }
      if (adapter.provider !== adapter.name) {
        return;
      }
      for (const [ level, row ] of Object.entries(adapter.effort)) {
        if (!self.options[servedOption].includes(row.model)) {
          throw new Error(`the "${adapter.provider}" provider's "${level}" effort row names "${row.model}", which is not in the "${servedOption}" option of @apostrophecms/ai-adapter-bedrock`);
        }
      }
    }
  }
};
