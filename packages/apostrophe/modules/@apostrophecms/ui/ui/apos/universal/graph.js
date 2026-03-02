/**
 * A rooted forest (collection of trees) with bidirectional
 * adjacency and per-node metadata.
 *
 * Constraints:
 * - Each node has at most one parent (tree structure).
 * - No cycles (enforced).
 * - Each node carries an arbitrary metadata object.
 *
 * Optimized for three query patterns:
 * - Get the parent of a node: O(1)
 * - Get the children of a node: O(1)
 * - Check if two nodes share the same parent: O(1)
 *
 * Every edge is stored twice (once in each direction map),
 * which costs 2x edge storage but gives O(1) lookups in either direction.
 *
 * @typedef {Object} NodeMeta - arbitrary metadata object attached to each node
 */
export default class DirectedGraph {
  /** @type {Map<string, Set<string>>} nodeId → Set of child ids */
  #children;

  /** @type {Map<string, string|null>} nodeId → parent id or null */
  #parents;

  /** @type {Map<string, NodeMeta>} nodeId → metadata object */
  #meta;

  constructor() {
    this.#children = new Map();
    this.#parents = new Map();
    this.#meta = new Map();
  }

  /**
   * Ensure a node exists in the graph.
   * If the node already exists, its metadata is shallow-merged
   * with any new values provided.
   * @param {string} id
   * @param {NodeMeta} [meta={}] - metadata to attach to the node
   * @returns {this}
   */
  addNode(id, meta = {}) {
    if (!this.#children.has(id)) {
      this.#children.set(id, new Set());
      this.#parents.set(id, null);
      this.#meta.set(id, { ...meta });
    } else if (Object.keys(meta).length > 0) {
      Object.assign(this.#meta.get(id), meta);
    }
    return this;
  }

  /**
   * Add a directed edge from `parentId` to `childId`.
   * Both nodes are created if they don't exist.
   * Throws if:
   * - the child already has a parent (single-parent constraint)
   * - the edge would create a cycle
   * @param {string} parentId
   * @param {string} childId
   * @returns {this}
   */
  addEdge(parentId, childId) {
    if (parentId === childId) {
      throw new Error(`Self-loop not allowed: "${parentId}"`);
    }
    this.addNode(parentId);
    this.addNode(childId);

    const existingParent = this.#parents.get(childId);
    if (existingParent !== null && existingParent !== parentId) {
      throw new Error(
        `Node "${childId}" already has parent "${existingParent}". ` +
        'Each node can have at most one parent.'
      );
    }
    // Already linked — nothing to do
    if (existingParent === parentId) {
      return this;
    }

    // Cycle check: walk up from parentId; if we reach childId it's a cycle
    if (this.hasAncestor(parentId, childId)) {
      throw new Error(
        `Adding edge "${parentId}" → "${childId}" would create a cycle`
      );
    }

    this.#children.get(parentId).add(childId);
    this.#parents.set(childId, parentId);
    return this;
  }

  /**
   * Remove the directed edge from `parentId` to `childId`.
   * No-op if the edge doesn't exist.
   * @param {string} parentId
   * @param {string} childId
   * @returns {this}
   */
  removeEdge(parentId, childId) {
    if (this.#parents.get(childId) === parentId) {
      this.#parents.set(childId, null);
      this.#children.get(parentId)?.delete(childId);
    }
    return this;
  }

  /**
   * Remove a node and its entire subtree (all descendants).
   * The node is detached from its parent; every descendant
   * is also removed from the graph.
   * @param {string} id
   * @returns {this}
   */
  removeNode(id) {
    if (!this.#children.has(id)) {
      return this;
    }
    // Detach from parent
    const parentId = this.#parents.get(id);
    if (parentId !== null && parentId !== undefined) {
      this.#children.get(parentId)?.delete(id);
    }
    // BFS to collect the entire subtree (including `id` itself)
    const queue = [ id ];
    const toRemove = [];
    while (queue.length > 0) {
      const current = queue.shift();
      toRemove.push(current);
      const children = this.#children.get(current);
      if (children) {
        for (const childId of children) {
          queue.push(childId);
        }
      }
    }
    // Remove all collected nodes
    for (const nodeId of toRemove) {
      this.#children.delete(nodeId);
      this.#parents.delete(nodeId);
      this.#meta.delete(nodeId);
    }
    return this;
  }

  /**
   * Check if a node exists in the graph.
   * @param {string} id
   * @returns {boolean}
   */
  hasNode(id) {
    return this.#children.has(id);
  }

  /**
   * Check if a directed edge exists from `parentId` to `childId`.
   * @param {string} parentId
   * @param {string} childId
   * @returns {boolean}
   */
  hasEdge(parentId, childId) {
    return this.#parents.get(childId) === parentId;
  }

  /**
   * Check if `childId` is a direct child of `nodeId`.
   * Semantic convenience — equivalent to `hasEdge(nodeId, childId)`.
   * @param {string} nodeId
   * @param {string} childId
   * @returns {boolean}
   */
  hasChild(nodeId, childId) {
    return this.#parents.get(childId) === nodeId;
  }

  /**
   * Get the direct parent of a node.
   * @param {string} id
   * @returns {string|null} The parent id, or null if root / not found
   */
  getParent(id) {
    return this.#parents.get(id) ?? null;
  }

  /**
   * Get the direct children of a node.
   * @param {string} id
   * @returns {string[]} Array of child ids (empty if none or node doesn't exist)
   */
  getChildren(id) {
    const children = this.#children.get(id);
    return children ? [ ...children ] : [];
  }

  /**
   * Check if two nodes share the same direct parent.
   * Two root nodes (parent === null) are NOT considered to share a parent.
   * @param {string} idA
   * @param {string} idB
   * @returns {boolean}
   */
  hasCommonParent(idA, idB) {
    const parentA = this.#parents.get(idA);
    const parentB = this.#parents.get(idB);
    return parentA != null && parentA === parentB;
  }

  /**
   * Check if two nodes share any common ancestor
   * (not just the direct parent — any node in both ancestor chains).
   * Collects ancestors of one node into a Set, then walks the other's
   * chain checking for membership. O(d1 + d2) time.
   * Two root nodes are NOT considered to share a common ancestor.
   * @param {string} idA
   * @param {string} idB
   * @returns {boolean}
   */
  hasCommonAncestor(idA, idB) {
    const ancestorsA = new Set();
    let current = this.#parents.get(idA) ?? null;
    while (current !== null) {
      ancestorsA.add(current);
      current = this.#parents.get(current) ?? null;
    }
    if (ancestorsA.size === 0) {
      return false;
    }
    current = this.#parents.get(idB) ?? null;
    while (current !== null) {
      if (ancestorsA.has(current)) {
        return true;
      }
      current = this.#parents.get(current) ?? null;
    }
    return false;
  }

  /**
   * Get the metadata object for a node.
   * @param {string} id
   * @returns {NodeMeta|null} The metadata, or null if the node doesn't exist
   */
  getMeta(id) {
    return this.#meta.get(id) ?? null;
  }

  /**
   * Update (shallow-merge) metadata for an existing node.
   * @param {string} id
   * @param {Partial<NodeMeta>} meta
   * @returns {this}
   */
  setMeta(id, meta) {
    const existing = this.#meta.get(id);
    if (!existing) {
      throw new Error(`Node "${id}" does not exist`);
    }
    Object.assign(existing, meta);
    return this;
  }

  /**
   * Check if `candidateId` is an ancestor of `nodeId`
   * (i.e. reachable by walking up the single-parent chain).
   * O(depth) — walks the parent chain.
   * @param {string} nodeId
   * @param {string} candidateId
   * @returns {boolean}
   */
  hasAncestor(nodeId, candidateId) {
    let current = this.#parents.get(nodeId) ?? null;
    while (current !== null) {
      if (current === candidateId) {
        return true;
      }
      current = this.#parents.get(current) ?? null;
    }
    return false;
  }

  /**
   * Check if `candidateId` is a descendant of `nodeId`
   * (i.e. reachable by walking down through children).
   * Uses BFS.
   * @param {string} nodeId
   * @param {string} candidateId
   * @returns {boolean}
   */
  hasDescendant(nodeId, candidateId) {
    const queue = [ nodeId ];
    const visited = new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === candidateId && current !== nodeId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const children = this.#children.get(current);
      if (children) {
        for (const childId of children) {
          if (!visited.has(childId)) {
            queue.push(childId);
          }
        }
      }
    }
    return false;
  }

