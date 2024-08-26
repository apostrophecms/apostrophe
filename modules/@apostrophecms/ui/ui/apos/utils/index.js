module.exports = {
  debounceAsync,
  // BC alias
  debounce: debounceAsync,
  throttle
};

function debounceAsync(fn, delay, options = {}) {
  const canceledRejection = new Error('debounce:canceled');
  let timer;
  let canceled = false;
  let previousDone = true;

  const setTimer = (res, rej, args, delay) => {
    return setTimeout(() => {
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
    }, delay);
  };

  function wrapper(...args) {
    return new Promise((resolve, reject) => {
      if (canceled) {
        return reject(canceledRejection);
      }
      clearTimeout(timer);
      timer = setTimer(resolve, reject, args, delay);
    });
  };

  wrapper.cancel = () => {
    canceled = true;
    clearTimeout(timer);
    timer = null;
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
