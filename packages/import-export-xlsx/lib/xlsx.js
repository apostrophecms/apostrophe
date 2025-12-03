const XLSX = require('xlsx');

module.exports = {
  label: 'XLSX',
  extension: '.xlsx',
  allowedExtension: '.xlsx',
  allowedTypes: [ 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ],
  async input(filepath) {
    const workbook = XLSX.readFile(filepath);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const docs = XLSX.utils.sheet_to_json(sheet);

    return { docs: docs.map(parse) };
  },
  async output(filepath, { docs }) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      docs.map(stringify)
    );

    XLSX.utils.book_append_sheet(workbook, worksheet);
    XLSX.writeFile(workbook, filepath, { compression: true });

    console.info(`[xlsx] docs and attachments written to ${filepath}`);
  }
};

function stringify(doc) {
  const object = {};
  for (const key in doc) {
    object[key] = typeof doc[key] === 'object'
      ? JSON.stringify(doc[key])
      : doc[key];
  }
  return object;
}

function parse(doc) {
  const object = {};
  for (const key in doc) {
    if (!doc[key]) {
      // Avoid setting empty values as empty strings
      continue;
    }
    try {
      object[key] = JSON.parse(doc[key]);
    } catch {
      object[key] = doc[key];
    }
  }
  return object;
}
