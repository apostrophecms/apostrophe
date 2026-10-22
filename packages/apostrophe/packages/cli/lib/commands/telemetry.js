// Thin delegate: forwards each `apos telemetry <sub>` to create-apostrophe.
// Commander supplies `--help` for the parent and each subcommand.

module.exports = function (program) {
  const telemetry = program
    .command('telemetry')
    .description('Manage telemetry preference for ApostropheCMS CLI.');

  for (const [ sub, summary ] of [
    [ 'status', 'Show current telemetry preference.' ],
    [ 'on', 'Opt in.' ],
    [ 'off', 'Opt out.' ],
    [ 'preview', 'Print the exact payload that would be sent.' ]
  ]) {
    telemetry
      .command(sub)
      .description(summary)
      .action(async function () {
        const { runTelemetryCommand } = await import('create-apostrophe');
        const code = await runTelemetryCommand({ sub });
        process.exit(typeof code === 'number' ? code : 0);
      });
  }
};
