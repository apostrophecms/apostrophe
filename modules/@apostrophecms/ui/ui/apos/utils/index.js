export const debounce = (func, timeout) => {
  let timer;
  return (...args) => {
    return new Promise((resolve, reject) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          resolve(func.apply(this, args));
        } catch (err) {
          reject(err);
        }
      }, timeout);
    });
  };
};
