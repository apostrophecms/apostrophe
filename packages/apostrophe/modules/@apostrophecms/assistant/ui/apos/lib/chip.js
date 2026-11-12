// A chip in the composer, plain DOM for the editing area's node view, the
// markup of `AposAssistantChip`. The editor removes it with Backspace or
// Delete like a character; the remove button is for the pointer, so it takes
// no focus. Icons are inline SVG: a site's content security policy may refuse
// `data:` images

const SVG = 'http://www.w3.org/2000/svg';
const DOCUMENT_ICON = 'M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z';
const ICONS = {
  page: {
    viewBox: '0 -960 960 960',
    path: DOCUMENT_ICON
  },
  piece: {
    viewBox: '0 -960 960 960',
    path: DOCUMENT_ICON
  },
  image: {
    viewBox: '0 -960 960 960',
    path: 'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z'
  },
  widget: {
    viewBox: '0 0 24 24',
    path: 'M2,4C2,2.89 2.9,2 4,2H7V4H4V7H2V4M22,4V7H20V4H17V2H20A2,2 0 0,1 22,4M20,20V17H22V20C22,21.11 21.1,22 20,22H17V20H20M2,20V17H4V20H7V22H4A2,2 0 0,1 2,20M10,2H14V4H10V2M10,20H14V22H10V20M20,10H22V14H20V10M2,10H4V14H2V10Z'
  }
};

// A kind's icon, `{ viewBox, path }`
export function getChipIcon(kind) {
  return ICONS[kind] || ICONS.piece;
}

// The icon as an element, for a chip the server rendered or the editing area
// builds
export function createChipIcon(kind) {
  const { viewBox, path: d } = getChipIcon(kind);
  const icon = document.createElementNS(SVG, 'svg');
  icon.setAttribute('class', 'apos-assistant-chip__icon');
  icon.setAttribute('viewBox', viewBox);
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', d);
  icon.append(path);
  return icon;
}

export function createChip({
  id, title, kind
}, { onRemove } = {}) {
  const chip = document.createElement('span');
  chip.className = 'apos-assistant-chip';
  chip.contentEditable = 'false';
  chip.dataset.aposMention = '';
  chip.dataset.id = id;
  chip.dataset.kind = kind;
  chip.dataset.title = title;
  chip.title = title;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'apos-assistant-chip__remove';
  remove.tabIndex = -1;
  remove.setAttribute('aria-hidden', 'true');
  remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
  // The caret stays where it was
  remove.addEventListener('mousedown', event => event.preventDefault());
  remove.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onRemove?.();
  });

  const label = document.createElement('span');
  label.className = 'apos-assistant-chip__title';
  label.textContent = title;

  chip.append(createChipIcon(kind), remove, label);
  return chip;
}

export function readChip(element) {
  return {
    id: element.dataset.id,
    title: element.dataset.title,
    kind: element.dataset.kind
  };
}