  /**
   * Get all ancestor ids from the direct parent up to the root.
   * Ordered nearest-first: [directParent, grandparent, …, root].
   * @param {string} id
   * @returns {string[]}
   */
  getAncestors(id) {
    const ancestors = [];
    let current = this.#parents.get(id) ?? null;
    while (current !== null) {
      ancestors.push(current);
      current = this.#parents.get(current) ?? null;
    }
    return ancestors;
  }

  /**
   * Get all descendant ids (transitive children) of a node.
   * @param {string} id
   * @returns {string[]}
   */
  getDescendants(id) {
    const descendants = [];
    const queue = [ ...this.getChildren(id) ];
    const visited = new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      descendants.push(current);
      const children = this.#children.get(current);
      if (children) {
        for (const childId of children) {
          if (!visited.has(childId)) {
            queue.push(childId);
          }
        }
      }
    }
    return descendants;
  }

  /**
   * Get the root of the tree containing the given node
   * (the furthest ancestor with no parent).
   * @param {string} id
   * @returns {string|null} The root id, or null if the node doesn't exist
   */
  getRoot(id) {
    if (!this.hasNode(id)) {
      return null;
    }
    let current = id;
    let parent = this.#parents.get(current);
    while (parent !== null && parent !== undefined) {
      current = parent;
      parent = this.#parents.get(current);
    }
    return current;
  }

  /**
   * Get all root nodes (nodes with no parent).
   * @returns {string[]}
   */
  getRoots() {
    const roots = [];
    for (const [ id, parent ] of this.#parents) {
      if (parent === null) {
        roots.push(id);
      }
    }
    return roots;
  }

  /**
   * Get all leaf nodes (nodes with no children).
   * @returns {string[]}
   */
  getLeaves() {
    const leaves = [];
    for (const [ id, children ] of this.#children) {
      if (children.size === 0) {
        leaves.push(id);
      }
    }
    return leaves;
  }

  /**
   * Get the depth of a node (distance from its root).
   * Root nodes have depth 0.
   * @param {string} id
   * @returns {number} The depth, or -1 if the node doesn't exist
   */
  getDepth(id) {
    if (!this.hasNode(id)) {
      return -1;
    }
    let depth = 0;
    let current = this.#parents.get(id);
    while (current !== null && current !== undefined) {
      depth++;
      current = this.#parents.get(current);
    }
    return depth;
  }

  /**
   * Get all node ids in the graph.
   * @returns {string[]}
   */
  getNodes() {
    return [ ...this.#children.keys() ];
  }

  /**
   * Get the total number of nodes.
   * @returns {number}
   */
  get size() {
    return this.#children.size;
  }

  /**
   * Remove all nodes and edges.
   * @returns {this}
   */
  clear() {
    this.#children.clear();
    this.#parents.clear();
    this.#meta.clear();
    return this;
  }
}
