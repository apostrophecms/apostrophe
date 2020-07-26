const fs = require('fs-extra');
const replace = require('replace-in-file');
const quote = require('regexp-quote');

const rename = {
  'areas': 'area',
  'assets': 'asset',
  'attachments': 'attachment',
  'busy': 'busy',
  'caches': 'cache',
  'db': 'db',
  'doc-type': 'doc-type',
  'docs': 'doc',
  'email': 'email',
  'errors': 'error',
  'express': 'express',
  'files': 'file',
  'files-tags': 'file-tag',
  'files-widgets': 'file-widget',
  'global': 'global',
  'groups': 'group',
  'home-pages': 'home-page',
  'html-widgets': 'html-widget',
  'http': 'http',
  'i18n': 'i18n',
  'images': 'image',
  'images-tags': 'image-tag',
  'images-widgets': 'image-widget',
  'jobs': 'job',
  'launder': 'launder',
  'locks': 'lock',
  'login': 'login',
  'migrations': 'migration',
  'modals': 'modal',
  'module': 'module',
  'notifications': 'notification',
  'oembed': 'oembed',
  'page-type': 'page-type',
  'pager': 'pager',
  'pages': 'page',
  'permissions': 'permission',
  'piece-type': 'piece-type',
  'pieces-page-type': 'piece-page-type',
  'pieces-widget-type': 'piece-widget-type',
  'polymorphic-type': 'polymorphic-type',
  'rich-text-widgets': 'rich-text-widget',
  'schemas': 'schema',
  'search': 'search',
  'soft-redirects': 'soft-redirect',
  'storybook': 'storybook',
  'tasks': 'task',
  'templates': 'template',
  'trash': 'trash',
  'ui': 'ui',
  'urls': 'url',
  'users': 'user',
  'utils': 'util',
  'versions': 'version',
  'video-fields': 'video-field',
  'video-widgets': 'video-widget',
  'widget-type': 'widget-type'
};

let oldName, newName;

for ([ oldName, newName ] of Object.entries(rename)) {
  console.log(`${oldName} -> ${newName}`);
  const oldFilename = `lib/modules/@apostrophecms/${oldName}`;
  const newFilename = `lib/modules/@apostrophecms/${newName}`;
  if (fs.existsSync(oldFilename)) {
    fs.renameSync(oldFilename, newFilename);
  }
  replace.sync({
    files: `${newFilename}/index.js`,
    from: `alias: '${oldName}'`,
    to: `alias: '${newName}'`
  });
  replace.sync({
    files: 'lib/modules/**/*.js',
    from: new RegExp(quote(`apos.${oldName}`) + '(?=;|,|$)', 'g'),
    to: `apos.${newName}`
  });
}
