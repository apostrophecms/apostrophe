const { stripIndent } = require('common-tags');

module.exports = (self) => {
  function insertBundlesMarkup({
    page = {},
    template = '',
    scene,
    content,
    scriptsPlaceholder,
    stylesheetsPlaceholder,
    widgetsBundles = {}
  }) {
    const modulePreload = new Set();
    const renderMarkup = renderBundleMarkup(self, modulePreload);
    if (!scriptsPlaceholder && !stylesheetsPlaceholder) {
      return content;
    }

    const { es5 } = self.apos.asset.options;
    const { extraBundles, rebundleModules } = self.apos.asset;

    const jsMainBundle = renderMarkup({
      fileName: scene,
      ext: 'js',
      es5
    });
    const cssMainBundle = renderMarkup({
      fileName: scene,
      ext: 'css'
    });

    if (scene === 'apos') {
      return loadAllBundles({
        content,
        scriptsPlaceholder,
        stylesheetsPlaceholder,
        extraBundles,
        renderMarkup,
        jsMainBundle,
        modulePreload,
        cssMainBundle,
        es5
      });
    }

    const templateType = template.substring(template.lastIndexOf(':') + 1);
    const pageModule = page.type && self.apos.modules[page.type];
    const metadata = pageModule
      ? (
        self.apos.asset.hasBuildModule()
          ? pageModule.__meta.build
          : pageModule.__meta.webpack
      ) : {};

    const rebundleConfigs = rebundleModules.filter(entry => {
      const names = pageModule?.__meta?.chain?.map(c => c.name) ?? [ page.type ];
      return names.includes(entry.name);
    });

    const configs = Object.entries(metadata || {})
      .reduce((acc, [ moduleName, config ]) => {
        if (self.apos.asset.hasBuildModule()) {
          config = config?.[self.apos.asset.getBuildModuleAlias()];
        }
        if (!config || !config.bundles) {
          return acc;
        }
        return {
          ...acc,
          ...self.apos.asset.transformRebundledFor(
            moduleName,
            config.bundles,
            rebundleConfigs
          )
        };
      }, widgetsBundles);

    const { jsBundles, cssBundles } = Object.entries(configs)
      .reduce((acc, [ name, { templates } ]) => {
        if (templates && !templates.includes(templateType)) {
          return acc;
        }

        const jsMarkup = scriptsPlaceholder &&
        extraBundles.js.includes(name) &&
          renderMarkup({
            fileName: name,
            ext: 'js',
            es5
          });

        const cssMarkup = stylesheetsPlaceholder &&
          extraBundles.css.includes(name) &&
          renderMarkup({
            fileName: name,
            ext: 'css'
          });

        return {
          jsBundles: stripIndent`
            ${acc.jsBundles}
            ${jsMarkup || ''}
          `,
          cssBundles: stripIndent`
            ${acc.cssBundles}
            ${cssMarkup || ''}
          `
        };
      }, {
        jsBundles: jsMainBundle,
        cssBundles: cssMainBundle
      });

    const jsFinal = stripIndent`
        ${jsBundles}
        ${Array.from(modulePreload).join('\n')}
      `;

    return content
      .replace(scriptsPlaceholder, jsFinal)
      .replace(stylesheetsPlaceholder, cssBundles);
  }

  return { insertBundlesMarkup };
};

function renderBundleMarkup(self, modulePreload) {
  // The new system only for external build modules
  if (self.apos.asset.hasBuildModule()) {
    return renderBundleMarkupByManifest(self, modulePreload);
  }
  const safe = self.apos.template.safe;
  const base = self.apos.asset.getAssetBaseUrl();

  return ({
    fileName, ext = 'js', es5 = false
  }) => {
    if (ext === 'css') {
      return safe(stripIndent`
        <link href="${base}/${fileName}-bundle.css" rel="stylesheet" />
      `);
    }

    if (es5) {
      return safe(stripIndent`
        <script nomodule src="${base}/${fileName}-nomodule-bundle.${ext}"></script>
        <script type="module" src="${base}/${fileName}-module-bundle.${ext}"></script>
      `);
    }

    return safe(stripIndent`
      <script src="${base}/${fileName}-module-bundle.${ext}"></script>
    `);
  };
}

function renderBundleMarkupByManifest(self, modulePreload) {
  const safe = self.apos.template.safe;

  return ({
    fileName, ext = 'js', es5 = false
  }) => {
    const entries = self.apos.asset.getBundlePageMarkup({
      scene: fileName,
      output: ext,
      modulePreload,
      es5
    });

    return safe(
      stripIndent`
      ${entries.join('\n')}
      `
    );
  };
}

function loadAllBundles({
  content,
  extraBundles,
  scriptsPlaceholder,
  stylesheetsPlaceholder,
  jsMainBundle,
  modulePreload,
  cssMainBundle,
  renderMarkup,
  es5
}) {
  const reduceToMarkup = (acc, bundle, ext) => {
    const bundleMarkup = renderMarkup({
      fileName: bundle.replace(`.${ext}`, ''),
      ext,
      es5
    });

    return stripIndent`
      ${acc}
      ${bundleMarkup}
    `;
  };

  const jsBundles = extraBundles.js.reduce(
    (acc, bundle) => reduceToMarkup(acc, bundle, 'js'), jsMainBundle
  );

  const cssBundles = extraBundles.css.reduce(
    (acc, bundle) => reduceToMarkup(acc, bundle, 'css'), cssMainBundle
  );

  const jsFinal = stripIndent`
    ${jsBundles}
    ${Array.from(modulePreload).join('\n')}
  `;

  return content
    .replace(scriptsPlaceholder, jsFinal)
    .replace(stylesheetsPlaceholder, cssBundles);
}
