module.exports = {
  extend: '@apostrophecms/module',
  options: {
    enabled: true
  },
  init(self) {
    self.providers = [ { name: 'fakeProvider' } ];

    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/doc-type:beforeLocalize': {
        // Translate the document using the first available provider.
        async translate(req, doc, source, target, options) {
          if (!req.query.aposTranslateTargets?.includes(target)) {
            return;
          }
          // We don't support multiple providers yet, so just use the first one
          // when no provider is specified.
          const module = self.getProviderModule(req.query.aposTranslateProvider);
          if (!module) {
            const name = req.query.aposTranslateProvider ||
              'apostrophe:notAvailable';

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

          return module.translate(doc, source, target, options);
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

        const module = self.getProviderModule(req.query.provider);
        if (!module) {
          throw self.apos.error(
            'notfound',
            req.t('apostrophe:automaticTranslationLngCheckNoProvider')
          );
        }

        return module.getSupportedLanguages(
          req.query.source ?? [],
          req.query.target ?? []
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
      // - `draft` (Object): The document to translate
      // - `source` (String): The language code of the original document
      // - `target` (String): The language code to translate the document to
      // - `options` (Object): Additional options as passed from the beforeLocalize
      //   event.
      // The `translate` method should directly modify the `draft` object.
      //
      // The provider module must also implement a `getSupportedLanguages` method
      // that takes the following arguments:
      // - `source` (Array): An array of language codes to translate from
      // - `target` (Array): An array of language codes to translate to
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
      addProvider(aposModule, { name, label }) {
        if (typeof aposModule.translate !== 'function') {
          throw new Error(
            `The translation provider module "${aposModule.__meta.name}" has to implement "translate" method.`
          );
        }
        if (typeof aposModule.getSupportedLanguages !== 'function') {
          throw new Error(
            `The translation provider module "${aposModule.__meta.name}" has to implement "getSupportedLanguages" method.`
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
        return self.apos.modules[self.getProvider(name)];
      },
      getBrowserData(req) {
        return {
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
