# Work with the monorepo

This is a monorepo containing many packages. You will need `pnpm`, not `npm`.

## pnpm installation

[See official documentation](https://pnpm.io/installation). Cheat sheet: `npm install -g pnpm` works.

When pnpm is installed, you can clone the [apostrophe repository](https://github.com/apostrophecms/apostrophe) which is now a monorepo (or just fetch / pull main).

## Monorepo behavior

Inside this repository, there are a few things to see that relate to pnpm and the monorepo:

- `.npmrc` file. Here we ask pnpm when installing dependencies to put every package at the root of the node_modules folder.

```jsx
public-hoist-pattern[]=*
```

Otherwise, pnpm installs dependencies of each dependencies and allow multiple modules to have the same dependency with a different version.

We cannot do that because apostrophe expects to find everything at the root of  `node_modules`.

That’s why we use this option. It still installs very fast because it uses symlinks.

(In local development, pnpm has a global store where it stores dependencies and symlinks them in projects, that’s why it’s very fast.)

- `pnpm-workspace.yaml` file. This file defines the structure of the monorepo to pnpm. It’s very simple for us, because we only have packages, bu we could have `apps` too for example with starter kits.

```jsx
packages:
  - 'packages/*'
```

- In `package.json` file, we have recursive scripts, allowing to run a command that will be run in every package:

```jsx
  "scripts": {
    "lint": "pnpm --recursive run lint",
    "test": "pnpm --recursive run test",
    "eslint": "pnpm --recursive run eslint",
    "mocha": "pnpm --recursive run mocha",
    "clean": "pnpm -r exec rm -rf node_modules && rm -rf node_modules && rm pnpm-lock.yaml"
  },
```

We also have `pnpm` configuration inside `package.json`. We have to tell pnpm which packages have the permission to run post install scripts. This reduces the risk of attacks like `sha1 hulud` which is important to keep us out of the headlines:

```jsx
  "pnpm": {
    "onlyBuiltDependencies": [
      "sharp",
      "vue-demi",
      "@parcel/watcher",
      "esbuild",
      "unrs-resolver"
    ]
  },
```

- Inside `package.json` you will also see new syntax for internal dependencies:

```jsx
  "devDependencies": {
    "eslint": "^9.39.1",
    "eslint-config-apostrophe": "workspace:^"
  }
```

`workspace:` allows us to install a package of the monorepo as a dependency of another package of the monorepo. It’s automatically resolved to the right versionwhen running `pnpm publish`.

There is just onen issue with this, in `testbed` for example we install dependencies this way, directly from the monorepo.

```jsx
"apostrophe": "github:apostrophecms/apostrophe#main&path:packages/apostrophe"
```

(Note the use of `path`, which allows us to pull in a module from a subdirectory of the repo. Regular npm does not support this so we only use it during testing.)

The problem is that in the monorepo, apostrophe has `workspace` dependencies. While it works perfectly inside the monorepo, when installing dependencies in testbed for example, which is external to the monorepo, `pnpm` needs to know how to rewrite them.

So we use a pnpm feature called `pnpmfile` ([see documentation](https://pnpm.io/pnpmfile)). Basically this allows us to hook into the installation process. We can then rewrite the `workspace:` dependencies. We also use this in pro modules that need apostrophe core for tests and are outside of the monorepo.

See the testbed’s `pnpmfile` or look in the pro modules where it enables testing against our latest `main` etc.

## How do I run just one test file?

Let’s say you are in the root of the monorepo and you only want to run mocha for the `test/styles.js` file from `apostrophe`:

```bash
pnpm -C packages/apostrophe mocha test/styles
```

To run **all** of the tests for one module, try:

```jsx
pnpm -C packages/apostrophe test
```

## Working locally

### Basic symlinks

To test a module that is still in development as part of a starter kit, you simply need to create a symlink to the monorepo package you need. (No, you can’t use `npm link`, but `npm link` has been quite broken for quite a while now and the team activately avoids it. So this is not really new.)

- Be sure your monorepo dependencies are installed:

```jsx
cd apostrophe && pnpm install
```

- go to your starter-kit and install dependencies here too (make sure you have a `.npmrc` with the hoisting option):

```jsx
cd starter-kit-essentials && pnpm install
```

- Then link the module you need, in this case `apostrophe`:

> Examples here assume you have the monorepo checked out in `~/apostrophecms/apostrophe`, mirroring the github org name and repo name.
> 

```jsx
rm -rf ./node_modules/apostrophe
ln -s ~/apostrophecms/apostrophe/packages/apostrophe ./node_modules/apostrophe
```

## Internal dependencies

`pnpm` allows this syntax for internal dependencies.

```jsx
{
	"dependencies": {
		"foo": "workspace:*",
		"bar": "workspace:~",
		"qar": "workspace:^",
		"zoo": "workspace:^1.5.0"
	}
}
```

We exclusively want to use this one:

```bash
"qar": "workspace:^",
```

This ensures that when we are ready to publish (see below), the module is published with an npm dependency like:

```bash
"qar": "3.^",
```

So that the customer can `npm update` and get the expected result and not a different major version.

## Changesets

[Changeset CLI documentation](github.com/changesets/changesets/blob/main/docs/command-line-options.md)

### Day to day work

For `CHANGELOG` generation, versioning and publishing we are now using [Changesets](https://github.com/changesets/changesets).

This is a powerful tool made for monorepos.

When you have finished to work on a feature, fix or whatever, just run:

```bash
pnpm changeset
```

It will ask you which packages have been updated by your work. Select each package of interest by pressing the spacebar.

It will then ask what kind of change you made for each package (major / minor / patch). Select "major" only for backwards compatibility breaks - such changes likely will not be accepted without serious consultation. Select "major" for any feature addition. "Patch" for fixes only.

Finally, it will ask for a summary (this will be the changelog entry).

It will create a unique file inside the `.changeset` folder, no more `CHANGELOG` conflicts 🥳.

Include this file in your PR.
