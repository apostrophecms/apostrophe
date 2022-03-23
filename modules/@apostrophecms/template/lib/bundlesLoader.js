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
    const { extraBundles } = self.apos.asset;
    const jsMainBundle = renderMarkup({
      fileName: `${scene}-module-bundle`,
      fileNameNoMod: `${scene}-nomodule-bundle`,
      ext: 'js',
      es5
    });
    const cssMainBundle = renderMarkup({
      fileName: `${scene}-bundle`,
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
    const { webpack } = page.type ? self.apos.modules[page.type].__meta : {};

    const configs = Object.values(webpack || {}).reduce((acc, config) => ({
      ...acc,
      ...config && config.bundles
    }), widgetsBundles);

    const { jsBundles, cssBundles } = Object.entries(configs)
      .reduce((acc, [ name, { templates } ]) => {
        if (templates && !templates.includes(templateType)) {
          return acc;
        }

        const jsMarkup = scriptsPlaceholder &&
        extraBundles.js.includes(`${name}.js`) &&
          renderMarkup({
            fileName: name,
            ext: 'js'
          });

        const cssMarkup = stylesheetsPlaceholder &&
          extraBundles.css.includes(`${name}.css`) &&
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
    fileName, fileNameNoMod, ext = 'js', es5 = false
  }) => {
    if (ext === 'css') {
      return safe(stripIndent`
        <link href="${base}/${fileName}.css" rel="stylesheet" />
      `);
    }

    if (es5) {
      return safe(stripIndent`
        <script nomodule src="${base}/${fileNameNoMod}.${ext}"></script>
        <script type="module" src="${base}/${fileName}.${ext}"></script>
      `);
    }

    return safe(stripIndent`
      <script src="${base}/${fileName}.${ext}"></script>
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
  renderMarkup
}) {
  const reduceToMarkup = (acc, bundle, ext) => {
    const bundleMarkup = renderMarkup({
      fileName: bundle.replace(`.${ext}`, ''),
      ext
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
