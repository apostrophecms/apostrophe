// The JSX version of `refreshLayout.html`, used in place of the outer layout
// when only the content area of the page is refreshed.
import { block } from '../lib/jsxLayout.js';

export default function ({ beforeMain, main, afterMain }) {
  return (
    <>
      {block(beforeMain, () => null)}
      {block(main, () => null)}
      {block(afterMain, () => null)}
    </>
  );
}
