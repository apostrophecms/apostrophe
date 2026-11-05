// The JSX version of `outerLayoutBase.html`, used when the `jsx` option of
// @apostrophecms/template is set. Each prop named after one of that
// template's blocks stands in for the block: see `lib/jsxLayout.js`. Keep the
// two in step; the parity tests compare them.

import { block, inTag, Raw } from '../lib/jsxLayout.js';
import { escapeAttr } from '../lib/jsxRuntime.js';

function Inject({ Component, where, end }) {
  return (
    <>
      <Component module='@apostrophecms/template' name='inject' where={where} end={end} when='hmr' />
      <Component module='@apostrophecms/template' name='inject' where={where} end={end} />
    </>
  );
}

export default async function ({
  locale, direction, extraHtml, encoding, startHead, title, standardHead,
  extraHead, bodyClass, apostropheMenu, apostropheUserInterface, beforeMain,
  mainAnchor, main, afterMain, extraBody, afterAposScripts,
  i18n, piece, page, scene, aposBodyClasses, aposBodyDataAttributes
}, { Component, helpers }) {
  const asset = helpers.modules['@apostrophecms/asset'];
  // `locale` is also the name of the request's locale in the data, so an
  // override of the block replaces it. `i18n.locale` is the same value.
  const requestLocale = (typeof locale === 'string') ? locale : i18n?.locale;
  const lang = await inTag(block(locale, () => requestLocale));
  const dir = await inTag(block(direction, () => i18n?.direction || 'ltr'));
  // Attributes, inserted as they are.
  const extraHtmlAttrs = (typeof extraHtml === 'string')
    ? extraHtml
    : await inTag(block(extraHtml, () => ''));
  const extraBodyClass = await inTag(block(bodyClass, () => ''));
  const isApos = scene === 'apos';
  return (
    <>
      {new Raw(`<!DOCTYPE html>\n<html lang="${escapeAttr(lang)}" dir="${escapeAttr(dir)}" ${extraHtmlAttrs}>`)}
      <head>
        {block(encoding, () => <meta charset='utf-8' />)}
        {block(startHead, () => null)}
        <Inject Component={Component} where='head' end='prepend' />
        <title>{block(title, () => (piece && piece.title) || (page && page.title))}</title>
        {/* Still here for backwards compatibility, but does nothing */}
        {asset.stylesheets(scene)}
        {block(standardHead, () => <meta name='viewport' content='width=device-width, initial-scale=1' />)}
        <Inject Component={Component} where='head' end='append' />
        {block(extraHead, () => null)}
      </head>
      {new Raw(
        `<body class="${escapeAttr(aposBodyClasses ?? '')} ${extraBodyClass}"` +
        `${aposBodyDataAttributes ?? ''}>`
      )}
      <Inject Component={Component} where='body' end='prepend' />
      {block(apostropheMenu, () => isApos && (
        <>
          <div id='apos-busy'></div>
          <div id='apos-admin-bar'></div>
        </>
      ))}
      {block(apostropheUserInterface, () => isApos && <div id='apos-notification'></div>)}
      <div data-apos-context-label></div>
      <div data-apos-refreshable>
        {block(beforeMain, () => null)}
        {block(mainAnchor, () => <a name='main'></a>)}
        <Inject Component={Component} where='main' end='prepend' />
        {block(main, () => null)}
        <Inject Component={Component} where='main' end='append' />
        {block(afterMain, () => null)}
      </div>
      <Inject Component={Component} where='body' end='append' />
      {block(extraBody, () => null)}
      {isApos && (
        <>
          <div id='apos-modals'></div>
          <div id='apos-command-menu'></div>
        </>
      )}
      {/* Scripts must load after apos-modal in the DOM. Still here for
          backwards compatibility, but does nothing */}
      {asset.scripts(scene)}
      {block(afterAposScripts, () => null)}
      {/* Automatically does nothing in production */}
      {asset.refreshOnRestart()}
      {new Raw('</body>\n</html>\n')}
    </>
  );
}
