// The navigator's scrolls animate, unless the user asks for less motion
const getScrollBehavior = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
};

export default {
  getScrollBehavior
};
