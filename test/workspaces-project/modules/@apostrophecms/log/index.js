const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: []
  };

  return {
    debug: (...args) => {
      console.debug(...args);
      messages.debug.push(...args);
    },
    info: (...args) => {
      console.info(...args);
      messages.info.push(...args);
    },
    warn: (...args) => {
      console.warn(...args);
      messages.warn.push(...args);
    },
    error: (...args) => {
      console.error(...args);
      messages.error.push(...args);
    },
    destroy: () => {
      delete messages.debug;
      delete messages.info;
      delete messages.warn;
      delete messages.error;
    },
    getMessages: () => messages
  };
};

module.exports = {
  options: {
    logger: createLogger()
  }
};
