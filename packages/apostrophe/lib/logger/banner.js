// The startup banner: the `listening` event, rendered as a block instead of a
// line. Pretty mode only - every other format prints that event the way it
// prints any other. Nothing here is special cased text: the URLs come from the
// envelope, the rest are facts about the running process, like the timestamp
// of an ordinary line.

const { version } = require('../../package.json');

// `┃ Local     http://localhost:3000`
const LABEL_WIDTH = 10;

module.exports = {
  isBanner,
  renderBanner
};

// One process, one banner. A site listening inside an orchestrator that runs
// many is one line among many, not a headline. The event type is namespaced so
// that a project emitting its own `listening` never lands here.
function isBanner(envelope) {
  return envelope.type === 'apos-listening' &&
    typeof envelope.url === 'string' &&
    envelope.site === undefined;
}

function renderBanner(envelope, style) {
  const title = style([ 'bold', 'magenta' ], `apostrophe v${version}`);
  const ready = style('dim', `ready in ${elapsed(process.uptime() * 1000)}`);
  const environment = process.env.NODE_ENV || 'development';
  const lines = [
    '',
    `  ${title}  ${ready}`,
    '',
    row('Local', style('cyan', envelope.url), style)
  ];
  // Best effort: there is no login URL to point at when an alternative
  // mechanism replaced it, and a wrong one is worse than none.
  if (typeof envelope.adminUrl === 'string') {
    lines.push(row('Admin', style('cyan', envelope.adminUrl), style));
  }
  lines.push(row('Node', style('dim', `${process.version} · ${environment}`), style));
  lines.push('');
  return lines.join('\n');
}

function row(label, value, style) {
  return `  ${style('dim', '┃')} ${label.padEnd(LABEL_WIDTH)}${value}`;
}

function elapsed(ms) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}
