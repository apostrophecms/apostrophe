# Apostrophe CLI

The Apostrophe CLI is a cross-platform starting point for creating and configuring [ApostropheCMS](https://github.com/apostrophecms/apostrophe) projects, providing a simple boilerplate generator and wrapping other useful functions into an easy to use command line tool.

**Requires Node.js 8+**

First, install `@apostrophecms/cli` as a global NPM module:

```bash
npm install -g @apostrophecms/cli
```

To view the available commands in a given context, execute the `apos` command with no arguments:

```bash
apos
```

**Note:** All Apostrophe CLI commands can also be run with `apostrophe`, the legacy command, in addition to `apos`.

## Create a project

To create a new project with the tool:
```bash
apos create <shortname-without-spaces>
```

This will create a local copy of the [apostrophe essentials starter kit](https://github.com/apostrophecms/starter-kit-essentials).

### options

#### `--starter`

Run `create` with a `--starter` flag to start from a Github repository other than the standard starters. For example, `apos create <shortname-without-spaces> --starter=https://github.com/apostrophecms/apostrophe-open-museum.git` would create a project using the [Open Museum](https://github.com/apostrophecms/apostrophe-open-museum) demo. The `--starter` flag also accepts shortened names for any of the [existing starter kits](https://github.com/orgs/apostrophecms/repositories?q=starter-kit&type=all) that consists of the name of the repo with the `starter-kit-` prefix removed. For example, `apos create <shortname-without-spaces> --starter=ecommerce` for the `starter-kit-ecommerce` repo. Finally, if you are using a personal or organizational repo, you can prefix your repo with it's location followed by the name to automatically add `https://github.com/`. For example, `apos create <shortname-without-spaces> --starter=mycoolcompany/my-starter`.

#### `--mongodb-uri`
If you are not using a locally hosted MongoDB server, you can provide a connection string with the `--mongodb-uri` flag. For the standard Atlas connection string, you will need to add quotes around the connection string due to the query parameters. This allows for the creation of an admin user during project creation. **Note**: this will not add your connection string to the project. It needs to be included through the `APOS_MONGODB_URI` environment variable, potentially through a `.env` file.


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

If you run the `add piece` command with the `--page` flag, the command will also set up a corresponding piece-pages module with your new piece type. Similarly, you can run the `add piece` command with the `--widget` flag, which will also set up a corresponding piece-widgets module along with your new piece type. These flags can be used together or separately.

```bash
apos add piece vegetable --page --widget
```

## Create an empty Apostrophe module
To bootstrap the necessary files and basic configuration for a brand-new Apostrophe module that doesn't extend one of the usual suspects like pieces or widgets:
```bash
apos add module <module name>
```

Remember to register the module in `app.js` with the other module types.

---------------

For more documentation for ApostropheCMS, visit the [documentation site](https://docs.apostrophecms.org).
