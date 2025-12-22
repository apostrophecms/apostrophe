const {
  Root, Rule, AtRule, Decl
} = require('./ast');

const parse = (css) => {
  const root = new Root();
  let current = root;
  const stack = [ root ];

  let buffer = '';
  let inString = false;
  let stringChar = '';
  let depth = 0; // Parenthesis depth

  // Remove comments first
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const processDecl = (content, parent) => {
    const colonIndex = content.indexOf(':');
    if (colonIndex !== -1) {
      const prop = content.substring(0, colonIndex).trim();
      const value = content.substring(colonIndex + 1).trim();
      parent.append(new Decl({
        prop,
        value
      }));
    }
  };

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (inString) {
      buffer += char;
      if (char === stringChar && css[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringChar = char;
      buffer += char;
      continue;
    }

    if (char === '(') {
      depth++;
      buffer += char;
      continue;
    }
    if (char === ')') {
      depth--;
      buffer += char;
      continue;
    }

    if (depth > 0) {
      buffer += char;
      continue;
    }

    if (char === '{') {
      const selector = buffer.trim();
      buffer = '';

      let node;
      if (selector.startsWith('@')) {
        const match = selector.match(/^@([^\s]+)\s*(.*)$/);
        const name = match ? match[1] : selector.substring(1);
        const params = match ? match[2] : '';
        node = new AtRule({
          name,
          params
        });
      } else {
        node = new Rule({ selector });
      }

      current.append(node);
      current = node;
      stack.push(current);
    } else if (char === '}') {
      if (buffer.trim()) {
        processDecl(buffer, current);
      }
      buffer = '';
      stack.pop();
      current = stack[stack.length - 1];
    } else if (char === ';') {
      const content = buffer.trim();
      if (content) {
        if (content.startsWith('@')) {
          const match = content.match(/^@([^\s]+)\s*(.*)$/);
          const name = match ? match[1] : content.substring(1);
          const params = match ? match[2] : '';
          const node = new AtRule({
            name,
            params
          });
          current.append(node);
        } else {
          processDecl(content, current);
        }
      }
      buffer = '';
    } else {
      buffer += char;
    }
  }

  return root;
};

module.exports = parse;
