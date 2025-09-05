// Requires an area field's .options property

export default function getWidgets(options) {
  let widgets = options.widgets || {};
  if (options.groups) {
    for (const group of Object.keys(options.groups)) {
      widgets = {
        ...widgets,
        ...options.groups[group].widgets
      };
    }
  }
  return widgets;
}
