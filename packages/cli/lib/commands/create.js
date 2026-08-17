// Thin delegate: hands off to create-apostrophe's guided installer. Owns
// no UI of its own — Commander supplies `--help` for this subcommand. The
// only thing it forwards is `--starter`, so a developer can name a custom
// starter (kit name, org/repo, or git URL) and skip the kit prompt.

module.exports = function (program) {
  const command = program
    .command('create')
    .description('Create an Apostrophe project — launches the guided installer.')
    .option(
      '--starter <name-or-url>',
      'Start from a specific starter instead of choosing a kit interactively. ' +
      'Accepts the short name of an official starter kit (e.g. "ecommerce"), ' +
      'an org/repo (e.g. "myorg/my-starter"), or a full git URL.'
    )
    .action(async function () {
      const { starter } = command.opts();
      const { runInteractive } = await import('create-apostrophe');
      const code = await runInteractive({ starter });
      process.exit(typeof code === 'number' ? code : 0);
    });
};
