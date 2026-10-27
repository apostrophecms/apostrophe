// Public build: a dependency only this extension has
import mitt from 'mitt';
export default () => {
  window.PRO10258_MITT = typeof mitt();
};
