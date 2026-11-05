// The JSX version of `column.html`, used when the `jsx` option of
// @apostrophecms/template is set. Rendered for each item of a layout
// widget's area, with the area's data plus `item` and `widgetOptions`.
export default function ({
  area, canEdit, scene, item
}, { Area, helpers }) {
  const lastId = helpers.modules['@apostrophecms/layout-widget']
    .detectLastTabletFullWidthItem(area.items);
  const stylesHelpers = helpers.modules['@apostrophecms/styles'];
  const styles = stylesHelpers.render(item);
  const styleTag = stylesHelpers.elements(styles, scene);
  const wrapperAttrs = stylesHelpers.attributes(styles, {}, { asObject: true }) || {};
  const attrs = {};
  for (const [ key, value ] of Object.entries(wrapperAttrs)) {
    if (key !== 'style') {
      attrs[key] = value ?? '';
    }
  }
  if (canEdit) {
    attrs['data-apos-widget'] = item._id ?? '';
  }
  attrs['data-visible-tablet'] = String(item.showTablet !== false);
  attrs['data-visible-mobile'] = String(item.showMobile !== false);
  if (lastId && (item._id === lastId)) {
    attrs['data-tablet-full'] = 'true';
  }
  const value = (v) => v ?? '';
  attrs.style = `${wrapperAttrs.style || ''} ` +
    `--colstart: ${value(item.colstart)}; ` +
    `--colspan: ${value(item.colspan)}; ` +
    `--rowstart: ${value(item.rowstart)}; ` +
    `--rowspan: ${value(item.rowspan)}; ` +
    `--order: ${value(item.order)};`;
  return (
    <>
      {styleTag}
      <div {...attrs}>
        <Area doc={item} name='content' />
      </div>
    </>
  );
}
