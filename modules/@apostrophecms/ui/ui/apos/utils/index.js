module.exports = {
  debounce(fn, delay) {
    let timer;
    let previousDone = true;

    const setTimer = (res, rej, args, delay) => {
      return setTimeout(() => {
        if (!previousDone) {
          clearTimeout(timer);
          timer = setTimer(res, rej, args, delay);
          return;
        }

        previousDone = false;
        const returned = fn.apply(this, args);
        if (returned instanceof Promise) {
          return returned
            .then(res)
            .catch(rej)
            .finally(() => {
              previousDone = true;
            });
        }

        previousDone = true;
        res(returned);
      }, delay);
    };

    return (...args) => {
      return new Promise((resolve, reject) => {
        clearTimeout(timer);
        timer = setTimer(resolve, reject, args, delay);
      });
    };
  },

  throttle(fn, delay) {
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
};
