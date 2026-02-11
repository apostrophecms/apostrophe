require('shelljs/global');
// Utilities from shelljs
/* globals exec cd rm */
const prompts = require('prompts');
const util = require('../util');
const config = require('../../config');
const fs = require('fs');
const { stripIndent } = require('common-tags');
const quote = require('shell-quote').quote;

module.exports = function (program) {
  program
    .command('create <shortname-without-spaces>')
    .description(
      stripIndent`
      Create an Apostrophe project (using the apostrophe essentials starter kit by default).
      Example: \`apos create my-website\`
    `
    )
    .option(
      '--starter <url>',
      'Use a specific git repository to use as the project starter.\n You can also use the short name of any Apostrophe starter kit, e.g. "ecommerce"'
    )
    .option(
      '--mongodb-uri <url>',
      'Add a connection string to connect to a hosted MongoDB instance.'
    )
    .action(async function (shortName, options) {
      if (!/^[\w-]+$/.test(shortName)) {
        await util.error('create', 'The shortname must only contain letters, numbers, hyphens, and underscores.');
        return false;
      }

      // If options.starter is undefined, use config.BOILERPLATE
      const input = options.starter ? options.starter : config.BOILERPLATE;

      // Check for complete repo URL, starterkit name, or incomplete URL fallback
      let boilerplateUrl;
      if (/^\w+:/.test(input)) {
        boilerplateUrl = input;
      } else if (input.includes('/')) {
        boilerplateUrl = `https://github.com/${
          input.startsWith('/') ? input.slice(1) : input
        }`;
      } else {
        boilerplateUrl = `https://github.com/apostrophecms/starter-kit-${input}.git`;
      }
      util.log(
        'create',
        `Grabbing the ${boilerplateUrl} starter from Github [1/4]`
      );

      // Clone the boilerplate project
      if (exec(`git clone ${boilerplateUrl} ${shortName}`).code !== 0) {
        await util.error('create', 'Error cloning starter code.');
        return false;
      }

      cd(shortName);

      // Remove the initial .git directory.
      rm('-rf', '.git/');

      util.log('create', `Adding your project shortname (${shortName}) [2/4]`);

      // Do some token replaces to rename the project
      // replaces the shortname in app.js
      replaceInConfig(/(shortName:).*?,/gi, `$1 '${shortName}',`);
      // replaces the shortname in package.json
      replaceInConfig(/("name":).*?,/g, `$1 "${shortName}",`);

      // Generate session secret
      let secret = util.secret();

      if (fs.existsSync('./lib/modules/apostrophe-express/index.js')) {
        util.replaceInFiles(
          [ './lib/modules/apostrophe-express/index.js' ],
          /secret: undefined/,
          `secret: '${secret}'`
        );
      }

      // Set disabledFileKey for uploadfs
      secret = util.secret();

      util.replaceInFiles(
        [ './app.js' ],
        /disabledFileKey: undefined/,
        `disabledFileKey: '${secret}'`
      );

      // Remove lock file and install packages.
      util.log('create', 'Installing packages [3/4]');

      if (fs.existsSync('package-lock.json')) {
        rm('package-lock.json');
      }
      if (fs.existsSync('yarn.lock')) {
        rm('yarn.lock');
      }

      try {
        await util.spawnWithSpinner('npm install', {
          spinnerMessage:
            'Installing packages. This will take a little while...'
        });
      } catch (error) {
        await util.error('create', 'Error installing packages');

        console.error(error);
      }

      const cwd = process.cwd();
      const aposPath = `${cwd}/node_modules/apostrophe`;

      // Append the installed Apostrophe version, if in an active project.
      if (!fs.existsSync(aposPath)) {
        await util.error('create', 'Error installing new project packages.');
        return false;
      }
      const version = require(`${aposPath}/package.json`).version;
      await util.getMajorVersion('create', version);

      // Create an admin user (note this will prompt for password)
      util.log('create', 'Creating an admin user [4/4]');
      util.log('create', 'Choose a password for the admin user');

      const response = await prompts({
        type: 'password',
        name: 'pw',
        message: '🔏 Please enter a password:'
      });

      const userTask = '@apostrophecms/user:add';
      let createUserCommand = `node app.js ${userTask} admin admin`;

      // Prepend MongoDB URI if provided
      if (options.mongodbUri) {
        // Ensure the URI is properly quoted to handle special characters
        createUserCommand = `APOS_MONGODB_URI=${quote([ options.mongodbUri ])} ` + createUserCommand;
      }
      util.log('create', `Creating admin user with command: ${createUserCommand}`);
      exec(`echo "${response.pw}" | ${createUserCommand}`);
      util.log('create', 'All done! 🎉 Login as "admin" at the /login URL.');

      await util.success('create');
      return true;
    });
};

function replaceInConfig(regex, replacement) {
  util.replaceInFiles([ './app.js', './package.json' ], regex, replacement);
}
