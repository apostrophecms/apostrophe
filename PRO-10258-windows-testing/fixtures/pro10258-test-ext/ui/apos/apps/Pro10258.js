// Admin build: an exports-only ESM package only this extension has
import { createNanoEvents } from 'nanoevents';
export default () => {
  window.PRO10258_NANO = typeof createNanoEvents();
};
