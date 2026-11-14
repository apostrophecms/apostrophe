// What the panel says about a revert's documents, as the revert routes
// render them (`renderRevert`), and where the editor looks at one it did
// not put back.

const NAMES_MAX = 5;
// A page to show with See Changes once it loads, from another page
const HANDOFF = 'aposAssistantSeeChanges';
const READY_WAIT = 10000;
// Outcomes the confirmation and the result list, in the order they are read
const NOT_REVERTED = [ 'kept', 'unrestorable', 'locked' ];

/**
 * The confirmation's lines: one per outcome that has documents, in the
 * order the editor reads them. Each `{ key, count, params, names }`,
 * `names` the titles of the documents it keeps, `null` when it lists none.
 *
 * @param {object[]} documents
 * @param {Function} $t
 * @returns {object[]}
 */
export function getConfirmLines(documents, $t) {
  const lines = [];
  const of = test => documents.filter(test);
  add('apostrophe:assistantRevertPutBack', of(doc => doc.outcome === 'putBack'));
  for (const outcome of [ 'deleted', 'archived' ]) {
    const removed = of(doc => doc.outcome === outcome);
    add(
      (outcome === 'deleted') ? 'apostrophe:assistantRevertDeleted' : 'apostrophe:assistantRevertArchived',
      removed,
      { type: getTypeLabel(removed, $t) }
    );
  }
  const kept = of(doc => doc.outcome === 'kept');
  add('apostrophe:assistantRevertChanged', kept.filter(doc => !doc.partly && (doc.reason !== 'used')), {}, true);
  add('apostrophe:assistantRevertPartly', kept.filter(doc => doc.partly && (doc.reason !== 'used')), {}, true);
  add('apostrophe:assistantRevertUsed', kept.filter(doc => doc.reason === 'used'), {}, true);
  const unrestorable = of(doc => doc.outcome === 'unrestorable');
  add('apostrophe:assistantRevertUnrestorable', unrestorable.filter(doc => !doc.partly), {}, true);
  add('apostrophe:assistantRevertUnrestorablePartly', unrestorable.filter(doc => doc.partly), {}, true);
  const locked = of(doc => doc.outcome === 'locked');
  const holders = [ ...new Set(locked.map(doc => doc.lockedBy)) ];
  if ((holders.length === 1) && holders[0]) {
    add('apostrophe:assistantRevertLockedBy', locked, { name: holders[0] }, true);
  } else {
    add('apostrophe:assistantRevertLockedElsewhere', locked, {}, true);
  }
  add('apostrophe:assistantRevertAlready', of(doc => doc.outcome === 'reverted'));
  return lines;

  function add(key, list, params = {}, named = false) {
    if (list.length) {
      lines.push({
        key,
        count: list.length,
        params,
        names: named ? list.map(doc => getTitle(doc, $t)) : null
      });
    }
  }
}

/**
 * A running revert's status line, from its latest progress.
 *
 * @param {object} revert
 * @param {object} progress The store's `revertProgress`.
 * @param {Function} $t
 * @returns {string}
 */
export function getRevertStatus(revert, progress, $t) {
  const latest = progress[revert._id] || revert.progress;
  return latest
    ? $t('apostrophe:assistantReverting', {
      done: latest.done,
      count: latest.total
    })
    : $t('apostrophe:assistantRevertingStart');
}

/**
 * What a failed revert says: how far it got, and that what it put back
 * stays. `{ title, text }`.
 *
 * @param {object} revert
 * @param {Function} $t
 * @returns {object}
 */
export function getRevertFailure(revert, $t) {
  const { progress } = revert;
  if (!progress?.done) {
    return {
      title: $t('apostrophe:assistantRevertFailed'),
      text: $t('apostrophe:assistantRevertFailedText')
    };
  }
  return {
    title: $t('apostrophe:assistantRevertStopped', {
      done: progress.done,
      count: progress.total
    }),
    text: $t('apostrophe:assistantRevertStoppedText', { count: progress.done })
  };
}

/**
 * The documents a done revert did not put back, or put back only partly,
 * as the result lists them.
 *
 * @param {object} revert
 * @returns {object[]}
 */
export function getNotReverted(revert) {
  return (revert.documents || []).filter(doc => NOT_REVERTED.includes(doc.outcome));
}

/**
 * Why a document was not put back, in the editor's words.
 *
 * @param {object} doc
 * @param {Function} $t
 * @returns {string}
 */
export function getReason(doc, $t) {
  const reason = getReasonText(doc, $t);
  return doc.partly
    ? $t('apostrophe:assistantRevertReasonPartly', { reason })
    : reason;
}

