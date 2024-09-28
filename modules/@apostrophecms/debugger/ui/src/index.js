export default function() {
  console.log('in the thing');
  window.addEventListener('DOMContentLoaded', go);
}

let app = null;

function go() {
  app = document.querySelector('#apos-debugger');
  if (!app) {
    console.log('cannot find it');
    return;
  }
  console.log('found the thing');
  const toggle = element('button');
  let opened = false;
  toggle.innerText = '>>';
  app.append(toggle);
  toggle.addEventListener('click', () => {
    opened = !opened;
    if (opened) {
      toggle.innerText = '<<';
      open();
    } else {
      close();
      toggle.innerText = '>>';
    }
  });
}

function open() {
  const appBody = element('div');
  appBody.setAttribute('data-body', true);
  appBody.innerHTML = `
    <div data-queries>
      <style>
        table, pre {
          width: 100%;
        }
        th, td {
          text-align: left;
          padding: 2px;
        }
      </style>
      <h2>Queries</h2>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Module</th>
            <th>Time</th>
            <th>Results</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  `;
  const tbody = appBody.querySelector('[data-queries] tbody');
  for (const query of (apos.modules['@apostrophecms/debugger'].queries || [])) {
    let open = false;
    const row = element('tr');
    cell(row, query.source || 'Page');
    cell(row, query.module);
    cell(row, query.time + 'ms');
    cell(row, query.results);
    const toggle = element('button');
    toggle.innerText = '>>';
    row.append(toggle);
    tbody.append(row);
    let detailsRow = null;
    toggle.addEventListener('click', e => {
      open = !open;
      if (open) {
        detailsRow = element('tr');
        const detailsCell = element('td');
        detailsCell.setAttribute('colspan', 5);
        const details = element('pre');
        details.innerText = JSON.stringify(query, null, '  ');
        detailsCell.append(details);
        detailsRow.append(detailsCell);
        row.after(detailsRow);
        toggle.innerText = '<<';
      } else {
        detailsRow.remove();
        toggle.innerText = '>>';
      }
    });
    app.append(appBody);
  }
}

function close() {
  app.querySelector('[data-body]').remove();
}

function element(tag) {
  return document.createElement(tag);
}
function cell(row, text) {
  const td = element('td');
  td.innerText = text;
  row.append(td);
}
