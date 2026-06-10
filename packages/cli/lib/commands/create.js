// Thin delegate: hands off to create-apostrophe's guided installer. Owns
// no UI of its own — Commander supplies `--help` for this subcommand.

module.exports = function (program) {
  program
    .command('create')
    .description('Create an Apostrophe project — launches the guided installer.')
    .action(async function () {
      const { runInteractive } = await import('create-apostrophe');
      const code = await runInteractive();
      process.exit(typeof code === 'number' ? code : 0);
    });
};
