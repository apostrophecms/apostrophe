// The change list's model: the rows of the `changes` route that pass the
// filter, grouped under the top-level field they belong to, or under the
// widget when that field is an area

// An unchanged run of text longer than this shows only the words next to
// a change, this many characters of them
const ELIDE_OVER = 120;
const ELIDE_CONTEXT = 40;

// The change a side of an expanded row shows as its own
const sides = {
  new: 'added',
  old: 'removed'
};

// A row matches when any checked option does; no option checked shows all
function matchesFilter(row, filter) {
  return !filter.length ||
    filter.includes(row.type) ||
    (row.ai && filter.includes('ai'));
}

// Whether a row is among the changes behind a marker of the body: those
// of the widget `widgetId` (and, when it `moved`, the order of its area),
// or those of the top-level field `field` outside any widget
function isMarkerTarget(row, {
  field, widgetId, moved = false
}) {
  const widget = row.path.findLast(segment => segment.widgetType);
  if (!widgetId) {
    return !widget && (row.path[0].name === field);
  }
  return (widget?.name === widgetId && row.kind !== 'area') ||
    (moved && row.kind === 'area' && row.new.includes(widgetId));
}

function getChangeGroups(rows, filter) {
  const list = [];
  const byKey = new Map();
  rows.forEach((row, index) => {
    if (!matchesFilter(row, filter)) {
      return;
    }
    const path = getGroupPath(row);
    const key = path.map(segment => segment.name).join('.');
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        path,
        type: 'modified',
        entries: []
      };
      byKey.set(key, group);
      list.push(group);
    }
    const segments = row.path.slice(path.length);
    // The order of an array's or area's items reads as the last crumb
    const order = [ 'array', 'area' ].includes(row.kind);
    if (order) {
      segments.push({ label: 'apostrophe:versionOrderChanged' });
    }
    // The row is the group's own field or widget: it was added or deleted
    // whole, and its label stands in for the empty breadcrumb
    const own = !segments.length;
    if (own) {
      group.type = row.type;
      segments.push(path.at(-1));
    }
    const diff = row.diff || [];
    const short = order ? elideItems(diff) : elide(diff);
    // Two images may share a title
    const changed = diff.some(part => part.change !== 'same') || Boolean(row.images);
    const format = row.formatChanges || [];
    const bySide = parts => Object.fromEntries(
      Object.entries(sides).map(([ side, change ]) => [
        side,
        parts.filter(part => [ 'same', 'elided', change ].includes(part.change))
      ])
    );
    group.entries.push({
      key: String(index),
      row,
      segments,
      // Its parts are whole items, one to a line
      order,
      // How the change shows: `block`, both sides in one stream of parts,
      // for rich text and the order of items; `sides`, each side apart
      layout: (order || row.kind === 'richText') ? 'block' : 'sides',
      // What the block shows, in full and with the long unchanged runs cut
      // down: of text, the words away from a change; of an order, the items
      // away from a move
      inline: diff,
      inlineShort: short,
      // What each side shows: the parts both share and its own, in full
      // and with the long unchanged runs cut down
      parts: bySide(diff),
      short: bySide(short),
      elided: short.length !== diff.length,
      own,
      // Whether the text shows the change at all
      changed,
      // What changed in a rich text besides its words, a block each
      format,
      // The related images of each side, shown in place of their titles
      images: row.images || {},
      // Whether there is anything to expand: a row of which only the change
      // is known has no toggle, and its change type when its group's header
      // does not say it
      detail: changed || format.length > 0,
      text: {
        new: Boolean(row.newText),
        old: Boolean(row.oldText)
      }
    });
  });
  return list;

  // A row's group is its top-level field, plus the widget right below it
  // when the field is an area
  function getGroupPath(row) {
    const depth = row.path[1]?.widgetType ? 2 : 1;
    return row.path.slice(0, depth);
  }

  // The parts with every long unchanged run cut down to the words next to a
  // change. Both sides share those runs, so they are cut alike. A run can be
  // several parts, words in bold or italic among them
  function elide(parts) {
    const runs = [];
    for (const part of parts) {
      const run = runs.at(-1);
      if (run && (part.change === 'same') && (run[0].change === 'same')) {
        run.push(part);
      } else {
        runs.push([ part ]);
      }
    }
    return runs.flatMap((run, index) => {
      const length = run.reduce((total, part) => total + part.text.length, 0);
      if ((run[0].change !== 'same') || (length <= ELIDE_OVER)) {
        return run;
      }
      return [
        ...((index > 0) ? head(run) : []),
        { change: 'elided' },
        ...((index < runs.length - 1) ? tail(run) : [])
      ];
    });

    // The first words of a run, not cut inside a word
    function head(run) {
      const kept = [];
      let left = ELIDE_CONTEXT;
      for (const part of run) {
        if (left <= 0) {
          break;
        }
        const text = part.text.slice(0, left);
        left -= part.text.length;
        kept.push({
          ...part,
          text: (left < 0) ? text.replace(/\S*$/, '') : text
        });
      }
      kept.at(-1).text = kept.at(-1).text.trimEnd();
      return kept.filter(part => part.text);
    }

    // The last words of a run, the same way
    function tail(run) {
      const kept = [];
      let left = ELIDE_CONTEXT;
      for (const part of [ ...run ].reverse()) {
        if (left <= 0) {
          break;
        }
        const text = part.text.slice(-left);
        left -= part.text.length;
        kept.unshift({
          ...part,
          text: (left < 0) ? text.replace(/^\S*/, '') : text
        });
      }
      kept[0].text = kept[0].text.trimStart();
      return kept.filter(part => part.text);
    }
  }

  // The items of an order with every run of unchanged ones cut down to one
  // `elided` part, but for the items next to a moved one, which show where
  // it went and where it was. A single item is shown rather than cut
  function elideItems(parts) {
    const moved = index => parts[index] && (parts[index].change !== 'same');
    const kept = parts.map((part, index) => {
      return moved(index) || moved(index - 1) || moved(index + 1);
    });
    const list = [];
    let run = [];
    parts.forEach((part, index) => {
      if (!kept[index]) {
        run.push(part);
        return;
      }
      list.push(...((run.length > 1) ? [ { change: 'elided' } ] : run), part);
      run = [];
    });
    list.push(...((run.length > 1) ? [ { change: 'elided' } ] : run));
    return list;
  }
}

export default {
  matchesFilter,
  isMarkerTarget,
  getChangeGroups
};
