import { ref } from 'vue';

/**
 * The version shown in the modal body: the document as schema fields,
 * marked by the server with its changes since the version before it, and
 * the changes of every marked widget by `_id`. The marked document is for
 * display only: it holds the widgets the version deleted, so it must never
 * be saved; `fetchVersion` loads the version as stored. Only the most
 * recent `show()` call may update the state, so a slow response for a
 * version the user has already moved away from is dropped.
 *
 * @param {{ action: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionView({ action }) {
  const docFields = ref({ data: {} });
  // `{ [widgetId]: { changes, ai, data } }`, see `getWidgetChanges`
  const widgetChanges = ref({});
  // Tells the schema components to take the new document
  const generation = ref(0);

  let requestId = 0;

  function fetchVersion(versionId) {
    return apos.http.get(`${action}/${versionId}`, { busy: true });
  }

  // Resolves `true` when the view now shows `versionId`, `false` when a
  // later call superseded this one. Request errors are thrown, unless the
  // call was superseded meanwhile. With `consolidate`, `versionId` being
  // the newest version of a consolidated version, the changes are those of
  // all its versions.
  async function show(versionId, { consolidate = false } = {}) {
    const id = ++requestId;
    let response;
    try {
      response = await apos.http.get(`${action}/${versionId}`, {
        busy: true,
        qs: {
          annotate: 1,
          ...(consolidate && { consolidate: 1 })
        }
      });
    } catch (e) {
      if (id !== requestId) {
        return false;
      }
      throw e;
    }
    if (id !== requestId) {
      return false;
    }
    widgetChanges.value = getWidgetChanges(response.doc);
    docFields.value = { data: { ...response.doc } };
    generation.value++;
    return true;
  }

  return {
    docFields,
    widgetChanges,
    generation,
    show,
    fetchVersion
  };
}

// The markers of the annotated document, collected by widget `_id`:
// `changes` lists `added`, `modified` or `deleted`, then `moved` when the
// widget changed places in its area; `ai` is whether AI was involved in
// any of them; `data` is what the rendering of a widget with an older
// version needs (see the markers store): `content` is taken from any such
// widget, rich text or not, which is harmless since it is the widget's own
// value, marked only for rich text. Nested widgets are rendered by the
// server from sanitized data, which drops the markers, so the area wrapper
// finds its changes here instead
function getWidgetChanges(doc) {
  const changes = {};
  collect(doc);
  return changes;

  function collect(node) {
    if (!node || (typeof node !== 'object')) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node._id && (node.metaType === 'widget')) {
      const change = (node._inserted && 'added') ||
        (node._deleted && 'deleted') ||
        ((node._modified || node._olderVersion) && 'modified') ||
        null;
      const found = [ change, node._moved && 'moved' ].filter(Boolean);
      if (found.length) {
        changes[node._id] = {
          changes: found,
          ai: Boolean(node._changedWithAi || node._movedWithAi),
          ...(node._olderVersion && {
            data: {
              _olderVersion: node._olderVersion,
              ...(typeof node.content === 'string' && { content: node.content })
            }
          })
        };
      }
    }
    for (const [ key, value ] of Object.entries(node)) {
      // The older widget is not part of this version
      if (key !== '_olderVersion') {
        collect(value);
      }
    }
  }
}
