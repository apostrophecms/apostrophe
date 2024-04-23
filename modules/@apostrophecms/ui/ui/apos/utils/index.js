export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    return new Promise((resolve) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resolve(fn.apply(this, args));
      }, delay);
    });
  };
};

export const throttle = (fn, delay) => {
  let inThrottle;

  return (...args) => {
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        fn.apply(this, args);
      }, delay);
    }
  };
};
