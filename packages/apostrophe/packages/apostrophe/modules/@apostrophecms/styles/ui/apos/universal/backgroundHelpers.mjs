// Hardcoded fallback widths — used only when imageSizes is not provided
const KNOWN_SIZE_WIDTHS = {
  'one-sixth': 190,
  'one-third': 380,
  'one-half': 570,
  'two-thirds': 760,
  full: 1140,
  max: 1600
};

export function extractImageData(value) {
  if (!value || value.group !== 'images') {
    return null;
  }

  const urls = value._urls;
  if (!urls || !Object.keys(urls).length) {
    return null;
  }

  return urls;
}

function getSizeWidths(imageSizes) {
  if (!Array.isArray(imageSizes) || !imageSizes.length) {
    return KNOWN_SIZE_WIDTHS;
  }
  const map = {};
  for (const size of imageSizes) {
    map[size.name] = size.width;
  }
  return map;
}

// Assume 2× device-pixel-ratio when selecting images for a
// breakpoint. Covers the vast majority of modern displays
// (retina / HiDPI) without needing resolution media queries.
const DPR_FACTOR = 2;

// Internal breakpoints for responsive background images.
// Sorted ascending — each breakpoint generates a non-overlapping
// range query so there is no cascade/specificity dependency.
const BREAKPOINTS = [
  {
    maxWidth: 480,
    label: 'mobile'
  },
  {
    maxWidth: 768,
    label: 'tablet'
  }
];

// For a given breakpoint width, find the best image URL.
// Multiplies the target by DPR_FACTOR so that retina/HiDPI
// displays get enough pixel data for crisp rendering.
// Falls back to the largest available image when nothing qualifies.
function bestUrlForWidth(entries, targetWidth) {
  const adjusted = targetWidth * DPR_FACTOR;
  for (const entry of entries) {
    if (entry.width >= adjusted) {
      return entry.url;
    }
  }

  return entries[entries.length - 1]?.url || null;
}

export function buildResponsiveImageRules(property, urls, imageSizes) {
  const sizeWidths = getSizeWidths(imageSizes);

  // Build sorted entries ascending by width
  const entries = [];
  for (const [ name, sizedUrl ] of Object.entries(urls)) {
    if (
      name === 'original' ||
      name === 'uncropped' ||
      !sizedUrl ||
      typeof sizedUrl !== 'string'
    ) {
      continue;
    }
    const width = sizeWidths[name];
    if (width) {
      entries.push({
        url: sizedUrl,
        width
      });
    }
  }
  entries.sort((a, b) => a.width - b.width);

  // Use the largest sized image as the base (covers the widest viewport).
  // Fall back to `original` when no sized entries exist (e.g. SVG).
  const baseUrl = entries.length
    ? entries[entries.length - 1].url
    : urls.original;

  if (!baseUrl) {
    return {
      rules: [],
      mediaRules: []
    };
  }

  const rules = [ `${property}: url(${baseUrl})` ];
  const mediaRules = [];

  if (entries.length > 1) {
    for (let i = 0; i < BREAKPOINTS.length; i++) {
      const bp = BREAKPOINTS[i];
      const bpUrl = bestUrlForWidth(entries, bp.maxWidth);
      // Skip if the breakpoint would use the same URL as the base —
      // the base rule already covers it at every viewport.
      if (bpUrl && bpUrl !== baseUrl) {
        // First breakpoint: (width <= Npx)
        // Subsequent:       (Ppx < width <= Npx)
        const query = i === 0
          ? `(width <= ${bp.maxWidth}px)`
          : `(${BREAKPOINTS[i - 1].maxWidth}px < width <= ${bp.maxWidth}px)`;
        mediaRules.push({
          query,
          rules: [ `${property}: url(${bpUrl})` ]
        });
      }
    }
  }

  return {
    rules,
    mediaRules
  };
}

export function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
