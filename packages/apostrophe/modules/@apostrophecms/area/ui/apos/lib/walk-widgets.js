// Walk through an object and invoke the iterator function for every widget found
// within areas. This is a lightweight, performance-optimized version that focuses
// only on finding and iterating over widgets. It uses a stack-based approach
// instead of recursion for better performance with deeply nested structures.
//
// Usage: walkWidgets(obj, (widget) => { ... })
//
// Note: The order in which widgets are visited is not guaranteed. The implementation
// uses a stack-based traversal for performance with deeply nested structures,
// which may process widgets in a different order than they appear in
// the document structure.

/**
 * Walk through an object and invoke the iterator function
 * for every widget found.
 *
 * @param {Object|Object[]} obj
 * @param {(widget: Record<string, any> & { metaType: 'widget' }) => void} iterator
 * @returns void
 */
export default function walkWidgets(obj, iterator) {
  if (!obj || typeof obj !== 'object' || typeof iterator !== 'function') {
    return;
  }

  const stack = [ obj ];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (current.metaType === 'widget') {
      iterator(current);
    }

    if (current.metaType === 'area' && Array.isArray(current.items)) {
      for (let i = 0; i < current.items.length; i++) {
        const widget = current.items[i];
        if (widget && typeof widget === 'object' && widget.metaType === 'widget') {
          stack.push(widget);
        }
      }
      continue;
    }

    const keys = Object.keys(current);
    for (let i = keys.length - 1; i >= 0; i--) {
      const value = current[keys[i]];
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
}
