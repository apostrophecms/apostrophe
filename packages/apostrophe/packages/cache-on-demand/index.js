module.exports = cacheOnDemand;

function cacheOnDemand(fn, hasher) {
  if (!hasher) {
    hasher = cacheOnDemand.webHasher;
  }
  if (typeof hasher !== 'function') {
    // Implement 'always'
    const key = hasher;

    hasher = () => key;
  }
  const pending = {};

  return function(...args) {
    const callback = args.pop();
    const key = hasher.apply(this, args);

    if (key === false) {
      // hasher says this request can't be cached
      return fn.apply(this, arguments);
    }
    if (pending[key]) {
      // A request is in progress, queue up to be sent
      // the same result on completion
      pending[key].push(callback);
      return;
    }
    // start a new pending queue
    pending[key] = [ callback ];

    args.push(function(...params) {
      const list = pending[key];
      // Delete the queue before invoking the callbacks,
      // so we don't risk establishing a chain with no
      // breaks to generate more up-to-date results. The
      // idea is to deliver on demand to everyone who
      // showed up during the generation of this result,
      // and then be open to generating a new result
      delete pending[key];

      // Deliver results to everyone in the queue
      for (const func of list) {
        deliver(func);
      }

      function deliver(func) {
        // Make sure we're async as the
        // caller expects
        setImmediate(() => {
          func.apply(this, params);
        });
      }
    });
    return fn.apply(this, args);
  };
}
