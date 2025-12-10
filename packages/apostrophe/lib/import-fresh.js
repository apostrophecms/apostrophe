module.exports = importFresh;

function importFresh(name) {
  // Don't bomb on plain Windows
  if (name.match(/^[A-Za-z]:/)) {
    name = `file:///${name.replaceAll('\\', '/')}`;
  }
  return import(`${name}?${Date.now()}`);
}
