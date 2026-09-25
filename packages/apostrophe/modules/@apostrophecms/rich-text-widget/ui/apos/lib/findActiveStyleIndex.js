// When several configured styles share the same tag (e.g. a plain `<p>` and a
// `<p class="small">`), the most specific one (the one with more classes) is the
// one that applies. Nodes are matched in order of descending class count and the
// result is resolved back to the original index, so the dropdown highlights the
// correct option while keeping the configured order.

export default function findActiveStyleIndex(nodes, activeEl) {
  const sortedNodes = [ ...nodes ].sort((a, b) => {
    const aCount = a.class ? a.class.trim().split(/\s+/).length : 0;
    const bCount = b.class ? b.class.trim().split(/\s+/).length : 0;
    return bCount - aCount;
  });
  const matchedNode = sortedNodes.find(node =>
    node.class === activeEl.class &&
    node.type === activeEl.name &&
    node.level === activeEl.level
  );
  return nodes.indexOf(matchedNode);
}
