const _ = require('lodash');
const glob = require('glob');
const fs = require('fs-extra');
const Promise = require('bluebird');
const webpackModule = require('webpack');
const globalIcons = require('./lib/globalIcons');

// Wrap webpack to report its errors readably, in
// preparation to promisify it

function webpack(config, cb) {
  return webpackModule(config, function (err, stats) {
    if (err || stats.hasErrors()) {
      return cb(err || stats.toJson().errors.join('\n'));
    }
    return cb(null);
  });
}

module.exports = {
  options: { alias: 'assets' },
  init(self, options) {
    self.addTask('build', 'Build Apostrophe frontend javascript master import files', async function (apos, argv) {
      const buildDir = `${apos.rootDir}/apos-build`;
      const modulesDir = `${buildDir}/modules`;
      const bundleDir = `${apos.rootDir}/public/apos-frontend`;

      // Don't clutter up with previous builds.
      await fs.remove(buildDir);
      await fs.mkdir(buildDir);
      await fs.mkdir(modulesDir);
      await fs.remove(bundleDir);
      await fs.mkdir(bundleDir);
      await moduleOverrides();
      anon();
      await user();
      merge();

      async function moduleOverrides() {
        let names = {};
        const directories = {};
        for (let name of Object.keys(self.apos.modules)) {
          const ancestorDirectories = [];
          for (let entry of self.apos.modules[name].__meta.chain) {
            const effectiveName = entry.name.replace(/^my-/, '');
            names[effectiveName] = true;
            ancestorDirectories.push(entry.dirname);
            directories[effectiveName] = directories[effectiveName] || [];
            for (let dir of ancestorDirectories) {
              if (!directories[effectiveName].includes(dir)) {
                directories[effectiveName].push(dir);
              }
            }
          }
        }
        names = Object.keys(names);
        for (let name of names) {
          const moduleDir = `${modulesDir}/${name}`;
          for (let dir of directories[name]) {
            const srcDir = `${dir}/src/apos`;
            if (fs.existsSync(srcDir)) {
              await fs.copy(srcDir, moduleDir);
            }
          }
        }
      }

      function anon() {
        // We do not use an import file here because import is not
        // an ES5 feature and it is contrary to the spirit of ES5 code
        // to force-fit that type of code. We do not mandate ES6 in
        // "always" code (loaded for logged-out users who might have
        // old browsers).
        //
        // Of course, developers can push an "always" asset that is
        // the output of an ES6 pipeline.
        const alwaysImports = getImports('always', '*.js', { });
        fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/anon-bundle.js`,
          `
window.apos = window.apos || {};
Object.assign(window.apos, JSON.parse((document.body && document.body.getAttribute('data-apos')) || '{}'));
          ` +
        alwaysImports.paths.map(path => {
          return fs.readFileSync(path);
        }).join('\n')); // TODO: use webpack just to minify at the end.
      }

      async function user() {
        const iconImports = getIcons();
        const componentImports = getImports('components', '*.vue', { registerComponents: true });
        const tiptapExtensionImports = getImports('tiptap-extensions', '*.js', { registerTiptapExtensions: true });
        const appImports = getImports('apps', '*.js', { invokeApps: true });
        const importFile = `${buildDir}/import.js`;

        fs.writeFileSync(importFile, `
import Vue from 'apostrophe/vue';
if (window.apos.modules) {
  for (const module of Object.values(window.apos.modules)) {
    if (module.alias) {
      window.apos[module.alias] = module;
    }
  }
}
window.apos.bus = new Vue();

${iconImports.importCode}
${iconImports.registerCode}
${componentImports.importCode}
${tiptapExtensionImports.importCode}
${appImports.importCode}
${iconImports.registerCode}
${componentImports.registerCode}
${tiptapExtensionImports.registerCode}
setImmediate(() => {
${appImports.invokeCode}
});
        `);

        fs.writeFileSync(`${buildDir}/imports.json`, JSON.stringify({
          icons: iconImports,
          components: componentImports,
          tiptapExtensions: tiptapExtensionImports,
          apps: appImports
        }));

        await Promise.promisify(webpack)(require('./lib/webpack.config')(
          {
            importFile,
            modulesDir
          },
          apos
        ));
      }

      function getIcons() {
        // Load global vue icon components.
        const output = {
          importCode: '',
          registerCode: ''
        };

        if (globalIcons) {
          for (const icon in globalIcons) {
            output.importCode += `import ${globalIcons[icon]}Icon from 'vue-material-design-icons/${globalIcons[icon]}.vue';\n`;

            output.registerCode += `Vue.component('${icon}', ${globalIcons[icon]}Icon);\n`;
          }
        }

        return output;
      }

      function merge() {
        fs.writeFileSync(`${apos.rootDir}/public/apos-frontend/user-bundle.js`, fs.readFileSync(`${apos.rootDir}/public/apos-frontend/anon-bundle.js`) + fs.readFileSync(`${apos.rootDir}/public/apos-frontend/user-only-bundle.js`));
      }

      function getImports(folder, pattern, options) {
        let components = [];
        const seen = {};
        _.each(self.apos.modules, function (module, name) {
          _.each(module.__meta.chain, function (entry) {
            if (seen[entry.dirname]) {
              return;
            }
            components = components.concat(glob.sync(`${entry.dirname}/src/apos/${folder}/${pattern}`));
            seen[entry.dirname] = true;
          });
        });
        const output = {
          importCode: '',
          registerCode: '',
          invokeCode: '',
          paths: []
        };

        components.forEach(component => {
          const jsFilename = JSON.stringify(component);
          const name = require('path').basename(component).replace(/\.\w+/, '');
          const jsName = JSON.stringify(name);
          output.paths.push(component);
          const importCode = `
          import ${name} from ${jsFilename};
          `;
          output.importCode += `${importCode}\n`;

          if (options.registerComponents) {
            output.registerCode += `Vue.component(${jsName}, ${name});\n`;
          }

          if (options.registerTiptapExtensions) {
            output.registerCode += `
apos.tiptapExtensions = apos.tiptapExtensions || [];
apos.tiptapExtensions.push(${name});
`;
          }
          if (options.invokeApps) {
            output.invokeCode += `${name}();\n`;
          }
        });
        return output;
      }
    });
  },
  middleware(self, options) {
    return {
      serveStaticAssets: {
        before: '@apostrophecms/express',
        middleware: self.apos.express.static(self.apos.rootDir + '/public', self.options.static || {})
      }
    };
  },
  methods(self, options) {
    return {
      scriptsHelper(when) {
        // TODO we still need an asset generation identifier
        const bundle = when === 'user' ? '<script src="/apos-frontend/user-bundle.js"></script>' : '<script src="/apos-frontend/anon-bundle.js"></script>';
        return self.apos.templates.safe(`
${bundle}
`);
      }
    };
  },
  helpers(self, options) {
    return {
      stylesheets: function (when) {
      },
      scripts: function (when) {
        return self.scriptsHelper(when);
      }
    };
  }
};
