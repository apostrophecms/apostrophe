import {
  nextTick, ref, watch
} from 'vue';
import scroll from '../utils/scroll.js';

/**
 * The change navigator: a position in the groups of the change list, moved
 * by its Previous and Next buttons or by a click on a group's header. A
 * step scrolls the group's header to the top of the list. `position` is
 * -1 until a group is selected; `previousButton` and `nextButton` are the
 * template refs of the two buttons.
 *
 * @param {object} options
 * @param {import('vue').Ref<object[]>} options.groups
 *   The groups the filter shows
 * @param {import('vue').Ref<HTMLElement|null>} options.list
 *   The element that scrolls the groups
 * @param {(group: object|null) => void} options.onNavigate
 *   Called with the group a step selected, or `null` when the selection
 *   is gone
 */
export function useDocVersionNavigator({
  groups, list, onNavigate
}) {
  // The index into the groups, -1 until a step selects one
  const position = ref(-1);
  const previousButton = ref(null);
  const nextButton = ref(null);
  const groupEls = new Map();

  function setGroupEl(key, el) {
    if (el) {
      groupEls.set(key, el);
    } else {
      groupEls.delete(key);
    }
  }

  function getGroupEl(key) {
    return groupEls.get(key) || null;
  }

  // The filter changes the groups: the current group keeps its place while
  // it shows, otherwise the selection is gone
  watch(groups, (current, previous) => {
    if (position.value < 0) {
      return;
    }
    const key = previous?.[position.value]?.key;
    const index = key ? current.findIndex(group => group.key === key) : -1;
    if (index !== -1) {
      position.value = index;
      return;
    }
    reset();
  });

  function reset() {
    position.value = -1;
    onNavigate(null);
  }

  // Makes a group the navigator's, as a click on its header does
  function select(index) {
    position.value = index;
    onNavigate(groups.value[index]);
  }

  async function step(delta) {
    const group = groups.value[position.value + delta];
    if (!group) {
      return;
    }
    select(position.value + delta);
    scrollToGroup(group);
    // The button disabled at the end drops focus: hand it to the other one
    const atEnd = delta > 0
      ? position.value === groups.value.length - 1
      : position.value <= 0;
    if (atEnd) {
      await nextTick();
      const other = delta > 0 ? previousButton : nextButton;
      other.value?.$el.querySelector('button')?.focus();
    }
  }

  // The group's header at the top of the list
  function scrollToGroup(group) {
    const section = groupEls.get(group.key);
    if (section && list.value) {
      list.value.scrollBy({
        top: section.getBoundingClientRect().top - list.value.getBoundingClientRect().top,
        behavior: scroll.getScrollBehavior()
      });
    }
  }

  return {
    position,
    previousButton,
    nextButton,
    setGroupEl,
    getGroupEl,
    reset,
    select,
    step,
    scrollToGroup
  };
}
