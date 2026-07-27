// The image aspect dial: a caller's named token or 'W:H' ratio canonicalized
// to one 'W:H' form, then resolved to the nearest aspect a model declares.

const { NAMED_ASPECTS } = require('./constants');
const { parseAspect } = require('./util');

module.exports = (self) => {
  return {
    // Normalize an aspect dial to its canonical 'W:H' string. The named
    // tokens square, portrait and landscape ground to the conventional
    // photo ratios (1:1, 3:4, 4:3); an explicit 'W:H' of two positive
    // numbers is returned as given. Throws "invalid" on anything else.
    // Every aspect the core hands an adapter passes through here, so an
    // adapter only ever sees 'W:H', never a named token.
    canonicalAspect(aspect) {
      if (Object.hasOwn(NAMED_ASPECTS, aspect)) {
        return NAMED_ASPECTS[aspect];
      }
      if (parseAspect(aspect)) {
        return aspect;
      }
      throw self.apos.error('invalid', `"${aspect}" is not a valid aspect: use "square", "portrait", "landscape" or a "W:H" ratio`);
    },
    // The numeric width/height ratio of an aspect dial.
    aspectRatio(aspect) {
      const [ w, h ] = parseAspect(self.canonicalAspect(aspect));
      return w / h;
    },
    // Resolve a requested aspect dial to the nearest aspect the routed
    // model declares, returning that declared string verbatim — echoed
    // to the caller in metadata and translated to the provider's dialect
    // by the adapter. `requested` is the call's `aspect` option (a named
    // token or 'W:H'), or undefined to leave the dial unset (returns
    // undefined; the provider default applies). `declared` is the
    // model's supported aspect strings (modelInfo). Nearest match
    // minimizes the log-ratio distance to the requested ratio; a tie
    // resolves to the larger ratio, then to declaration order. A model
    // that declares no aspects (an unknown model) is a pass-through: the
    // requested ratio returns as its canonical 'W:H' — never a named
    // token, so the adapter's input is uniform — for the adapter to
    // best-effort, and the provider may reject it.
    resolveAspect(requested, declared) {
      if (requested === undefined) {
        return undefined;
      }
      const target = self.aspectRatio(requested);
      if (!Array.isArray(declared) || !declared.length) {
        return self.canonicalAspect(requested);
      }
      let best = describe(declared[0]);
      for (const aspect of declared) {
        const candidate = describe(aspect);
        if (candidate.distance < best.distance - 1e-9 ||
          (Math.abs(candidate.distance - best.distance) <= 1e-9 &&
            candidate.ratio > best.ratio)) {
          best = candidate;
        }
      }
      return best.aspect;

      // An aspect string with its ratio and its log-ratio distance from
      // the requested target
      function describe(aspect) {
        const ratio = self.aspectRatio(aspect);
        return {
          aspect,
          ratio,
          distance: Math.abs(Math.log(target / ratio))
        };
      }
    }
  };
};
