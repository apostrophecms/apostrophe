export default async function getDataForInlineRender(Astro) {
  if (!(Astro && Astro.request)) {
    usage();
  }
  if (Astro.request.method !== 'POST') {
    throw new Error('POST with JSON data expected');
  }
  if (Astro.request.headers.get('apos-external-front-key') !== process.env.APOS_EXTERNAL_FRONT_KEY) {
    throw new Error('apos-external-front-key header missing or incorrect');
  }
  const data = await Astro.request.json();
  const area = data.area;
  const widgetOptions = getWidgetOptions(area.options);
  return area.items.map(item => {
    const options = {
      ...item._options,
      ...widgetOptions[item.type]
    };
    const { _options, ...cleanItem } = item;
    return {
      widget: cleanItem,
      options,
      ...Astro.props
    };
  });
}

function usage() {
  throw new Error('Pass { Astro, AstroContainer, AposWidget } to this function');  
}

function getWidgetOptions(options) {
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
