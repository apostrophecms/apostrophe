module.exports = {
  debounceAsync,
  // BC alias
  debounce: debounceAsync,
  throttle
};

// Debounce the async function "fn". For synchronous functions, use _.debounce, not this function.
//
// Returns a debounced function that invokes "fn", but no more frequently than every "delay"
// milliseconds and never while "fn" is already in progress.
//
// As always when debouncing, extra calls are discarded, however the most recent call 
// is guaranteed to result in a final invocation if not preempted by a new call, so you may
// trust that the user's most recent input will eventually be sent etc.
//
// ### Avoiding race conditions with ifNotCanceled
//
// Race conditions are a challenge. To avoid them, "fn" should have no side effects, and you should
// pass a synchronous function that accepts the return value of "fn" as the "ifNotCanceled" option.
// The "ifNotCanceled" function should then implement all needed side effects (e.g. changes to component
// state, etc) when invoked. The debounced function has no return value when "ifNotCanceled" is used.
//
// You can cancel the debounced function and cause any further invocations to be rejected by
// calling the "cancel()" method attached to it.
//
// You can skip the initial delay for a particular invocation by calling the "skipDelay()" method
// attached to the debounced function, passing any appropriate arguments for "fn" to "skipDelay" instead.
// This is useful when immediate action is sometimes needed but you still want to use "ifNotCanceled" in
// a consistent manner and prevent race conditions.
//
// ### Detecting Cancellations
//
// If "ifNotCanceled" is provided then all invocations of the debounced function resolve with "null",
// whether or not they succeed, are canceled or reject with an error. In this case any needed error
// reporting is the responsibility of "fn".
//
// If "ifNotCanceled" is not provided, then after cancellation any invocations will be rejected
// with an error such that "e.name === 'debounce:canceled'". Any other errors are passed through
// as errors in the debounced function.

function debounceAsync(fn, delay, options = {}) {
  const canceledRejection = new Error('debounce:canceled');
  canceledRejection.name = 'debounce.canceled';
  let timer;
  let canceled = false;
  let previousDone = true;
  let skipNextDelay = false;

  const setTimer = (res, rej, args, delay) => {
    function body() {
      if (canceled) {
        return rej(canceledRejection);
      }
      if (!previousDone) {
        clearTimeout(timer);
        timer = setTimer(res, rej, args, delay);
        return;
      }

      previousDone = false;
      const returned = fn.apply(this, args);
      if (returned instanceof Promise) {
        return returned
          .then((result) => {
            if (canceled) {
              return rej(canceledRejection);
            }
            res(result);
          })
          .catch(rej)
          .finally(() => {
            previousDone = true;
          });
      }

      previousDone = true;
      res(returned);
    }
    if (delay === false) {
      return body();
    } else {
      return setTimeout(body, delay);
    }
  };

  let wrapper = (...args) => {
    return new Promise((resolve, reject) => {
      if (canceled) {
        return reject(canceledRejection);
      }
      if (skipNextDelay) {
        skipNextDelay = false;
        setTimer(resolve, reject, args, false);
      }
      clearTimeout(timer);
      timer = setTimer(resolve, reject, args, delay);
    });
  };

  if (options.ifNotCanceled) {
    wrapper = wrapper().then(...args => {
      options.ifNotCanceled(...args);
    }).finally(() => {
      return Promise.resolve(null);
    });
  }

  wrapper.cancel = () => {
    canceled = true;
    clearTimeout(timer);
    timer = null;
  };

  wrapper.skipDelay = () => {
    skipNextDelay = true;
  };

  return wrapper;
}

function throttle(fn, delay) {
  let inThrottle;

  return (...args) => {
    return new Promise((resolve) => {
      if (!inThrottle) {
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          resolve(fn.apply(this, args));
        }, delay);
      }
    });
  };
}
