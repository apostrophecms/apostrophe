module.exports = {
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      return new Promise((resolve) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          resolve(fn.apply(this, args));
        }, delay);
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
