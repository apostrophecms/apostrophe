import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Resolve `apos` and `public` builds alias `Modules/`. The `sourceRoot` option
 * should be the absolute path to `apos-build/.../src` folder.
 * The `id` option should be either `apos` or `src` depending on the build it's
 * being used for (apos or public respectively).
 *
 * @param {{ id: 'src' | 'apos', sourceRoot: string }} options
 * @returns {import('vite').Plugin}
 */
export default function VitePluginApos({ sourceRoot, id } = {}) {
  if (!id) {
    throw new Error('[vite-plugin-apostrophe-alias] `id` option is required.');
  }
  if (!sourceRoot) {
    throw new Error(
      '[vite-plugin-apostrophe-alias] `sourceRoot` option is required.'
    );
  }
  const pluginOptions = {
    id,
    sourceRoot
  };

  return {
    name: 'vite-plugin-apostrophe-alias',
    enforce: 'pre',
    config() {
      return {
        css: {
          preprocessorOptions: {
            scss: {
              importers: [ { findFileUrl } ]
            }
          }
        },
        resolve: {
          alias: {
            '@': `${sourceRoot}/`
          }
        }
      };
    },

    async resolveId(source, importer, options) {
      if (!source.startsWith('Modules/')) {
        return null;
      }

      const {
        absolutePath, moduleName, chunks
      } = parseModuleAlias(source, pluginOptions);

      const resolved = await this.resolve(
        absolutePath,
        importer,
        options
      );

      if (!resolved) {
        // For internal debugging purposes
        this.warn(
          `Resolve attempt failed: "${source}" -> "${absolutePath}"`
        );
        // For user-facing error messages
        this.error(
          `Unable to resolve module source "${moduleName}/ui/${id}/${join(...chunks)}" ` +
          `from alias "${source}".\n` +
          'Please be sure to use the correct alias path. ' +
          'For more information, see:\n' +
          'https://docs.apostrophecms.org/guide/vite.html#resolve-alias-errors'
        );
      }

      return resolved;
    }
  };

  // Sass FileImporter
  function findFileUrl(url) {
    if (url.startsWith('Modules/')) {
      const { absolutePath } = parseModuleAlias(url, pluginOptions);

      return pathToFileURL(absolutePath);
    }
    return null;
  }
}

function parseModuleAlias(source, pluginOptions) {
  const chunks = source.replace('Modules/', '').split('/');
  let moduleName = chunks.shift();
  if (moduleName.startsWith('@')) {
    moduleName += '/' + chunks.shift();
  }
  // Windows has no objection to / versus \\, but does object
  // to inconsistency, so set ourselves up for success
  const absolutePath = join(
    pluginOptions.sourceRoot,
    moduleName,
    pluginOptions.id,
    ...chunks
  ).replaceAll('\\', '/');

  return {
    moduleName,
    absolutePath,
    chunks
  };
}
