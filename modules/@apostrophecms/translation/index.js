module.exports = {
  extend: '@apostrophecms/module',
  options: {
    enabled: true,
    alias: 'translation'
  },
  init(self) {
    self.providers = [];

    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:beforeLocalize': {
        // Translate the document using the first available provider.
        async translate(req, doc, {
          source, target, docType, existing
        }) {
          const targets = req.query.aposTranslateTargets || [];
          const providerName = self.apos.launder.string(req.query.aposTranslateProvider);

          if (!Array.isArray(targets)) {
            throw self.apos.error('invalid', 'Badly formatted translation targets');
          }

          if (!targets.includes(target)) {
            return;
          }

          // We don't support multiple providers yet, so just use the first one
          // when no provider is specified.
          const manager = self.getProviderModule(providerName);

          // Might be the responsability of automatic-translation module
          // since it needs to get the provider and its module anyway
          if (!manager) {
            const name = providerName || 'apostrophe:notAvailable';

            self.logError('before-localize-translate', 'Provider not found.', {
              _id: doc._id,
              title: doc.title,
              provider: name
            });
            return self.apos.notify(
              req,
              req.t(
                'apostrophe:automaticTranslationErrorNoProvider',
                {
                  title: doc.title,
                  name: req.t(name)
                }
              ),
              {
                type: 'danger',
                dismiss: true
              }
            );
          }

          return manager.translate(req, providerName, doc, source, target, {
            docType,
            existing
          });
        }
      }
    };
  },
  apiRoutes: (self) => ({
    get: {
      // Get the list of supported languages for the given provider.
      // If no provider is specified, the first available provider is used.
      // query parameters:
      // - provider: The name of the provider
      // - source: Array of language codes to translate from
      // - target: Array of language codes to translate to
      // Example response:
      // ```json
      // {
      //   source: [
      //     { code: 'en', supported: true },
      //     { code: 'de', supported: true }
      //   ],
      //   target: [
      //     { code: 'en', supported: true },
      //     { code: 'de', supported: true }
      //   ]
      // }
      // ```
      // If no `source` or `target` parameters are provided, the response will
      // contain all supported languages for any source or target language.
      async languages(req) {
        if (!self.canAccessApi(req)) {
          throw self.apos.error('notfound');
        }

        const name = self.getProvider(req.query.provider)?.name;
        const manager = self.getProviderModule(name);

        if (!name || !manager) {
          throw self.apos.error(
            'invalid',
            req.t('apostrophe:automaticTranslationLngCheckNoProvider')
          );
        }

        const source = Array.isArray(req.query.source)
          ? req.query.source.map(self.apos.launder.string)
          : undefined;

        const target = Array.isArray(req.query.target)
          ? req.query.target.map(self.apos.launder.string)
          : undefined;

        return manager.getSupportedLanguages(
          req,
          {
            provider: name,
            source,
            target
          }
        );
      }
    }
  }),
  methods(self, options) {
    return {
      // Add a translation provider to the list of available providers.
      // `aposModule` should be the module object (self), not its name.
      // `name` should be a unique name for the provider.
      // `label` should be a human-readable label for the provider.
      //
      // The provider module must implement a `translate` method that takes
      // the following arguments:
      // - `req` (Object): The request object
      // - `provider` (String): The provider name
      // - `draft` (Object): The document to translate
      // - `source` (String): The language code of the original document
      // - `target` (String): The language code to translate the document to
      // - `options` (Object): Additional options as passed from the beforeLocalize
      //   event.
      // The `translate` method should directly modify the `draft` object.
      //
      // The provider module must also implement a `getSupportedLanguages` method
      // that takes the following arguments:
      // - `req` (Object): The request object
      // - `query` (Object): An object with the following properties:
      //    - `provider` (String): Requried, the provider name
      //    - `source` (Array): Optional, an array of language codes to translate from
      //    - `target` (Array): Optional, an array of language codes to translate to
      // The method should return an object with `source` and `target` properties,
      // each containing an array of objects with `code` and `supported` properties.
      // The `code` property should be the language code and the `supported` property
      // should be a boolean indicating whether the provider supports the language.
      // If no `source` or `target` parameters are provided, the method should return
      // all supported languages for any source or target language.
      //
      // Example:
      // ```js
      // // within a module's `init` method
      // self.apos.translation.addProvider(self, {
      //   name: 'google',
      //   label: 'Google Translate'
      // });
      // ```
      addProvider(aposModule, { name, label } = {}) {
        if (!aposModule?.__meta?.name) {
          throw new Error(
            'Apostrophe module not provided.',
            { cause: 'invalidArguments' }
          );
        }
        if (typeof aposModule.translate !== 'function') {
          throw new Error(
            `The translation provider module "${aposModule.__meta.name}" has to implement "translate" method.`,
            { cause: 'interfaceNotImplemented' }
          );
        }
        if (typeof aposModule.getSupportedLanguages !== 'function') {
          throw new Error(
            `The translation provider module "${aposModule.__meta.name}" has to implement "getSupportedLanguages" method.`,
            { cause: 'interfaceNotImplemented' }
          );
        }

        if (self.providers.some((provider) => provider.name === name)) {
          throw new Error(
            `The translation provider "${name}" is already registered.`,
            { cause: 'duplicate' }
          );
        }

        self.providers.push({
          name,
          label,
          module: aposModule.__meta.name
        });
      },
      getProvider(name) {
        if (!name) {
          return self.providers[0];
        }

        return self.providers.find((provider) => provider.name === name);
      },
      getProviderModule(name) {
        return self.apos.modules[self.getProvider(name)?.module];
      },
      getBrowserData(req) {
        return {
          action: self.action,
          enabled: options.enabled && Boolean(self.providers.length),
          providers: self.providers.map(({ name, label }) => ({
            name,
            label
          }))
        };
      }
    };
  }
};
