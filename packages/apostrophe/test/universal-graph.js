const assert = require('node:assert/strict');

const getGraph = async () => import(
  '../modules/@apostrophecms/ui/ui/apos/universal/graph.js'
);

describe('DirectedGraph (universal)', function () {
  let DirectedGraph;

  before(async function () {
    const mod = await getGraph();
    DirectedGraph = mod.default;
  });

  describe('#addNode', function () {
    it('should add a node as a root with empty metadata', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.equal(g.hasNode('a'), true);
      assert.equal(g.size, 1);
      assert.equal(g.getParent('a'), null);
      assert.deepEqual(g.getMeta('a'), {});
    });

    it('should add a node with metadata', function () {
      const g = new DirectedGraph();
      g.addNode('w1', {
        type: 'hero',
        areaId: 'area-1'
      });
      assert.deepEqual(g.getMeta('w1'), {
        type: 'hero',
        areaId: 'area-1'
      });
    });

    it('should shallow-merge metadata when adding an existing node', function () {
      const g = new DirectedGraph();
      g.addNode('w1', {
        type: 'hero',
        areaId: 'area-1'
      });
      g.addNode('w1', { areaId: 'area-2' });
      assert.deepEqual(g.getMeta('w1'), {
        type: 'hero',
        areaId: 'area-2'
      });
    });

    it('should not overwrite metadata when called with empty meta on existing node', function () {
      const g = new DirectedGraph();
      g.addNode('w1', { type: 'hero' });
      g.addNode('w1');
      assert.deepEqual(g.getMeta('w1'), { type: 'hero' });
    });

    it('should not duplicate the node on repeated calls', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.addNode('a');
      assert.equal(g.size, 1);
    });

    it('should support chaining', function () {
      const g = new DirectedGraph();
      const result = g.addNode('a');
      assert.equal(result, g);
    });
  });

  describe('#addEdge', function () {
    it('should link parent to child', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasEdge('p', 'c'), true);
      assert.equal(g.getParent('c'), 'p');
      assert.deepEqual(g.getChildren('p'), [ 'c' ]);
    });

    it('should auto-create both nodes', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasNode('p'), true);
      assert.equal(g.hasNode('c'), true);
      assert.equal(g.size, 2);
    });

    it('should be idempotent for the same edge', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      g.addEdge('p', 'c');
      assert.deepEqual(g.getChildren('p'), [ 'c' ]);
    });

    it('should throw on self-loop', function () {
      const g = new DirectedGraph();
      assert.throws(
        () => g.addEdge('a', 'a'),
        /Self-loop not allowed: "a"/
      );
    });

    it('should throw when child already has a different parent', function () {
      const g = new DirectedGraph();
      g.addEdge('p1', 'c');
      assert.throws(
        () => g.addEdge('p2', 'c'),
        /already has parent "p1"/
      );
    });

    it('should throw when edge would create a cycle', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      assert.throws(
        () => g.addEdge('c', 'a'),
        /would create a cycle/
      );
    });

    it('should throw on two-node cycle', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      assert.throws(
        () => g.addEdge('b', 'a'),
        /would create a cycle/
      );
    });

    it('should support chaining', function () {
      const g = new DirectedGraph();
      const result = g.addEdge('a', 'b');
      assert.equal(result, g);
    });

    it('should allow multiple children for one parent', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c1');
      g.addEdge('p', 'c2');
      g.addEdge('p', 'c3');
      const children = g.getChildren('p');
      assert.equal(children.length, 3);
      assert.ok(children.includes('c1'));
      assert.ok(children.includes('c2'));
      assert.ok(children.includes('c3'));
    });
  });

  describe('#removeEdge', function () {
    it('should detach the child (making it a root) but keep both nodes', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      g.removeEdge('p', 'c');
      assert.equal(g.hasEdge('p', 'c'), false);
      assert.equal(g.getParent('c'), null);
      assert.deepEqual(g.getChildren('p'), []);
      assert.deepEqual(g.getChildren('c'), []);
      assert.equal(g.hasNode('p'), true);
      assert.equal(g.hasNode('c'), true);
    });

    it('should preserve the subtree below the detached child', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      g.addEdge('c', 'd');
      g.removeEdge('a', 'b');
      // b-c-d subtree is intact, b is now root
      assert.equal(g.getParent('b'), null);
      assert.equal(g.getParent('c'), 'b');
      assert.equal(g.getParent('d'), 'c');
    });

    it('should be a no-op when edge does not exist', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.addNode('b');
      g.removeEdge('a', 'b');
      assert.equal(g.size, 2);
    });

    it('should be a no-op when nodes do not exist', function () {
      const g = new DirectedGraph();
      g.removeEdge('x', 'y'); // no crash
      assert.equal(g.size, 0);
    });

    it('should not remove wrong edge when parentId does not match', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      g.addNode('other');
      g.removeEdge('other', 'c');
      // Edge p→c should still exist
      assert.equal(g.hasEdge('p', 'c'), true);
    });

    it('should support chaining', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      const result = g.removeEdge('p', 'c');
      assert.equal(result, g);
    });
  });

  describe('#removeNode', function () {
    it('should remove a leaf node', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      g.removeNode('c');
      assert.equal(g.hasNode('c'), false);
      assert.equal(g.hasNode('p'), true);
      assert.deepEqual(g.getChildren('p'), []);
      assert.equal(g.size, 1);
    });

    it('should remove a node and its entire subtree', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'a');
      g.addEdge('a', 'b');
      g.addEdge('a', 'c');
      g.addEdge('b', 'd');
      g.removeNode('a');
      assert.equal(g.hasNode('a'), false);
      assert.equal(g.hasNode('b'), false);
      assert.equal(g.hasNode('c'), false);
      assert.equal(g.hasNode('d'), false);
      assert.equal(g.hasNode('root'), true);
      assert.deepEqual(g.getChildren('root'), []);
      assert.equal(g.size, 1);
    });

    it('should remove a root node and its entire subtree', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'a');
      g.addEdge('root', 'b');
      g.addEdge('a', 'c');
      g.removeNode('root');
      assert.equal(g.size, 0);
    });

    it('should remove metadata of all subtree nodes', function () {
      const g = new DirectedGraph();
      g.addNode('p', { type: 'parent' });
      g.addNode('c', { type: 'child' });
      g.addEdge('p', 'c');
      g.removeNode('p');
      assert.equal(g.getMeta('p'), null);
      assert.equal(g.getMeta('c'), null);
    });

    it('should leave sibling subtrees intact', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'a');
      g.addEdge('root', 'b');
      g.addEdge('a', 'a1');
      g.addEdge('b', 'b1');
      g.removeNode('a');
      assert.equal(g.hasNode('a'), false);
      assert.equal(g.hasNode('a1'), false);
      assert.equal(g.hasNode('b'), true);
      assert.equal(g.hasNode('b1'), true);
      assert.equal(g.getParent('b'), 'root');
      assert.deepEqual(g.getChildren('root'), [ 'b' ]);
    });

    it('should be a no-op when node does not exist', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.removeNode('xyz');
      assert.equal(g.size, 1);
    });

    it('should support chaining', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      const result = g.removeNode('a');
      assert.equal(result, g);
    });
  });

  describe('#hasNode / #hasEdge', function () {
    it('should return false for non-existent node', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasNode('nope'), false);
    });

    it('should return false for non-existent edge', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.addNode('b');
      assert.equal(g.hasEdge('a', 'b'), false);
    });

    it('should return false for reversed edge direction', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      assert.equal(g.hasEdge('b', 'a'), false);
    });

    it('should return false when nodes do not exist at all', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasEdge('x', 'y'), false);
    });
  });

  describe('#getParent', function () {
    it('should return null for a root node', function () {
      const g = new DirectedGraph();
      g.addNode('root');
      assert.equal(g.getParent('root'), null);
    });

    it('should return the parent id', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.getParent('c'), 'p');
    });

    it('should return only the direct parent, not a grandparent', function () {
      const g = new DirectedGraph();
      g.addEdge('gp', 'p');
      g.addEdge('p', 'c');
      assert.equal(g.getParent('c'), 'p');
      assert.notEqual(g.getParent('c'), 'gp');
    });

    it('should return null for non-existent node', function () {
      const g = new DirectedGraph();
      assert.equal(g.getParent('nope'), null);
    });
  });

  describe('#getChildren', function () {
    it('should return an empty array for a leaf', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.deepEqual(g.getChildren('a'), []);
    });

    it('should return children in insertion order', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c1');
      g.addEdge('p', 'c2');
      g.addEdge('p', 'c3');
      // doesn't report grandchildren
      g.addEdge('c3', 'c3-1');
      assert.deepEqual(g.getChildren('p'), [ 'c1', 'c2', 'c3' ]);
    });

    it('should return an empty array for non-existent node', function () {
      const g = new DirectedGraph();
      assert.deepEqual(g.getChildren('nope'), []);
    });

    it('should return a copy, not a live reference', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      const children = g.getChildren('p');
      children.push('fake');
      assert.deepEqual(g.getChildren('p'), [ 'c' ]);
    });
  });

  describe('#hasCommonParent', function () {
    it('should return true for siblings', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'a');
      g.addEdge('p', 'b');
      assert.equal(g.hasCommonParent('a', 'b'), true);
    });

    it('should return false for nodes with different parents', function () {
      const g = new DirectedGraph();
      g.addEdge('p1', 'a');
      g.addEdge('p2', 'b');
      assert.equal(g.hasCommonParent('a', 'b'), false);
    });

    it('should return false for two root nodes', function () {
      const g = new DirectedGraph();
      g.addNode('r1');
      g.addNode('r2');
      assert.equal(g.hasCommonParent('r1', 'r2'), false);
    });

    it('should return false when one node does not exist', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.equal(g.hasCommonParent('a', 'nope'), false);
    });

    it('should return false for parent-child pair (not siblings)', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasCommonParent('p', 'c'), false);
    });

    it('should return false when neither node exists', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasCommonParent('x', 'y'), false);
    });
  });

  describe('#hasCommonAncestor', function () {
    it('should return true for siblings (common direct parent)', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'a');
      g.addEdge('p', 'b');
      assert.equal(g.hasCommonAncestor('a', 'b'), true);
    });

    it('should return true for cousins (common grandparent)', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'p1');
      g.addEdge('root', 'p2');
      g.addEdge('p1', 'a');
      g.addEdge('p2', 'b');
      assert.equal(g.hasCommonAncestor('a', 'b'), true);
    });

    it('should return true for nodes at different depths sharing an ancestor', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'p');
      g.addEdge('p', 'c');
      g.addEdge('root', 'sibling');
      // c is at depth 2, sibling at depth 1, both share root
      assert.equal(g.hasCommonAncestor('c', 'sibling'), true);
    });

    it('should return true for parent-child (they share the grandparent)', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'p');
      g.addEdge('p', 'c');
      // p's ancestors: {root}, c's ancestors: {p, root} → root is common
      assert.equal(g.hasCommonAncestor('p', 'c'), true);
    });

    it('should return false for two root nodes', function () {
      const g = new DirectedGraph();
      g.addNode('r1');
      g.addNode('r2');
      assert.equal(g.hasCommonAncestor('r1', 'r2'), false);
    });

    it('should return false for nodes in separate trees', function () {
      const g = new DirectedGraph();
      g.addEdge('r1', 'a');
      g.addEdge('r2', 'b');
      assert.equal(g.hasCommonAncestor('a', 'b'), false);
    });

    it('should return false when one node is a root and the other is its child', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'c');
      // root has no ancestors, so no common ancestor possible
      assert.equal(g.hasCommonAncestor('root', 'c'), false);
    });

    it('should return false when one node does not exist', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.equal(g.hasCommonAncestor('a', 'nope'), false);
    });

    it('should return false when neither node exists', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasCommonAncestor('x', 'y'), false);
    });
  });

  describe('#getMeta / #setMeta', function () {
    it('should return null for non-existent node', function () {
      const g = new DirectedGraph();
      assert.equal(g.getMeta('nope'), null);
    });

    it('should return an empty object for a node added without meta', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.deepEqual(g.getMeta('a'), {});
    });

    it('should shallow-merge metadata via setMeta', function () {
      const g = new DirectedGraph();
      g.addNode('w', { type: 'hero' });
      g.setMeta('w', { areaId: 'area-1' });
      assert.deepEqual(g.getMeta('w'), {
        type: 'hero',
        areaId: 'area-1'
      });
    });

    it('should overwrite existing keys via setMeta', function () {
      const g = new DirectedGraph();
      g.addNode('w', {
        type: 'hero',
        areaId: 'area-1'
      });
      g.setMeta('w', { type: 'banner' });
      assert.deepEqual(g.getMeta('w'), {
        type: 'banner',
        areaId: 'area-1'
      });
    });

    it('should throw when setting meta on non-existent node', function () {
      const g = new DirectedGraph();
      assert.throws(
        () => g.setMeta('nope', { type: 'x' }),
        /does not exist/
      );
    });

    it('should support chaining on setMeta', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      const result = g.setMeta('a', { type: 'x' });
      assert.equal(result, g);
    });

    it('should return a live reference to metadata (not a copy)', function () {
      const g = new DirectedGraph();
      g.addNode('a', { type: 'hero' });
      const meta = g.getMeta('a');
      meta.type = 'banner';
      assert.equal(g.getMeta('a').type, 'banner');
    });
  });

  describe('#hasAncestor', function () {
    it('should return true for a direct parent', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasAncestor('c', 'p'), true);
    });

    it('should return true for a grandparent', function () {
      const g = new DirectedGraph();
      g.addEdge('gp', 'p');
      g.addEdge('p', 'c');
      assert.equal(g.hasAncestor('c', 'gp'), true);
    });

    it('should return false for self', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.equal(g.hasAncestor('a', 'a'), false);
    });

    it('should return false for a descendant', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasAncestor('p', 'c'), false);
    });

    it('should return false for unrelated nodes', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.addNode('b');
      assert.equal(g.hasAncestor('a', 'b'), false);
    });

    it('should return false for non-existent nodes', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasAncestor('x', 'y'), false);
    });
  });

  describe('#hasDescendant', function () {
    it('should return true for a direct child', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasDescendant('p', 'c'), true);
    });

    it('should return true for a deeply nested descendant', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      g.addEdge('c', 'd');
      assert.equal(g.hasDescendant('a', 'd'), true);
    });

    it('should return false for self', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      assert.equal(g.hasDescendant('a', 'a'), false);
    });

    it('should return false for an ancestor', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.equal(g.hasDescendant('c', 'p'), false);
    });

    it('should return false for unrelated nodes', function () {
      const g = new DirectedGraph();
      g.addNode('a');
      g.addNode('b');
      assert.equal(g.hasDescendant('a', 'b'), false);
    });

    it('should return false for non-existent nodes', function () {
      const g = new DirectedGraph();
      assert.equal(g.hasDescendant('x', 'y'), false);
    });
  });

  describe('#getAncestors', function () {
    it('should return empty array for a root', function () {
      const g = new DirectedGraph();
      g.addNode('root');
      assert.deepEqual(g.getAncestors('root'), []);
    });

    it('should return ancestors ordered nearest-first', function () {
      const g = new DirectedGraph();
      g.addEdge('gp', 'p');
      g.addEdge('p', 'c');
      g.addEdge('c', 'gc');
      assert.deepEqual(g.getAncestors('gc'), [ 'c', 'p', 'gp' ]);
    });

    it('should return empty array for non-existent node', function () {
      const g = new DirectedGraph();
      assert.deepEqual(g.getAncestors('nope'), []);
    });

    it('should return only the direct parent for depth-1 node', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      assert.deepEqual(g.getAncestors('c'), [ 'p' ]);
    });
  });

  describe('#getDescendants', function () {
    it('should return empty array for a leaf', function () {
      const g = new DirectedGraph();
      g.addNode('leaf');
      assert.deepEqual(g.getDescendants('leaf'), []);
    });

    it('should return all descendants breadth-first', function () {
      const g = new DirectedGraph();
      g.addEdge('root', 'a');
      g.addEdge('root', 'b');
      g.addEdge('a', 'a1');
      g.addEdge('a', 'a2');
      g.addEdge('b', 'b1');
      const desc = g.getDescendants('root');
      assert.equal(desc.length, 5);
      // a and b before their own children
      assert.ok(desc.indexOf('a') < desc.indexOf('a1'));
      assert.ok(desc.indexOf('a') < desc.indexOf('a2'));
      assert.ok(desc.indexOf('b') < desc.indexOf('b1'));
    });

    it('should return empty for non-existent node', function () {
      const g = new DirectedGraph();
      assert.deepEqual(g.getDescendants('nope'), []);
    });
  });

  describe('#getRoot', function () {
    it('should return the node itself if it is a root', function () {
      const g = new DirectedGraph();
      g.addNode('r');
      assert.equal(g.getRoot('r'), 'r');
    });

    it('should return the topmost ancestor', function () {
      const g = new DirectedGraph();
      g.addEdge('r', 'a');
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      assert.equal(g.getRoot('c'), 'r');
    });

    it('should return null for non-existent node', function () {
      const g = new DirectedGraph();
      assert.equal(g.getRoot('nope'), null);
    });
  });

  describe('#getRoots / #getLeaves', function () {
    it('should return all root nodes', function () {
      const g = new DirectedGraph();
      g.addEdge('r1', 'a');
      g.addEdge('r2', 'b');
      const roots = g.getRoots();
      assert.equal(roots.length, 2);
      assert.ok(roots.includes('r1'));
      assert.ok(roots.includes('r2'));
    });

    it('should return all leaf nodes', function () {
      const g = new DirectedGraph();
      g.addEdge('r', 'a');
      g.addEdge('r', 'b');
      g.addEdge('a', 'c');
      const leaves = g.getLeaves();
      assert.equal(leaves.length, 2);
      assert.ok(leaves.includes('b'));
      assert.ok(leaves.includes('c'));
    });

    it('should count an isolated node as both root and leaf', function () {
      const g = new DirectedGraph();
      g.addNode('solo');
      assert.deepEqual(g.getRoots(), [ 'solo' ]);
      assert.deepEqual(g.getLeaves(), [ 'solo' ]);
    });

    it('should return empty arrays for empty graph', function () {
      const g = new DirectedGraph();
      assert.deepEqual(g.getRoots(), []);
      assert.deepEqual(g.getLeaves(), []);
    });
  });

  describe('#getDepth', function () {
    it('should return 0 for a root node', function () {
      const g = new DirectedGraph();
      g.addNode('r');
      assert.equal(g.getDepth('r'), 0);
    });

    it('should return correct depth for nested nodes', function () {
      const g = new DirectedGraph();
      g.addEdge('r', 'a');
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      assert.equal(g.getDepth('r'), 0);
      assert.equal(g.getDepth('a'), 1);
      assert.equal(g.getDepth('b'), 2);
      assert.equal(g.getDepth('c'), 3);
    });

    it('should return -1 for non-existent node', function () {
      const g = new DirectedGraph();
      assert.equal(g.getDepth('nope'), -1);
    });
  });

  describe('#getNodes / #size', function () {
    it('should return all node ids', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.addNode('c');
      const nodes = g.getNodes();
      assert.equal(nodes.length, 3);
      assert.ok(nodes.includes('a'));
      assert.ok(nodes.includes('b'));
      assert.ok(nodes.includes('c'));
    });

    it('should report correct size', function () {
      const g = new DirectedGraph();
      assert.equal(g.size, 0);
      g.addNode('a');
      assert.equal(g.size, 1);
      g.addEdge('a', 'b');
      assert.equal(g.size, 2);
    });

    it('should return empty array for empty graph', function () {
      const g = new DirectedGraph();
      assert.deepEqual(g.getNodes(), []);
    });
  });

  describe('#clear', function () {
    it('should remove everything', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.addEdge('b', 'c');
      g.addNode('d', { type: 'x' });
      g.clear();
      assert.equal(g.size, 0);
      assert.equal(g.hasNode('a'), false);
      assert.equal(g.getMeta('d'), null);
      assert.deepEqual(g.getNodes(), []);
    });

    it('should support chaining', function () {
      const g = new DirectedGraph();
      const result = g.clear();
      assert.equal(result, g);
    });

    it('should allow re-use after clear', function () {
      const g = new DirectedGraph();
      g.addEdge('a', 'b');
      g.clear();
      g.addEdge('x', 'y');
      assert.equal(g.size, 2);
      assert.equal(g.hasEdge('x', 'y'), true);
      assert.equal(g.hasNode('a'), false);
    });
  });

  describe('chaining', function () {
    it('should support fluent construction', function () {
      const g = new DirectedGraph();
      g.addNode('root', { type: 'page' })
        .addNode('hero', {
          type: 'hero',
          areaId: 'main'
        })
        .addEdge('root', 'hero')
        .addEdge('hero', 'text')
        .setMeta('text', {
          type: 'text',
          areaId: 'hero-content'
        });

      assert.equal(g.size, 3);
      assert.equal(g.getParent('text'), 'hero');
      assert.deepEqual(g.getMeta('text'), {
        type: 'text',
        areaId: 'hero-content'
      });
    });
  });

  describe('forest (multiple independent trees)', function () {
    it('should support independent trees with isolated queries', function () {
      const g = new DirectedGraph();
      g.addEdge('r1', 'a');
      g.addEdge('r1', 'b');
      g.addEdge('r2', 'c');
      g.addEdge('r2', 'd');

      assert.equal(g.getRoot('a'), 'r1');
      assert.equal(g.getRoot('c'), 'r2');
      assert.equal(g.hasDescendant('r1', 'c'), false);
      assert.equal(g.hasAncestor('a', 'r2'), false);
      assert.equal(g.hasCommonParent('a', 'b'), true);
      assert.equal(g.hasCommonParent('a', 'c'), false);
    });

    it('should remove one tree without affecting the other', function () {
      const g = new DirectedGraph();
      g.addEdge('r1', 'a');
      g.addEdge('r2', 'b');
      g.removeNode('r1');
      assert.equal(g.hasNode('r1'), false);
      assert.equal(g.hasNode('a'), false);
      assert.equal(g.hasNode('r2'), true);
      assert.equal(g.hasNode('b'), true);
    });
  });

  describe('complex widget-like scenario', function () {
    let g;

    beforeEach(function () {
      // Tree 1 (area-main):
      //   hero           (type: hero, area: main)          depth 0
      //   ├── text       (type: text, area: hero-body)     depth 1
      //   └── slideshow  (type: slideshow, area: hero-body) depth 1
      //       ├── img1   (type: image, area: slides)       depth 2
      //       └── img2   (type: image, area: slides)       depth 2
      // Tree 2 (area-sidebar):
      //   layout         (type: two-col, area: sidebar)    depth 0
      //   ├── card1      (type: card, area: col-left)      depth 1
      //   └── card2      (type: card, area: col-right)     depth 1
      //       └── badge  (type: badge, area: card-footer)  depth 2
      g = new DirectedGraph();

      // Tree 1
      g.addNode('hero', {
        type: 'hero',
        areaId: 'main'
      });
      g.addNode('text', {
        type: 'text',
        areaId: 'hero-body'
      });
      g.addNode('slideshow', {
        type: 'slideshow',
        areaId: 'hero-body'
      });
      g.addNode('img1', {
        type: 'image',
        areaId: 'slides'
      });
      g.addNode('img2', {
        type: 'image',
        areaId: 'slides'
      });

      g.addEdge('hero', 'text');
      g.addEdge('hero', 'slideshow');
      g.addEdge('slideshow', 'img1');
      g.addEdge('slideshow', 'img2');

      // Tree 2
      g.addNode('layout', {
        type: 'two-col',
        areaId: 'sidebar'
      });
      g.addNode('card1', {
        type: 'card',
        areaId: 'col-left'
      });
      g.addNode('card2', {
        type: 'card',
        areaId: 'col-right'
      });
      g.addNode('badge', {
        type: 'badge',
        areaId: 'card-footer'
      });

      g.addEdge('layout', 'card1');
      g.addEdge('layout', 'card2');
      g.addEdge('card2', 'badge');
    });

    it('should have 9 total nodes across two trees', function () {
      assert.equal(g.size, 9);
    });

    it('should report correct parent chain for deeply nested node', function () {
      assert.deepEqual(g.getAncestors('img1'), [ 'slideshow', 'hero' ]);
      assert.deepEqual(g.getAncestors('badge'), [ 'card2', 'layout' ]);
    });

    it('should report correct depth', function () {
      assert.equal(g.getDepth('hero'), 0);
      assert.equal(g.getDepth('slideshow'), 1);
      assert.equal(g.getDepth('img1'), 2);
      assert.equal(g.getDepth('layout'), 0);
      assert.equal(g.getDepth('card2'), 1);
      assert.equal(g.getDepth('badge'), 2);
    });

    it('should report siblings via hasCommonParent', function () {
      // Same parent
      assert.equal(g.hasCommonParent('text', 'slideshow'), true);
      assert.equal(g.hasCommonParent('img1', 'img2'), true);
      assert.equal(g.hasCommonParent('card1', 'card2'), true);
      // Different parents
      assert.equal(g.hasCommonParent('text', 'img1'), false);
      assert.equal(g.hasCommonParent('img1', 'card1'), false);
    });

    it('should detect common ancestors across depth levels', function () {
      // Within tree 1: img1 and text share ancestor hero
      assert.equal(g.hasCommonAncestor('img1', 'text'), true);
      // Within tree 1: img1 and img2 share ancestors (slideshow, hero)
      assert.equal(g.hasCommonAncestor('img1', 'img2'), true);
      // Within tree 2: badge and card1 share ancestor layout
      assert.equal(g.hasCommonAncestor('badge', 'card1'), true);
      // Across trees: no common ancestor
      assert.equal(g.hasCommonAncestor('img1', 'badge'), false);
      assert.equal(g.hasCommonAncestor('text', 'card1'), false);
      // Root nodes: no ancestors at all
      assert.equal(g.hasCommonAncestor('hero', 'layout'), false);
    });

    it('should find two roots and correct leaves', function () {
      const roots = g.getRoots();
      assert.equal(roots.length, 2);
      assert.ok(roots.includes('hero'));
      assert.ok(roots.includes('layout'));

      const leaves = g.getLeaves();
      assert.equal(leaves.length, 5);
      assert.ok(leaves.includes('text'));
      assert.ok(leaves.includes('img1'));
      assert.ok(leaves.includes('img2'));
      assert.ok(leaves.includes('card1'));
      assert.ok(leaves.includes('badge'));
    });

    it('should return all descendants of a subtree', function () {
      const desc = g.getDescendants('hero');
      assert.equal(desc.length, 4);
      assert.ok(desc.includes('text'));
      assert.ok(desc.includes('slideshow'));
      assert.ok(desc.includes('img1'));
      assert.ok(desc.includes('img2'));
    });

    it('should check ancestor/descendant relationships within and across trees', function () {
      assert.equal(g.hasAncestor('img1', 'hero'), true);
      assert.equal(g.hasAncestor('img1', 'slideshow'), true);
      assert.equal(g.hasAncestor('img1', 'layout'), false);
      assert.equal(g.hasDescendant('hero', 'img2'), true);
      assert.equal(g.hasDescendant('hero', 'badge'), false);
      assert.equal(g.hasDescendant('layout', 'badge'), true);
    });

    it('should get root from any node in either tree', function () {
      assert.equal(g.getRoot('img2'), 'hero');
      assert.equal(g.getRoot('hero'), 'hero');
      assert.equal(g.getRoot('badge'), 'layout');
      assert.equal(g.getRoot('layout'), 'layout');
    });

    it('should removeNode (slideshow) and take its subtree', function () {
      g.removeNode('slideshow');
      assert.equal(g.hasNode('slideshow'), false);
      assert.equal(g.hasNode('img1'), false);
      assert.equal(g.hasNode('img2'), false);
      // rest of tree 1 intact
      assert.equal(g.hasNode('hero'), true);
      assert.equal(g.hasNode('text'), true);
      assert.deepEqual(g.getChildren('hero'), [ 'text' ]);
      // tree 2 unaffected
      assert.equal(g.hasNode('layout'), true);
      assert.equal(g.hasNode('badge'), true);
      assert.equal(g.size, 6);
    });

    it('should removeEdge (hero→slideshow) and make slideshow subtree a new tree', function () {
      g.removeEdge('hero', 'slideshow');
      assert.equal(g.getParent('slideshow'), null);
      assert.equal(g.getParent('img1'), 'slideshow');
      assert.equal(g.getRoot('img1'), 'slideshow');
      const roots = g.getRoots();
      assert.equal(roots.length, 3);
      assert.ok(roots.includes('hero'));
      assert.ok(roots.includes('slideshow'));
      assert.ok(roots.includes('layout'));
    });

    it('should read metadata via getMeta', function () {
      assert.deepEqual(g.getMeta('hero'), {
        type: 'hero',
        areaId: 'main'
      });
      assert.deepEqual(g.getMeta('img1'), {
        type: 'image',
        areaId: 'slides'
      });
      assert.deepEqual(g.getMeta('badge'), {
        type: 'badge',
        areaId: 'card-footer'
      });
    });
  });

  describe('edge cases', function () {
    it('should handle a single isolated node', function () {
      const g = new DirectedGraph();
      g.addNode('solo');
      assert.equal(g.getParent('solo'), null);
      assert.deepEqual(g.getChildren('solo'), []);
      assert.deepEqual(g.getAncestors('solo'), []);
      assert.deepEqual(g.getDescendants('solo'), []);
      assert.equal(g.getRoot('solo'), 'solo');
      assert.equal(g.getDepth('solo'), 0);
    });

    it('should handle a long chain (depth stress)', function () {
      const g = new DirectedGraph();
      const depth = 1000;
      for (let i = 0; i < depth; i++) {
        g.addEdge(`n${i}`, `n${i + 1}`);
      }
      assert.equal(g.size, depth + 1);
      assert.equal(g.getDepth(`n${depth}`), depth);
      assert.equal(g.getRoot(`n${depth}`), 'n0');
      assert.equal(g.hasAncestor(`n${depth}`, 'n0'), true);
      assert.equal(g.hasDescendant('n0', `n${depth}`), true);
      assert.equal(g.getAncestors(`n${depth}`).length, depth);
    });

    it('should handle a wide tree (many children)', function () {
      const g = new DirectedGraph();
      const width = 500;
      for (let i = 0; i < width; i++) {
        g.addEdge('root', `c${i}`);
      }
      assert.equal(g.size, width + 1);
      assert.equal(g.getChildren('root').length, width);
      assert.deepEqual(g.getLeaves().length, width);
    });

    it('should handle removeNode on the only node', function () {
      const g = new DirectedGraph();
      g.addNode('only');
      g.removeNode('only');
      assert.equal(g.size, 0);
    });

    it('should handle re-adding a node after removal', function () {
      const g = new DirectedGraph();
      g.addNode('a', { type: 'x' });
      g.addEdge('root', 'a');
      g.removeNode('a');
      g.addNode('a', { type: 'y' });
      assert.equal(g.hasNode('a'), true);
      assert.deepEqual(g.getMeta('a'), { type: 'y' });
      assert.equal(g.getParent('a'), null);
    });

    it('should handle re-adding an edge after removeEdge', function () {
      const g = new DirectedGraph();
      g.addEdge('p', 'c');
      g.removeEdge('p', 'c');
      g.addEdge('p', 'c');
      assert.equal(g.hasEdge('p', 'c'), true);
      assert.equal(g.getParent('c'), 'p');
    });

    it('should allow moving a child to a new parent via removeEdge + addEdge', function () {
      const g = new DirectedGraph();
      g.addEdge('p1', 'c');
      g.addEdge('p2', 'other');
      g.removeEdge('p1', 'c');
      g.addEdge('p2', 'c');
      assert.equal(g.getParent('c'), 'p2');
      assert.deepEqual(g.getChildren('p1'), []);
      assert.ok(g.getChildren('p2').includes('c'));
    });

    it('should handle empty string as node id', function () {
      const g = new DirectedGraph();
      g.addNode('', { type: 'empty-id' });
      assert.equal(g.hasNode(''), true);
      assert.deepEqual(g.getMeta(''), { type: 'empty-id' });
    });

    it('should handle numeric-looking string ids', function () {
      const g = new DirectedGraph();
      g.addEdge('123', '456');
      assert.equal(g.getParent('456'), '123');
    });
  });
});
