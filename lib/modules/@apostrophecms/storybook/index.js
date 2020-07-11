const fs = require('fs-extra');

const IMPORTS_PLACEHOLDER = /(\/\/ IMPORTS)/g;
const COMPONENTS_PLACEHOLDER = /(\/\/ COMPONENTS)/g;
const STORIES_PLACEHOLDER = /"STORIES"/g;

module.exports = {
  init(self, options) {
    self.addTask('build', 'update the data/temp/.storybook folder', self.build);
    self.addTask('run', 'start storybook', self.run);
  },
  methods(self, options) {
    return {
      async build(apos, argv) {
        const importsFile = `${self.apos.rootDir}/apos-build/imports.json`;
        const buildDir = self.getBuildDir();
        fs.copySync(`${__dirname}/template`, buildDir);

        const previewTemplate = fs.readFileSync(`${__dirname}/template/.storybook/preview.tmpl.js`, 'UTF-8');

        const imports = JSON.parse(fs.readFileSync(importsFile, 'utf8'));
        const importsCode = imports.components.importCode + imports.icons.importCode;
        const componentsCode = imports.components.registerCode + imports.icons.registerCode;

        const preview = previewTemplate
          .replace(IMPORTS_PLACEHOLDER, importsCode)
          .replace(COMPONENTS_PLACEHOLDER, componentsCode);

        const previewFile = `${buildDir}/.storybook/preview.js`;
        fs.writeFileSync(previewFile, preview);

        const mainTemplate = fs.readFileSync(`${__dirname}/template/.storybook/main.tmpl.js`, 'UTF-8');

        const stories = imports.components.paths.filter(path => fs.existsSync(path.replace(/\.vue$/, '.stories.js'))).map(path => path.replace(/\.vue$/, '.stories.js'));
        const storiesCode = JSON.stringify(stories, null, '  ');
        const mainFile = `${buildDir}/.storybook/main.js`;
        const main = mainTemplate
          .replace(STORIES_PLACEHOLDER, storiesCode);
        fs.writeFileSync(mainFile, main);

        require('child_process').execSync(`cd ${buildDir} && npm install`);
      },
      async run(apos, argv) {
        await self.build();
        const buildDir = self.getBuildDir();
        process.env.APOS_ROOT = self.apos.rootDir;
        require('child_process').execSync(`cd ${buildDir} && npx start-storybook -s ./public -p 9001 -c .storybook`, { stdio: 'inherit' });
      },
      getBuildDir() {
        const buildDir = `${self.apos.rootDir}/data/temp/storybook`;
        fs.ensureDirSync(`${buildDir}/.storybook`);
        return buildDir;
      }
    };
  }
};
