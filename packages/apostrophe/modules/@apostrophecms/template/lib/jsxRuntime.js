// JSX runtime used by Apostrophe `.jsx` templates. The classic Babel
// transform (`@babel/plugin-transform-react-jsx`) compiles `<Tag a={x}>...</Tag>`
// into `h(Tag, { a: x }, ...children)` and `<>...</>` into
// `h(Fragment, null, ...children)`. The `h` function and `Fragment` symbol
// are injected into every compiled module by `jsxLoader.js`.
//
// Output model: `h` returns a nested array of strings, `Raw` markers,
// promises, and arrays. The array is flattened by `flatten()` which awaits
// every promise, escapes plain string values, and joins everything into a
// final HTML string. This array+promise model is what allows JSX templates
// to call asynchronous helpers (`Area`, `Component`, `Template`, `Extend`)
// directly inside markup without wrapping them in `await`.

const voidElements = require('void-elements');

const Fragment = Symbol('AposJsxFragment');

// Marker class for already-rendered raw HTML. Anything wrapped in a `Raw`
// is emitted into the final output without any additional escaping.
class Raw {
  constructor(html) {
    this.html = (html == null) ? '' : String(html);
  }
}

// Compatibility hook: Nunjucks `SafeString` instances (returned by Apostrophe
// helpers like `apos.area.html()` and the `safe` filter) need to flow through
// JSX templates without being escaped a second time. `template/index.js`
// registers Nunjucks's `SafeString` class via `registerSafeClass()`; any
// instance of a registered class is treated as raw HTML.
const safeClasses = [];

function registerSafeClass(cls) {
  if (cls && !safeClasses.includes(cls)) {
    safeClasses.push(cls);
  }
}

