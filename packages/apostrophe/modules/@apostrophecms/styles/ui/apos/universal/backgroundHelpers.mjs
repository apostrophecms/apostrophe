// Hardcoded fallback widths — used only when imageSizes is not provided
const KNOWN_SIZE_WIDTHS = {
  'one-sixth': 190,
  'one-third': 380,
  'one-half': 570,
  'two-thirds': 760,
  full: 1140,
  max: 1600
};

// Returns the URL of the largest available sized image from the
// known widths map. Falls back to null when nothing matches.
function largestSizedUrl(urls, sizeWidths) {
  let best = null;
  let bestWidth = -1;
  for (const [ name, width ] of Object.entries(sizeWidths)) {
    if (urls[name] && width > bestWidth) {
      best = urls[name];
      bestWidth = width;
    }
  }
  return best;
}

export function extractImageData(value) {
  if (!value || value.group !== 'images') {
    return null;
  }

  const urls = value._urls;
  if (!urls) {
    return null;
  }

  // Fallback chain: full → max → largest known size → original
  const url = urls.full ||
    urls.max ||
    largestSizedUrl(urls, KNOWN_SIZE_WIDTHS) ||
    urls.original;

  if (!url) {
    return null;
  }

  return {
    url,
    urls
  };
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
// Sorted descending — processed largest-first so that the
// default (no query) gets the biggest available image.
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
  // entries are already sorted ascending by width
  for (const entry of entries) {
    if (entry.width >= adjusted) {
      return entry.url;
    }
  }
  // All images are smaller than the target — return the largest
  return entries[entries.length - 1]?.url || null;
}

export function buildResponsiveImageRules(property, imageData, imageSizes) {
  const { url, urls } = imageData;
  const sizeWidths = getSizeWidths(imageSizes);

  // Build sorted entries ascending by width (reuses the same logic)
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

  // Base rule — always present
  const rules = [ `${property}: url(${url})` ];
  const mediaRules = [];

  // Only emit breakpoints when we have multiple sizes to choose from
  if (entries.length > 1) {
    const seen = new Set([ url ]);
    for (const bp of BREAKPOINTS) {
      const bpUrl = bestUrlForWidth(entries, bp.maxWidth);
      // Skip if the breakpoint would use the same URL as the default
      // or as a previously emitted breakpoint
      if (bpUrl && !seen.has(bpUrl)) {
        seen.add(bpUrl);
        mediaRules.push({
          query: `(max-width: ${bp.maxWidth}px)`,
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
