module.exports = host => {
  if (host.includes(':')) {
    // ipv6
    return `[${host}]`;
  } else {
    return host;
  }
};
