const fs = require('fs');
const csvParse = require('csv-parse/lib/sync');

const data = fs.readFileSync('/dev/stdin', 'utf8');
const records = parse(data);

let failed = false;

for (const record of records) {
  if (!record.Type) {
    continue;
  }
  if (!record.Host) {
    fail('No Host specified', record);
  }
  if (!record.Value) {
    fail('No Value specified', record);
  }
  if (!record.TTL) {
    record.TTL = 3600;
  }
  // Normalize case and deal with a common suffix when copying and pasting to a spreadsheet
  const type = record.Type.toUpperCase().replace(' RECORD', '');
  if (type === 'MX') {
    if (!record.Priority) {
      fail('No Priority specified', record);
    }
    console.log(`${record.Host} ${record.TTL} ${type} ${record.Priority} ${record.Value}`);
  } else {
    console.log(`${record.Host} ${record.TTL} ${type} ${record.Value}`);
  }
}

if (failed) {
  process.exit(1);
}

function fail(msg, record) {
  console.error(`${msg}:`, record);
  failed = true;
}

function parse (input) {
  return csvParse(input, {
    columns: true,
    skip_empty_lines: true,
    // Does not trim quoted values, see below
    trim: true
  }).filter(row => Object.keys(row).length > 0).map(row =>
    Object.fromEntries(
      Object.entries(row).map(([ key, val ]) => [ key.trim(), (val != null) ? val.toString().trim() : val ])
    )
  );
}
