const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: []
  };

  return {
    debug: (...args) => console.debug(...args) && messages.debug.push(...args) && messages,
    info: (...args) => console.info(...args) && messages.info.push(...args) && messages,
    warn: (...args) => console.warn(...args) && messages.warn.push(...args) && messages,
    error: (...args) => console.error(...args) && messages.error.push(...args) && messages,
    destroy: () => {
      delete messages.debug;
      delete messages.info;
      delete messages.warn;
      delete messages.error;
    }
  };
};

module.exports = {
  options: {
    logger: createLogger()
  }
};
