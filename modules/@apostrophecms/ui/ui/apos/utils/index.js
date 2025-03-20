export {
  debounceAsync,
  // BC alias
  debounceAsync as debounce,
  throttle,
  asyncTaskQueue
};

// Debounce the async function "fn". For synchronous functions, use "lodash/debounce", not this function.
//
// Returns a debounced function that invokes "fn", but no more frequently than every "delay"
// milliseconds and never while "fn" is already in progress.
//
// As always when debouncing, extra calls are discarded, however the most recent call
// is guaranteed to result in a final invocation if not preempted by a new call, so you may
// trust that the user's most recent input will eventually be sent etc.
//
// ### Avoiding race conditions with onSuccess
//
// Race conditions are a challenge. To avoid them, "fn" should have no side effects, and you should
// pass a synchronous function that accepts the return value of "fn" as the "onSuccess" option.
// The "onSuccess" function should then implement all needed side effects (e.g. changes to component
// state, etc) when invoked. The debounced function has no return value when "onSuccess" is used.
//
// You can cancel the debounced function and cause all ongoing and any further invocations to be rejected by
// calling the "cancel()" method attached to it.
//
// You can skip the initial delay for a particular invocation by calling the "skipDelay()" method
// attached to the debounced function, passing any appropriate arguments for "fn" to "skipDelay" instead.
// This is useful when immediate action is sometimes needed but you still want to use "onSuccess" in
// a consistent manner and prevent race conditions.
//
// ### Detecting Cancellations
//
// If "onSuccess" is not provided, then after cancellation any invocations will be rejected
// with an error such that "e.name === 'debounce.canceled'". Any other errors are passed through
// as errors in the debounced function.
//
// If "onSuccess" is provided then all invocations of the debounced function resolve with "null".
// If a rejection due to cancelation is detected ("e.name === 'debounce.canceled'") then
// it will be "muted" internally. However, if any other type of error occurs, it will be passed through,
// resulting in a rejection of the debounced function.

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
        // At least 100ms delay to let current invocation finish
        timer = setTimer(res, rej, args, delay || 100);
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
    return setTimeout(body, delay);
  };

  const wrapper = async (...args) => {
    const promise = new Promise((resolve, reject) => {
      if (canceled) {
        return reject(canceledRejection);
      }
      if (skipNextDelay) {
        skipNextDelay = false;
        timer = setTimer(resolve, reject, args, 0);
        return;
      }
      clearTimeout(timer);
      timer = setTimer(resolve, reject, args, delay);
    });

    try {
      const result = await promise;
      if (options.onSuccess) {
        await options.onSuccess(result);
        return null;
      }
      return promise;
    } catch (e) {
      if (e.name !== 'debounce.canceled' || !options.onSuccess) {
        throw e;
      }
      return null;
    }
  };

  wrapper.cancel = () => {
    canceled = true;
    clearTimeout(timer);
    timer = null;
  };

  wrapper.skipDelay = (...args) => {
    skipNextDelay = true;
    return wrapper(...args);
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

/**
 * @class Queue
 * @description A simple serial task queue
 */
class Queue {
  constructor() {
    this.queue = [];
    this.running = false;
  }

  hasTasks() {
    return this.queue.length > 0 || this.running;
  }

  count() {
    return this.queue.length;
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
      this.run();
    });
  }

  async run() {
    if (this.running) {
      return;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }

    try {
      this.running = true;
      const result = await item.task();
      this.running = false;
      item.resolve(result);
    } catch (e) {
      this.running = false;
      item.reject(e);
    } finally {
      this.run();
    }

    return true;
  }
}

/**
 * A factory function for creating a serial task queue.
 * @example
 * ```js
 * const queue = asyncTaskQueue();
 * queue.add(async () => {
 *   await asyncTask1();
 * }
 * // Will wait for asyncTask1 to finish before starting asyncTask2
 * queue.add(async () => {
 *   await asyncTask2();
 * }
 * ```
 * @returns {{
 *  add: <T>(task: () => Promise<T>) => Promise<T>,
 *  count: () => number,
 *  hasTasks: () => boolean
 * }}
 */
function asyncTaskQueue() {
  const queue = new Queue();
  return {
    add: (task) => queue.add(task),
    count: () => queue.count(),
    hasTasks: () => queue.hasTasks()
  };
}
