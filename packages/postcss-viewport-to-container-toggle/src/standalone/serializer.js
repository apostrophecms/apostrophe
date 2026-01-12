const serialize = (node, indent = '') => {
  if (node.type === 'root') {
    return node.nodes.map(n => serialize(n)).join('\n');
  }
  if (node.type === 'decl') {
    return `${indent}${node.prop}: ${node.value};`;
  }
  if (node.type === 'rule') {
    const children = node.nodes.map(n => serialize(n, indent + '  ')).join('\n');
    return `${indent}${node.selector} {\n${children}\n${indent}}`;
  }
  if (node.type === 'atrule') {
    const params = node.params ? ` ${node.params}` : '';
    if (!node.nodes || node.nodes.length === 0) {
      return `${indent}@${node.name}${params};`;
    }
    const children = node.nodes.map(n => serialize(n, indent + '  ')).join('\n');
    return `${indent}@${node.name}${params} {\n${children}\n${indent}}`;
  }
  return '';
};

module.exports = serialize;
