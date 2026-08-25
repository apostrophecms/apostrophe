# Apostrophe CLI

The Apostrophe CLI scaffolds widgets, pieces, and modules inside an existing [ApostropheCMS](https://github.com/apostrophecms/apostrophe) project, and wraps a few other useful functions into an easy to use command line tool.

**Requires Node.js 22+**

## You don't need this to start a project

To create a new Apostrophe project, run the guided installer directly — no install required:

```bash
npm create apostrophe@latest
```

See the [create-apostrophe README](https://github.com/apostrophecms/apostrophe/tree/main/packages/create-apostrophe#readme) for starter kits, unattended mode, and the full flag list.

Install the CLI when you want the `add` commands, which generate module boilerplate inside a project you already have.

## Installation

```bash
npm install -g @apostrophecms/cli
```

To view the available commands in a given context, execute the `apos` command with no arguments:

```bash
apos
```

**Note:** All Apostrophe CLI commands can also be run with `apostrophe`, the legacy command, in addition to `apos`.

## Create a project

If you already have the CLI installed, `apos create` is a convenience alias for the guided installer:

```bash
apos create
```

It takes no arguments — project name, starter kit, and database are all chosen through prompts. It does exactly what `npm create apostrophe@latest` does, so use whichever you find handier.

For scripted or CI installs, call the installer directly, since `apos create` doesn't pass arguments through:

```bash
npm create apostrophe@latest -- --unattended \
  --project-name=my-site --password=secret --telemetry=off
```

## Telemetry

Telemetry is opt-in and anonymous. If you have the CLI installed, you can manage your preference through it:

```bash
apos telemetry status    # show current preference
apos telemetry on        # opt in
apos telemetry off       # opt out
apos telemetry preview   # print the exact payload that would be sent
```

These are aliases too — `npm create apostrophe@latest -- telemetry status` works the same way, without the CLI. `create-apostrophe` owns the telemetry implementation; see its [README](https://github.com/apostrophecms/apostrophe/tree/main/packages/create-apostrophe#readme) for exactly what is collected, and the `APOS_TELEMETRY=0` kill switch.

## Astro projects

Hybrid ApostropheCMS + Astro projects are detected by the presence of a `backend/` directory.

**The `add` commands below are not supported in hybrid Astro projects.** Running `apos add` from the root of such a project exits with an error.

To create a hybrid project, choose an Astro starter kit when the installer prompts you.

## Create a widget

To bootstrap the necessary files and basic configuration for a new Apostrophe widget, run the following command from within your Apostrophe project's root directory:

```bash
# "-widgets" will automatically be appended to the end of your module name
apos add widget fancy-button
```

**Note:** You will then need to register this widget module in `app.js` so it is available in your project code. The same is true for the commands below when you create a piece module or generic module.

```javascript
// app.js
module.exports = {
  // ...
  'fancy-button-widgets': {},
  // ...
}
```

Add a `--player` option to the command to include the client-side Javascript "player" boilerplate to the new widget module as well.

```bash
apos add widget tabs --player
```

## Create a piece

To bootstrap the necessary files and basic configuration for a new Apostrophe piece type, run the following command from within your Apostrophe project's root directory:

```bash
apos add piece vegetable
```

Then remember to register `'vegetable': {}` in `app.js` above.

If you run the `add piece` command with the `--page` flag, the command will also set up a corresponding piece-pages module with your new piece type.

```bash
apos add piece vegetable --page
```

## Create an empty Apostrophe module

To bootstrap the necessary files and basic configuration for a brand-new Apostrophe module that doesn't extend one of the usual suspects like pieces or widgets:

```bash
apos add module <module name>
```

Remember to register the module in `app.js` with the other module types.

---------------

For more documentation for ApostropheCMS, visit the [documentation site](https://apostrophecms.com/docs/).