function isSafeInstance(value) {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  for (const cls of safeClasses) {
    if (value instanceof cls) {
      return true;
    }
  }
  return false;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build the JSX node for an element, function component, or fragment.
// For function types (including the runtime helpers `Area`, `Component`,
// `Template`, `Extend`, `Widget`) we invoke the function with a single
// `props` object that includes `children`, matching React conventions.
function h(type, props, ...children) {
  props = props || {};
  if (type === Fragment) {
    return children;
  }
  if (typeof type === 'function') {
    const finalProps = { ...props };
    if (children.length > 0) {
      finalProps.children = (children.length === 1) ? children[0] : children;
    }
    return type(finalProps);
  }
  if (typeof type !== 'string') {
    throw new Error(`Invalid JSX element type: ${typeof type}`);
  }
  return buildElement(type, props, children);
}

function buildElement(tag, props, children) {
  let attrs = '';
  let dangerous = null;
  for (const key of Object.keys(props)) {
    if (key === 'children' || key === 'key' || key === 'ref') {
      continue;
    }
    if (key === 'dangerouslySetInnerHTML') {
      const v = props[key];
      if (v && typeof v.__html === 'string') {
        dangerous = v.__html;
      } else if (v && v.__html != null) {
        dangerous = String(v.__html);
      }
      continue;
    }
    const value = props[key];
    if (value == null || value === false) {
      continue;
    }
    const attrName = jsxAttrName(key);
    if (value === true) {
      attrs += ` ${attrName}`;
    } else {
      attrs += ` ${attrName}="${escapeAttr(value)}"`;
    }
  }

  if (dangerous != null) {
    return [
      new Raw(`<${tag}${attrs}>`),
      new Raw(dangerous),
      new Raw(`</${tag}>`)
    ];
  }

  if (voidElements[tag] && children.length === 0) {
    return [ new Raw(`<${tag}${attrs} />`) ];
  }

  return [
    new Raw(`<${tag}${attrs}>`),
    ...children,
    new Raw(`</${tag}>`)
  ];
}

// Match React's friendly attribute names to standard HTML/SVG attribute
// names. `data-*` and `aria-*` props pass through verbatim; SVG presentation
// attributes (`strokeWidth`, `fillRule`, etc.) are converted to the
// kebab-case form actually understood by browsers when the document is
// parsed as text/html. The handful of SVG attributes that are *natively*
// camelCase (e.g. `viewBox`, `preserveAspectRatio`) stay as-is.
const svgAttrMap = {
  // Stroke
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeOpacity: 'stroke-opacity',
  // Fill
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  // Clip / mask
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  // Text
  textAnchor: 'text-anchor',
  textDecoration: 'text-decoration',
  alignmentBaseline: 'alignment-baseline',
  baselineShift: 'baseline-shift',
  dominantBaseline: 'dominant-baseline',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontStyle: 'font-style',
  fontVariant: 'font-variant',
  fontWeight: 'font-weight',
  letterSpacing: 'letter-spacing',
  wordSpacing: 'word-spacing',
  // Generic
  colorInterpolation: 'color-interpolation',
  colorInterpolationFilters: 'color-interpolation-filters',
  colorProfile: 'color-profile',
  colorRendering: 'color-rendering',
  fillRendering: 'fill-rendering',
  imageRendering: 'image-rendering',
  shapeRendering: 'shape-rendering',
  textRendering: 'text-rendering',
  pointerEvents: 'pointer-events',
  unicodeBidi: 'unicode-bidi',
  vectorEffect: 'vector-effect',
  writingMode: 'writing-mode',
  enableBackground: 'enable-background',
  floodColor: 'flood-color',
  floodOpacity: 'flood-opacity',
  glyphOrientationHorizontal: 'glyph-orientation-horizontal',
  glyphOrientationVertical: 'glyph-orientation-vertical',
  lightingColor: 'lighting-color',
  markerEnd: 'marker-end',
  markerMid: 'marker-mid',
  markerStart: 'marker-start',
  overflowWrap: 'overflow-wrap',
  paintOrder: 'paint-order',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
  // Linked references
  xlinkHref: 'xlink:href',
  xlinkRole: 'xlink:role',
  xlinkTitle: 'xlink:title',
  xlinkType: 'xlink:type',
  xlinkArcrole: 'xlink:arcrole',
  xlinkActuate: 'xlink:actuate',
  xlinkShow: 'xlink:show',
  xmlBase: 'xml:base',
  xmlLang: 'xml:lang',
  xmlSpace: 'xml:space',
  xmlnsXlink: 'xmlns:xlink'
};

function jsxAttrName(name) {
  if (name === 'className') {
    return 'class';
  }
  if (name === 'htmlFor') {
    return 'for';
  }
  const svg = svgAttrMap[name];
  if (svg) {
    return svg;
  }
  return name;
}

// Walk the tree of strings, Raw markers, promises, and arrays, awaiting
// every promise and producing a final HTML string. Plain strings/numbers
// are escaped; Raw and Nunjucks SafeString values are not.
async function flatten(node) {
  const out = [];
  await walk(node, out);
  return out.join('');
}

async function walk(node, out) {
  if (node == null || node === false || node === true) {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      await walk(item, out);
    }
    return;
  }
  if (node instanceof Raw) {
    out.push(node.html);
    return;
  }
  if (isSafeInstance(node)) {
    out.push(node.toString());
    return;
  }
  if (typeof node === 'object' && typeof node.then === 'function') {
    const resolved = await node;
    await walk(resolved, out);
    return;
  }
  if (typeof node === 'string') {
    out.push(escapeHtml(node));
    return;
  }
  if (typeof node === 'number' || typeof node === 'bigint') {
    out.push(escapeHtml(String(node)));
    return;
  }
  // Anything else (objects without a known handler) is coerced to string
  // and escaped, mirroring how React stringifies unexpected children.
  out.push(escapeHtml(String(node)));
}

module.exports = {
  h,
  Fragment,
  Raw,
  flatten,
  escapeHtml,
  escapeAttr,
  registerSafeClass
};
