const format = require('./lib/format.js');

export default function (data) {
  return <span>{format(data.value)}</span>;
}
