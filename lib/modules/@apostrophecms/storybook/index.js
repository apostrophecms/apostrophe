const fs = require('fs-extra');

const IMPORTS_PLACEHOLDER = /(\/\/ IMPORTS)/g;
const COMPONENTS_PLACEHOLDER = /(\/\/ COMPONENTS)/g;
const STORIES_PLACEHOLDER = /"STORIES"/g;
const childProcess = require('child_process');

module.exports = {
  init(self, options) {
    self.addTask('build', 'pass a folder name to build a static storybook', self.build);
    self.addTask('run', 'start storybook dev server', self.run);
    self.addTask('deploy', 'deploy static storybook to github pages of your project repo', self.deploy);
  },
  methods(self, options) {
    return {
      async build(apos, argv) {
        const target = require('path').resolve(process.cwd(), argv._[1]);
        if (!target) {
          throw 'Must specify target directory as first argument.';
        }
        await self.preBuild(argv);
        const buildDir = self.getBuildDir();
        process.env.APOS_ROOT = self.apos.rootDir;
        childProcess.execSync(`cd ${buildDir} && npx build-storybook -s ./public -c .storybook -o ${target}`, { stdio: 'inherit' });
      },
      async run(apos, argv) {
        await self.preBuild(argv);
        const buildDir = self.getBuildDir();
        process.env.APOS_ROOT = self.apos.rootDir;
        childProcess.execSync(`cd ${buildDir} && npx start-storybook -s ./public -p 9001 -c .storybook`, { stdio: 'inherit' });
      },
      async deploy(apos, argv) {
        await self.preBuild(argv);
        const buildDir = self.getBuildDir();
        process.env.APOS_ROOT = self.apos.rootDir;
        require('child_process').execSync(`
          cd ${buildDir} &&
          npx build-storybook -s ./public -c .storybook -o $APOS_ROOT/data/temp/storybook-static &&
          npx storybook-to-ghpages -e $APOS_ROOT/data/temp/storybook-static &&
          rm -rf $APOS_ROOT/data/temp/storybook-static
        `, { stdio: 'inherit' });
      },
      async preBuild(options) {
        await self.apos.tasks.invoke('@apostrophecms/assets:build');
        const importsFile = `${self.apos.rootDir}/apos-build/imports.json`;
        const buildDir = self.getBuildDir();
        if (options.clean) {
          fs.removeSync(buildDir);
          fs.ensureDirSync(`${buildDir}/.storybook`);
        }
        fs.copySync(`${__dirname}/template`, buildDir);

        const previewTemplate = fs.readFileSync(`${__dirname}/template/.storybook/preview.tmpl.js`, 'UTF-8');

        const imports = JSON.parse(fs.readFileSync(importsFile, 'utf8'));
        let importsCode = imports.components.importCode + imports.icons.importCode; // + imports.tiptapExtensions.importCode;
        let componentsCode = imports.components.registerCode + imports.icons.registerCode; // + imports.tiptapExtensions.registerCode;
        // Currently tiptap has npm install problems that are not worth fighting for storybook
        // https://github.com/ueberdosis/tiptap/issues/760
        // adding prosemirror-tables: ^0.9.x did not help unfortunately
        importsCode = importsCode.replace(/import Apos(trophe)?RichTextWidgetEditor from [^;]*;/, '');
        componentsCode = componentsCode.replace(/Vue.component\("Apos(trophe)?RichTextWidgetEditor", Apos(trophe?)RichTextWidgetEditor\);/, '');
        const preview = previewTemplate
          .replace(IMPORTS_PLACEHOLDER, importsCode)
          .replace(COMPONENTS_PLACEHOLDER, componentsCode);

        // Write the preview file
        const previewFile = `${buildDir}/.storybook/preview.js`;
        fs.writeFileSync(previewFile, preview);

        // Write the manager and theme files
        const managerTemplate = fs.readFileSync(`${__dirname}/template/.storybook/manager.tmpl.js`, 'UTF-8');
        const managerFile = `${buildDir}/.storybook/manager.js`;
        fs.writeFileSync(managerFile, managerTemplate);

        const themeTemplate = fs.readFileSync(`${__dirname}/template/.storybook/theme.tmpl.js`, 'UTF-8');
        const themeFile = `${buildDir}/.storybook/theme.js`;
        fs.writeFileSync(themeFile, themeTemplate);

        // Write the main file
        const mainTemplate = fs.readFileSync(`${__dirname}/template/.storybook/main.tmpl.js`, 'UTF-8');

        const stories = imports.components.paths.filter(path => fs.existsSync(path.replace(/\.vue$/, '.stories.js'))).map(path => path.replace(/\.vue$/, '.stories.js'));
        const storiesCode = JSON.stringify(stories, null, '  ');
        const mainFile = `${buildDir}/.storybook/main.js`;
        const main = mainTemplate
          .replace(STORIES_PLACEHOLDER, storiesCode);
        fs.writeFileSync(mainFile, main);
        fs.copyFileSync(`${self.apos.rootDir}/public/apos-frontend/anon-bundle.js`, `${buildDir}/public/apos-frontend/anon-bundle.js`);

        childProcess.execSync(`cd ${buildDir} && npm install`);
      },
      getBuildDir() {
        const buildDir = `${self.apos.rootDir}/data/temp/storybook`;
        fs.ensureDirSync(`${buildDir}/public/images`);
        return buildDir;
      }
    };
  }
};
