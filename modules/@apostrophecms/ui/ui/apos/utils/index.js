export const debounce = (func, timeout) => {
  let timer;
  return (...args) => {
    return new Promise((resolve) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resolve(func.apply(this, args));
      }, timeout);
    });
  };
};
