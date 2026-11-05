// The JSX version of `area.html`, used when the `jsx` option of
// @apostrophecms/template is set. Keep the two in step; the parity tests
// compare them.

import { jsonAttribute } from '../../template/lib/jsxFilters.js';

export default function (data, { helpers, Template, Widget }) {
  const {
    area, field, options, choices, _with, canEdit
  } = data;
  const attrs = {
    className: `apos-area${_with?.aposClassName ? ` ${_with.aposClassName}` : ''}`
  };
  if (canEdit) {
    Object.assign(attrs, {
      'data-apos-area-newly-editable': true,
      'data-doc-id': jsonAttribute(area._docId),
      'data-module': jsonAttribute(field.moduleName),
      'data-field-id': jsonAttribute(field._id),
      'data-options': jsonAttribute(helpers.util.omit(options, 'area')),
      data: jsonAttribute(area),
      'data-choices': jsonAttribute(choices),
      'data-parent-options': jsonAttribute(_with?.aposParentOptions)
    });
  }
  if (_with?.aposStyle) {
    attrs.style = _with.aposStyle;
  }
  for (const [ key, value ] of Object.entries(_with?.aposAttrs || {})) {
    attrs[`data-${key}`] = jsonAttribute(value);
  }
  return (
    <div {...attrs}>
      {(area.items || []).map((item) => {
        const widgetOptions = options?.widgets?.[item.type] || {};
        if (options?.widgetTemplate) {
          // Like `{% include %}`: the template sees the area's data plus
          // `item` and `widgetOptions`.
          return (
            <Template
              templateName={options.widgetTemplate}
              item={item}
              widgetOptions={widgetOptions}
            />
          );
        }
        const widget = <Widget widget={item} options={widgetOptions} with={_with} />;
        return canEdit
          ? <div data-apos-widget={item._id}>{widget}</div>
          : widget;
      })}
    </div>
  );
}
