import { defineStore } from 'pinia';
import { ref } from 'vue';
import WidgetGraph from '../universal/widgetGraph.js';

/**
 * @typedef {import('../universal/widgetGraph.js').NodeMeta} NodeMeta
 */

/**
 * @typedef {Object} Widget
 * @property {string} _id   - Unique widget identifier.
 * @property {string} type  - Widget type name (e.g. '@apostrophecms/rich-text').
 */

/**
 * @typedef {Object} GraphEntry
 * @property {WidgetGraph}          graph    - The directed graph instance.
 * @property {import('vue').Ref<number>} revision - Reactive revision counter.
 */

/**
 * @typedef {Object} DiscoveredChild
 * @property {string} widgetId - The child widget's _id.
 * @property {string} type     - The child widget's type.
 * @property {string} areaId   - The _id of the area containing the child.
 */

/**
 * @typedef {Object} ConsoleLine
 * @property {string}   text   - The formatted text including %c placeholders.
 * @property {string[]} styles - CSS style strings for each %c substitution.
 */

export const useWidgetGraphStore = defineStore('widgetGraph', () => {
  /** @type {Map<string, GraphEntry>} graphKey → { graph, revision } */
  const graphs = new Map();

  // ── public API ──

  /**
   * Register a widget and discover its children from area fields
   * in the schema. Handles node creation, edge creation, and
   * revision bumping internally.
   *
   * @param {string} graphKey
   * @param {Widget} widget
   * @param {Object}  [options]
   * @param {string}  [options.areaId] - The _id of the area containing this widget.
   * @returns {void}
   */
  function registerWidget(graphKey, widget, { areaId } = {}) {
    const { graph } = _ensure(graphKey);
    const type = widget.type;
    const schema = apos.modules[apos.area.widgetManagers[type]]?.schema || [];

    graph.addNode(widget._id, {
      type,
      areaId
    });

    const children = _discoverChildren(schema, widget);
    for (const child of children) {
      graph.addNode(child.widgetId, {
        type: child.type,
        areaId: child.areaId
      });
      graph.addEdge(widget._id, child.widgetId);
    }

    _bump(graphKey);
  }

  /**
   * Remove a widget and its entire subtree.
   *
   * @param {string} graphKey
   * @param {string} widgetId
   * @returns {void}
   */
  function unregisterWidget(graphKey, widgetId) {
    const entry = graphs.get(graphKey);
    if (entry && entry.graph.hasNode(widgetId)) {
      entry.graph.removeNode(widgetId);
      _bump(graphKey);
    }
  }

  /**
   * Re-instantiate the graph for a graphKey (e.g. page refresh).
   * Faster than clear() — allocates fresh internals.
   *
   * @param {string} graphKey
   * @returns {void}
   */
  function resetGraph(graphKey) {
    graphs.set(graphKey, {
      graph: new WidgetGraph(),
      revision: ref(0)
    });
  }

  /**
   * Delete the graph entry entirely (e.g. modal close).
   *
   * @param {string} graphKey
   * @returns {void}
   */
  function destroyGraph(graphKey) {
    graphs.delete(graphKey);
  }

  /**
   * Get the WidgetGraph instance for a graphKey, or null.
   *
   * @param {string} graphKey
   * @returns {WidgetGraph | null}
   */
  function getGraph(graphKey) {
    return graphs.get(graphKey)?.graph ?? null;
  }

  /**
   * Get the reactive revision ref for a graphKey.
   * Returns a ref(0) stub if no graph exists yet, so that
   * computed properties don't break.
   *
   * @param {string} graphKey
   * @returns {import('vue').Ref<number>}
   */
  function getRevision(graphKey) {
    return graphs.get(graphKey)?.revision ?? ref(0);
  }

  /**
   * Get the direct parent of a widget.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @returns {string | null}
   */
  function getParent(graphKey, nodeId) {
    const { graph } = _read(graphKey);
    return graph?.getParent(nodeId) ?? null;
  }

  /**
   * Check if two widgets share the same direct parent.
   * Two root widgets are NOT considered to share a parent.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} idA
   * @param {string} idB
   * @returns {boolean}
   */
  function hasCommonParent(graphKey, idA, idB) {
    const { graph } = _read(graphKey);
    return graph?.hasCommonParent(idA, idB) ?? false;
  }

  /**
   * Get all ancestor ids from the direct parent up to the root.
   * Ordered nearest-first: [directParent, grandparent, …, root].
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @returns {string[]}
   */
  function getAncestors(graphKey, nodeId) {
    const { graph } = _read(graphKey);
    return graph?.getAncestors(nodeId) ?? [];
  }

  /**
   * Check if two widgets share any common ancestor.
   * Two root widgets are NOT considered to share a common ancestor.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} idA
   * @param {string} idB
   * @returns {boolean}
   */
  function hasCommonAncestor(graphKey, idA, idB) {
    const { graph } = _read(graphKey);
    return graph?.hasCommonAncestor(idA, idB) ?? false;
  }

  /**
   * Check if `candidateId` is an ancestor of `nodeId`.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @param {string} candidateId
   * @returns {boolean}
   */
  function hasAncestor(graphKey, nodeId, candidateId) {
    const { graph } = _read(graphKey);
    return graph?.hasAncestor(nodeId, candidateId) ?? false;
  }

  /**
   * Get the direct children of a widget.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @returns {string[]}
   */
  function getChildren(graphKey, nodeId) {
    const { graph } = _read(graphKey);
    return graph?.getChildren(nodeId) ?? [];
  }

  /**
   * Check if `childId` is a direct child of `nodeId`.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @param {string} childId
   * @returns {boolean}
   */
  function hasChild(graphKey, nodeId, childId) {
    const { graph } = _read(graphKey);
    return graph?.hasChild(nodeId, childId) ?? false;
  }

  /**
   * Get all descendant ids (transitive children) of a widget.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @returns {string[]}
   */
  function getDescendants(graphKey, nodeId) {
    const { graph } = _read(graphKey);
    return graph?.getDescendants(nodeId) ?? [];
  }

  /**
   * Check if `candidateId` is a descendant of `nodeId`.
   * Reactive — triggers recomputation when the graph changes.
   *
   * @param {string} graphKey
   * @param {string} nodeId
   * @param {string} candidateId
   * @returns {boolean}
   */
  function hasDescendant(graphKey, nodeId, candidateId) {
    const { graph } = _read(graphKey);
    return graph?.hasDescendant(nodeId, candidateId) ?? false;
  }

  // ── internal ──

  /**
   * Read a graph entry and touch its reactive revision counter.
   * When called from within a Vue computed or watcher, this
   * establishes a dependency so the consumer re-evaluates
   * whenever the graph is mutated.
   *
   * @param {string} graphKey
   * @returns {{ graph: WidgetGraph | null, revision: number }}
   */
  function _read(graphKey) {
    const entry = graphs.get(graphKey);
    if (!entry) {
      return {
        graph: null,
        revision: 0
      };
    }
    // Access .value to let Vue's reactivity system track this ref
    const revision = entry.revision.value;
    return {
      graph: entry.graph,
      revision
    };
  }

  /**
   * Ensure a graph entry exists for the given key.
   * Creates a new WidgetGraph and revision ref(0) if absent.
   *
   * @param {string} graphKey
   * @returns {GraphEntry}
   */
  function _ensure(graphKey) {
    if (!graphs.has(graphKey)) {
      graphs.set(graphKey, {
        graph: new WidgetGraph(),
        revision: ref(0)
      });
    }
    return graphs.get(graphKey);
  }

  /**
   * Increment the reactive revision counter for a graph key,
   * signalling dependents that the graph has changed.
   *
   * @param {string} graphKey
   * @returns {void}
   */
  function _bump(graphKey) {
    const entry = graphs.get(graphKey);
    if (entry) {
      entry.revision.value++;
    }
  }

  /**
   * Recursively scan schema fields for nested area children.
   * Traverses area, array, and object fields to find all
   * widget items contained within.
   *
   * @param {Object[]} schema  - Apostrophe field schema array.
   * @param {Object}   dataObj - The data object matching the schema.
   * @returns {DiscoveredChild[]}
   */
  function _discoverChildren(schema, dataObj) {
    const children = [];
    for (const field of schema) {
      if (field.type === 'area') {
        const area = dataObj[field.name];
        if (area?.items?.length) {
          for (const child of area.items) {
            children.push({
              widgetId: child._id,
              type: child.type,
              areaId: area._id
            });
          }
        }
      } else if (field.type === 'array' && field.schema) {
        for (const item of (dataObj[field.name] || [])) {
          children.push(..._discoverChildren(field.schema, item));
        }
      } else if (field.schema) {
        // object, or any future compound type with a nested schema
        if (dataObj[field.name]) {
          children.push(..._discoverChildren(field.schema, dataObj[field.name]));
        }
      }
    }
    return children;
  }

  // ── debug ──

  // Register window.aposWidgetGraph() when debug mode is enabled.
  // Usage from browser console: aposWidgetGraph()
  // Optionally pass a graphKey: aposWidgetGraph('some-doc-id')
  if (typeof window !== 'undefined' && apos.ui.debug) {
    const {
      log, groupCollapsed, groupEnd, table
    } = console;
    window.aposWidgetGraph = function (graphKey) {
      const entries = graphKey
        ? (graphs.has(graphKey) ? [ [ graphKey, graphs.get(graphKey) ] ] : [])
        : [ ...graphs ];

      if (graphKey && entries.length === 0) {
        log('%c⚠ No graph for key "%s"', 'color:#f44', graphKey);
        return;
      }
      if (entries.length === 0) {
        log('%c⚠ No widget graphs registered.', 'color:#f44');
        return;
      }

      for (const [ key, { graph } ] of entries) {
        const roots = graph.getRoots();
        groupCollapsed(
          `%cTree ${key} %c(${graph.size} nodes)`,
          'color:#dcdcaa;font-weight:bold;font-size:13px',
          'color:#999;font-weight:normal;font-size:12px'
        );
        roots.forEach((root, i) => {
          const lines = _printTree(graph, root, '', i === roots.length - 1, true);
          for (const line of lines) {
            log(line.text, ...line.styles);
          }
        });
        groupEnd();

        // Raw data table in its own collapsible group
        groupCollapsed(
          `%cData ${key} %c(${graph.size} rows)`,
          'color:#9cdcfe;font-weight:bold;font-size:13px',
          'color:#999;font-weight:normal;font-size:12px'
        );
        const rows = {};
        for (const nodeId of graph.getNodes()) {
          const meta = graph.getMeta(nodeId) || {};
          rows[nodeId] = {
            type: meta.type || '',
            areaId: meta.areaId || '',
            parent: graph.getParent(nodeId) || '(root)',
            children: graph.getChildren(nodeId).length,
            depth: graph.getDepth(nodeId)
          };
        }
        table(rows);
        groupEnd();
      }
    };

    function _printTree(graph, nodeId, prefix, isLast, isRoot = false) {
      const meta = graph.getMeta(nodeId);
      const label = meta?.type || 'unknown';
      const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ');
      const childPrefix = isRoot ? '' : (prefix + (isLast ? '   ' : '│  '));
      const result = [
        {
          text: `${prefix}${connector}%c${label}%c {${nodeId}}`,
          styles: [ 'color:#4EC9B0;font-weight:bold', 'color:#888' ]
        }
      ];
      const children = graph.getChildren(nodeId);
      children.forEach((childId, i) => {
        result.push(
          ..._printTree(graph, childId, childPrefix, i === children.length - 1)
        );
      });
      return result;
    }
  }

  return {
    registerWidget,
    unregisterWidget,
    resetGraph,
    destroyGraph,
    getGraph,
    getRevision,
    getParent,
    hasCommonParent,
    getAncestors,
    hasCommonAncestor,
    hasAncestor,
    getChildren,
    hasChild,
    getDescendants,
    hasDescendant
  };
});
