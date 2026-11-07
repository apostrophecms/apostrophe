// The JSX version of `widget.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({
  widget, options, manager, global
}, { Area, helpers }) {
  const layout = helpers.modules[manager.__meta.name];
  const option = (name) => options?.[name] || manager.options[name];
  const className = option('className');
  return (
    <Area
      doc={widget}
      name='columns'
      with={{
        aposStyle: `--grid-columns: ${option('columns')};` +
          layout.gapInlineCss(widget, options, global) +
          ' --grid-rows: auto;' +
          ' --mobile-grid-rows: auto;' +
          ' --tablet-grid-rows: auto;' +
          ` --justify-items: ${option('defaultCellHorizontalAlignment') || 'stretch'};` +
          ` --align-items: ${option('defaultCellVerticalAlignment') || 'stretch'};`,
        aposClassName: `layout-widget${className ? ` ${className}` : ''}`,
        aposParentOptions: layout.parentOptionsForArea(widget, options, global),
        aposAttrs: {
          'tablet-auto': true,
          'mobile-auto': true
        }
      }}
    />
  );
}
