// Build output formatting — matches Astro's native style (via piccolore)

// Color support detection: respect NO_COLOR / FORCE_COLOR conventions.
const _proc = globalThis.process || {};
const _argv = _proc.argv || [];
const _env = _proc.env || {};
const useColor = !(_env.NO_COLOR || _argv.includes('--no-color')) &&
  (!!_env.FORCE_COLOR || _argv.includes('--color') ||
    _proc.platform === 'win32' ||
    ((_proc.stdout || {}).isTTY && _env.TERM !== 'dumb') ||
    !!_env.CI);

const wrap = (open, close) => useColor ? (s) => `${open}${s}${close}` : (s) => s;

export const bgGreen = wrap('\x1b[42m', '\x1b[49m');
export const black = wrap('\x1b[30m', '\x1b[39m');
export const blue = wrap('\x1b[34m', '\x1b[39m');
export const dim = wrap('\x1b[2m', '\x1b[22m');
export const green = wrap('\x1b[32m', '\x1b[39m');

export function getTimeStat(timeStart, timeEnd) {
  const buildTime = timeEnd - timeStart;
  return buildTime < 1000 ? `${Math.round(buildTime)}ms` : `${(buildTime / 1000).toFixed(2)}s`;
}

export function timestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return dim(`${h}:${m}:${s}`);
}
