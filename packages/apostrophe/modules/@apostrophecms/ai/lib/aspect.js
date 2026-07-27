// The image aspect dial: a caller's named token or 'W:H' ratio canonicalized
// to one 'W:H' form, then resolved to the nearest aspect a model declares.

const { NAMED_ASPECTS } = require('./constants');
const { parseAspect } = require('./util');

module.exports = (self) => {
  return {
    // Normalize an aspect dial to its canonical 'W:H' string. Every
    // aspect the core hands an adapter passes through here, so an
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
    // model declares (`declared`, from modelInfo), returned verbatim —
    // it is both echoed to the caller and translated to the provider's
    // dialect by the adapter. Nearest minimizes the log-ratio distance;
    // a tie resolves to the larger ratio, then to declaration order. A
    // model declaring no aspects passes the canonical ratio through for
    // the adapter to best-effort, and the provider may reject it.
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

      // An aspect with its ratio and its log-ratio distance from the target
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