function getReasonText({
  outcome, reason, lockedBy
}, $t) {
  if (outcome === 'locked') {
    return lockedBy
      ? $t('apostrophe:assistantRevertReasonLockedBy', { name: lockedBy })
      : $t('apostrophe:assistantRevertReasonLocked');
  }
  if (outcome === 'unrestorable') {
    const why = {
      permission: 'apostrophe:assistantRevertWhyPermission',
      widgetType: 'apostrophe:assistantRevertWhyWidgetType',
      related: 'apostrophe:assistantRevertWhyRelated',
      layout: 'apostrophe:assistantRevertWhyLayout',
      system: 'apostrophe:assistantRevertWhySystem'
    }[reason];
    return why
      ? $t('apostrophe:assistantRevertReasonUnrestorableWhy', { why: $t(why) })
      : $t('apostrophe:assistantRevertReasonUnrestorable');
  }
  return $t({
    archived: 'apostrophe:assistantRevertReasonArchived',
    removed: 'apostrophe:assistantRevertReasonRemoved',
    published: 'apostrophe:assistantRevertReasonPublished',
    children: 'apostrophe:assistantRevertReasonChildren',
    used: 'apostrophe:assistantRevertReasonUsed'
  }[reason] || 'apostrophe:assistantRevertReasonEdited');
}

export function getTitle(doc, $t) {
  return doc.title || $t('apostrophe:assistantUntitled');
}

/**
 * Names as a list a sentence ends with, five at most and then "N more":
 * parts `{ text, name }`, `name` true for a document's title.
 *
 * @param {string[]} names
 * @param {Function} $t
 * @returns {Array<{ text: string, name: boolean }>}
 */
export function formatNames(names, $t) {
  const shown = names.slice(0, NAMES_MAX);
  const more = names.length - shown.length;
  const items = more
    ? [ ...shown, $t('apostrophe:assistantRevertNamesMore', { count: more }) ]
    : shown;
  const format = new Intl.ListFormat(apos.i18n.adminLocale, { type: 'conjunction' });
  let index = 0;
  return format.formatToParts(items).map((part) => {
    if (part.type !== 'element') {
      return {
        text: part.value,
        name: false
      };
    }
    return {
      text: part.value,
      name: (index++ < shown.length)
    };
  });
}

/**
 * A translated sentence split around the number it states, so the number
 * stands out wherever the language puts it.
 *
 * @param {string} text
 * @param {number} count
 * @returns {Array<{ text: string, count: boolean }>}
 */
export function splitCount(text, count) {
  const value = String(count);
  const at = text.indexOf(value);
  if (at === -1) {
    return [ {
      text,
      count: false
    } ];
  }
  return [
    {
      text: text.slice(0, at),
      count: false
    },
    {
      text: value,
      count: true
    },
    {
      text: text.slice(at + value.length),
      count: false
    }
  ].filter(part => part.text);
}

/**
 * Shows a document's changes: See Changes on its page, in edit mode, or
 * its Document Versions (`view` as the revert stored it). See Changes of
 * another page goes there first, and is entered once it loads.
 *
 * @param {object} doc
 */
export async function showDocument(doc) {
  if (doc.view === 'versions') {
    const versions = apos.modules['@apostrophecms/document-versions'];
    await apos.modal.execute(versions.components.versions, {
      moduleName: versions.name,
      doc: {
        _id: doc.docId,
        type: doc.type
      }
    });
    return;
  }
  if (isContext(doc)) {
    await enterSeeChanges();
    return;
  }
  const type = apos.page.validPageTypes.includes(doc.type) ? '@apostrophecms/page' : doc.type;
  const found = await apos.http.get(`${apos.modules[type].action}/${doc.docId}`, {
    qs: {
      aposMode: 'draft',
      ...(doc.locale && { aposLocale: doc.locale })
    }
  });
  if (!found?._url) {
    return;
  }
  try {
    window.sessionStorage.setItem(HANDOFF, doc.aposDocId);
  } catch (e) {
    // The page opens without See Changes
  }
  window.location.assign(found._url);
}

/**
 * At page load: the page a "See changes" link came to enters edit mode and
 * See Changes once the context bar is ready.
 */
export async function resumeSeeChanges() {
  let aposDocId = null;
  try {
    aposDocId = window.sessionStorage.getItem(HANDOFF);
    window.sessionStorage.removeItem(HANDOFF);
  } catch (e) {
    return;
  }
  if (!aposDocId || !await waitForContextBar()) {
    return;
  }
  if (isContext({ aposDocId })) {
    await enterSeeChanges();
  }
}

function isContext({ aposDocId }) {
  const contextId = window.apos.adminBar?.contextId;
  return Boolean(contextId) && (contextId.split(':')[0] === aposDocId);
}

async function enterSeeChanges() {
  if (await window.apos.adminBar?.setEditMode?.(true)) {
    apos.bus.$emit('see-changes', { checked: true });
  }
}

// The context bar sets `setEditMode` and the context's id as it mounts
function waitForContextBar() {
  const started = Date.now();
  return new Promise((resolve) => {
    check();
    function check() {
      const bar = window.apos.adminBar;
      if (bar?.setEditMode && bar.contextId) {
        resolve(true);
      } else if ((Date.now() - started) > READY_WAIT) {
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    }
  });
}

function getTypeLabel(documents, $t) {
  const types = [ ...new Set(documents.map(doc => doc.type)) ];
  const [ first ] = documents;
  if ((types.length !== 1) || !first?.label) {
    return $t((documents.length === 1) ? 'apostrophe:document' : 'apostrophe:assistantDocuments');
  }
  return $t((documents.length === 1) ? first.label : (first.pluralLabel || first.label));
}
