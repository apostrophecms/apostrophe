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
    const renderMarkup = renderBundleMarkup(
      self.apos.template.safe,
      self.apos.asset.getAssetBaseUrl()
    );

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
        cssMainBundle,
        es5
      });
    }

    const templateType = template.substring(template.lastIndexOf(':') + 1);
    const pageModule = page.type && self.apos.modules[page.type];
    const { webpack = {} } = pageModule ? pageModule.__meta : {};

    const rebundleConfigs = rebundleModules.filter(entry => {
      const names = pageModule?.__meta?.chain?.map(c => c.name) ?? [ page.type ];
      return names.includes(entry.name);
    });

    const configs = Object.entries(webpack || {})
      .reduce((acc, [ moduleName, config ]) => {
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

    return content
      .replace(scriptsPlaceholder, jsBundles)
      .replace(stylesheetsPlaceholder, cssBundles);
  }

  return { insertBundlesMarkup };
};

function renderBundleMarkup (safe, base) {
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

function loadAllBundles({
  content,
  extraBundles,
  scriptsPlaceholder,
  stylesheetsPlaceholder,
  jsMainBundle,
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

  return content
    .replace(scriptsPlaceholder, jsBundles)
    .replace(stylesheetsPlaceholder, cssBundles);
}
