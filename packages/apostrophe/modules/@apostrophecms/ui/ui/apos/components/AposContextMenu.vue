<template>
  <!-- onTab only triggered when not teleported -->
  <section
    ref="contextMenuRef"
    class="apos-context-menu"
    @keydown.tab="onTab"
  >
    <slot name="prebutton" />
    <div
      ref="dropdown"
      class="apos-popover__btn apos-context-menu__dropdown"
    >
      <slot
        v-if="slots.button"
        name="button"
        :on-click="buttonClicked"
      />
      <AposButton
        v-else
        v-bind="button"
        ref="dropdownButton"
        class="apos-context-menu__btn"
        role="button"
        :data-apos-test="identifier"
        :state="buttonState"
        :disabled="disabled"
        :tooltip="btnTooltip"
        :attrs="{
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen ? true : false
        }"
        @icon="setIconToCenterTo"
        @click.stop="buttonClicked($event)"
      />
      <!-- Regular dropdown (default behavior) -->
      <div
        v-if="isOpen && !teleportContent"
        v-bind="menuAttrs"
        ref="dropdownContent"
        v-click-outside-element="hide"
        :style="dropdownContentStyle"
        class="apos-context-menu__dropdown-content"
        :class="popoverClass"
      >
        <AposContextMenuDialog
          :menu-placement="placement"
          :class-list="classList"
          :menu="menu"
          :active-item="activeItem"
          :is-open="isOpen"
          :has-tip="hasTip"
          @item-clicked="menuItemClicked"
          @set-arrow="setArrow"
        >
          <slot :close="hide" />
        </AposContextMenuDialog>
      </div>

      <!-- Teleported dropdown (solves complex z-index situations) -->
      <Teleport
        v-if="isOpen && teleportContent"
        to="body"
      >
        <div
          v-bind="menuAttrs"
          ref="dropdownContent"
          v-click-outside-element="hide"
          :style="teleportedStyle"
          :class="[
            'apos-context-menu__dropdown-content',
            'apos-context-menu__dropdown-content--teleported',
            ...popoverClass
          ]"
          @keydown.tab="onTab"
          @keydown.esc="handleKeyboard"
        >
          <AposContextMenuDialog
            :menu-placement="placement"
            :class-list="classList"
            :menu="menu"
            :active-item="activeItem"
            :is-open="isOpen"
            :has-tip="hasTip"
            @item-clicked="menuItemClicked"
            @set-arrow="setArrow"
          >
            <slot :close="hide" />
          </AposContextMenuDialog>
        </div>
      </Teleport>
    </div>
  </section>
</template>

<script setup>
import {
  ref, computed, onMounted, onBeforeUnmount, nextTick, useSlots, watch
} from 'vue';
import {
  computePosition, offset, shift, flip, arrow
} from '@floating-ui/dom';
import { createId } from '@paralleldrive/cuid2';

import { useAposTheme } from '../composables/AposTheme.js';
import { useFocusTrap } from '../composables/AposFocusTrap.js';

const props = defineProps({
  richTextMenu: {
    type: Boolean,
    default: false
  },
  identifier: {
    type: String,
    default: 'contextMenuTrigger'
  },
  menu: {
    type: Array,
    default: null
  },
  unpadded: {
    type: Boolean,
    default: false
  },
  modifiers: {
    type: Array,
    default() {
      return [];
    }
  },
  button: {
    type: Object,
    default() {
      return {
        label: 'Context Menu Label',
        iconOnly: true,
        icon: 'label-icon',
        type: 'outline'
      };
    }
  },
  menuPlacement: {
    type: String,
    default: 'bottom'
  },
  menuOffset: {
    type: [ Number, Array ],
    default: 15
  },
  disabled: {
    type: Boolean,
    default: false
  },
  tooltip: {
    type: [ String, Boolean, Object ],
    default: false
  },
  popoverModifiers: {
    type: Array,
    default() {
      return [];
    }
  },
  menuId: {
    type: String,
    default() {
      return createId();
    }
  },
  activeItem: {
    type: String,
    default: null
  },
  trapFocus: {
    type: Boolean,
    default: true
  },
  // When set to true, the elements to focus on will be re-queried
  // on everu Tab key press. Use this with caution, as it's a performance
  // hit. Only use this if you have a context menu with
  // dynamically changing (e.g. AposToggle item enables another item) items.
  dynamicFocus: {
    type: Boolean,
    default: false
  },
  // Tell the context menu to center the tip on the button icon
  // and not the the entire button
  centerOnIcon: {
    type: Boolean,
    default: false
  },
  // Can pass an element ref center the menu tip on this element
  // allows to perform the same thing than centerOnIcon when the button
  // is rendered through a slot
  centerTipEl: {
    type: Object,
    default: null
  },
  hasTip: {
    type: Boolean,
    default: true
  },
  // When true, teleports dropdown content to `body`
  teleportContent: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([ 'open', 'close', 'item-clicked' ]);
const slots = useSlots();

const isOpen = ref(false);
const isRendered = ref(false);
const placement = ref(props.menuPlacement);
/** @type {import('vue').Ref<HTMLElement | null>}} */
const contextMenuRef = ref(null);
/** @type {import('vue').Ref<HTMLElement | null>}} */
const dropdown = ref(null);
/** @type {import('vue').Ref<import('vue').ComponentPublicInstance | null>} */
const dropdownButton = ref(null);
/** @type {import('vue').Ref<HTMLElement | null>} */
const dropdownContent = ref(null);
const dropdownContentStyle = ref({});
const arrowEl = ref(null);
const iconToCenterTo = ref(null);
const mOffset = getMenuOffset();
const otherMenuOpened = ref(false);
const positionUpdateScheduled = ref(false);

const {
  onTab, runTrap, hasRunningTrap, resetTrap
} = useFocusTrap({
  withPriority: true,
  refreshOnCycle: props.dynamicFocus
  // If enabled, the dropdown gets closed when the focus leaves
  // the context menu.
  // triggerRef: dropdownButton,
  // onExit: hide
});

const menuResizeObserver = new ResizeObserver((entries) => {
  for (const _entry of entries) {
    setDropdownPosition();
  }
});

defineExpose({
  hide,
  show,
  setDropdownPosition
});

const popoverClass = computed(() => {
  const classes = [ 'apos-popover' ].concat(themeClass.value);
  props.popoverModifiers.forEach(m => {
    classes.push(`apos-popover--${m}`);
  });
  return classes;
});

const classList = computed(() => {
  const classes = [];
  const baseClass = 'apos-context-menu__popup';
  classes.push(`${baseClass}--tip-alignment-${props.menuPlacement}`);
  if (props.modifiers) {
    props.modifiers.forEach((m) => {
      classes.push(`${baseClass}--${m}`);
    });
  }
  if (props.menu || props.unpadded) {
    classes.push(`${baseClass}--unpadded`);
  }
  return classes.join(' ');
});

const buttonState = computed(() => {
  return isOpen.value ? [ 'active' ] : null;
});

const btnTooltip = computed(() => {
  return props.tooltip || props.button?.tooltip || false;
});

const menuAttrs = computed(() => {
  return {
    'data-apos-test': isRendered.value ? 'context-menu-content' : null,
    ...!props.richTextMenu && { 'data-apos-menu': '' },
    'aria-hidden': !isOpen.value
  };
});

const teleportedStyle = computed(() => {
  // For teleported content, we need to ensure positioning is always fresh
  // The positioning is already calculated correctly by setDropdownPosition
  return {
    ...dropdownContentStyle.value,
    zIndex: '2003' // $z-index-notifications from SCSS
  };
});

const { themeClass } = useAposTheme();

onMounted(() => {
  apos.bus.$on('context-menu-toggled', hideWhenOtherOpen);
  apos.bus.$on('close-context-menus', hideContextMenu);
});

onBeforeUnmount(() => {
  apos.bus.$off('context-menu-toggled', hideWhenOtherOpen);
  apos.bus.$off('close-context-menus', hideContextMenu);
  if (positionUpdateScheduled.value) {
    cancelAnimationFrame(positionUpdateScheduled.value);
  }
});

function getMenuOffset() {
  return {
    mainAxis: Array.isArray(props.menuOffset) ? props.menuOffset[0] : props.menuOffset,
    crossAxis: Array.isArray(props.menuOffset) ? (props.menuOffset[1] ?? 0) : 0
  };
}

function hideWhenOtherOpen({ menuId }) {
  if (props.menuId !== menuId) {
    otherMenuOpened.value = true;
    hide();
  }
}

function setIconToCenterTo(el) {
  if (el && (props.centerOnIcon || props.centerTipEl)) {
    iconToCenterTo.value = el;
  }
}

function hideContextMenu(type = 'contextMenu') {
  if (type === 'richText' && props.richTextMenu) {
    hide();
  }
  if (type === 'contextMenu' && !props.richTextMenu) {
    hide();
  }
}

async function hide(e) {
  if (!isOpen.value) {
    return;
  }
  if (dropdownContent.value) {
    menuResizeObserver.unobserve(dropdownContent.value);
  }
  isOpen.value = false;
  // Clear any scheduled position updates
  positionUpdateScheduled.value = false;
  await nextTick();
  emit('close', e);
  if (props.trapFocus) {
    resetTrap();
  }

  const positionHandler = props.teleportContent
    ? throttledPositionUpdate
    : setDropdownPosition;

  window.removeEventListener('resize', positionHandler);
  window.removeEventListener('scroll', positionHandler);
  // Remove document scroll listener for teleported content
  if (props.teleportContent) {
    document.removeEventListener('scroll', positionHandler, true);
  }
  contextMenuRef.value?.addEventListener('keydown', handleKeyboard);
  if (!otherMenuOpened.value && !props.trapFocus) {
    dropdown.value.querySelector('[tabindex]').focus();
  }
}

async function show(e) {
  if (isOpen.value) {
    return;
  }
  isOpen.value = true;
  await nextTick();
  emit('open', e);
  setDropdownPosition();
  menuResizeObserver.observe(dropdownContent.value);

  const positionHandler = props.teleportContent
    ? throttledPositionUpdate
    : setDropdownPosition;

  window.addEventListener('resize', positionHandler);
  // For teleported content, also listen to scroll events on all scrollable ancestors
  if (props.teleportContent) {
    document.addEventListener('scroll', positionHandler, true);
  } else {
    window.addEventListener('scroll', positionHandler);
  }
  contextMenuRef.value?.addEventListener('keydown', handleKeyboard);
  // Focus trap is now handled by watcher
  if (!props.trapFocus) {
    dropdownContent.value.querySelector('[tabindex]')?.focus();
  }
  isRendered.value = true;
  if (props.centerTipEl) {
    setIconToCenterTo(props.centerTipEl.$el);
  }
}
// Watch for dropdownContent changes and isOpen, re-run trap if needed
watch([
  () => dropdownContent.value,
  () => isOpen.value
], async ([ content, open ]) => {
  if (props.trapFocus && open && content && !hasRunningTrap.value) {
    await runTrap(dropdownContent);
  }
  if ((!open || !content) && hasRunningTrap.value) {
    resetTrap();
  }
});

// Throttled position update function for better performance
// Ensures only one position update is scheduled per frame
function throttledPositionUpdate() {
  if (!isOpen.value || positionUpdateScheduled.value) {
    return;
  }
  positionUpdateScheduled.value = true;
  requestAnimationFrame(() => {
    positionUpdateScheduled.value = false;
    if (isOpen.value) {
      setDropdownPosition();
    }
  });
}

function buttonClicked(e) {
  if (isOpen.value) {
    hide(e);
  } else {
    show(e);
  }
  otherMenuOpened.value = false;
  apos.bus.$emit('context-menu-toggled', {
    menuId: props.menuId,
    isOpen: isOpen.value
  });
}

function setArrow(el) {
  arrowEl.value = el;
}

function menuItemClicked(item) {
  emit('item-clicked', item);
  hide();
}

async function setDropdownPosition() {
  if (!dropdown.value || !dropdownContent.value) {
    return;
  }
  const centerArrowEl = iconToCenterTo.value || dropdown.value;
  // The proper ordering as recommended by Floating UI
  // https://floating-ui.com/docs/flip#combining-with-shift
  const middleware = [ offset(mOffset) ];
  const flipMiddleware = flip({
    // Always fallback to bottom when there is no placement
    // that fits the viewport.
    fallbackPlacements: [ 'bottom' ],
    // Pass detectOverflow options to modify
    // the clipping boundaries with our Admin UI top bar/Modal header
    // in mind
    padding: {
      top: (window.apos.adminBar?.height || 0) + 10
    }
  });
  const shiftMiddleware = shift({ padding: 5 });
  if (props.menuPlacement.includes('-')) {
    middleware.push(flipMiddleware, shiftMiddleware);
  } else {
    middleware.push(shiftMiddleware, flipMiddleware);
  }
  middleware.push(arrow({
    element: arrowEl.value,
    padding: 5
  }));
  const {
    x, y, middlewareData, placement: dropdownPlacement
  } = await computePosition(centerArrowEl, dropdownContent.value, {
    placement: props.menuPlacement,
    middleware
  });

  placement.value = dropdownPlacement;
  dropdownContentStyle.value = {
    left: `${x}px`,
    top: `${y}px`
  };

  if (!arrowEl.value) {
    return;
  }

  const { x: arrowX, y: arrowY } = middlewareData.arrow;
  Object.assign(arrowEl.value.style, {
    ...arrowX && { left: `${arrowX}px` },
    ...arrowY && { top: `${arrowY}px` }
  });
}

const ignoreInputTypes = [
  'text',
  'password',
  'email',
  'file',
  'number',
  'search',
  'tel',
  'url',
  'date',
  'time',
  'datetime-local',
  'month',
  'search',
  'week'
];

/**
 * @param {KeyboardEvent} event
 */
function handleKeyboard(event) {
  if (event.key !== 'Escape' || !isOpen.value) {
    return;
  }
  /** @type {HTMLElement} */
  const target = event.target;

  // If inside of an input or textarea, don't close the dropdown
  // and don't allow other event listeners to close it either (e.g. modals)
  if (
    target?.nodeName?.toLowerCase() === 'textarea' ||
    (target?.nodeName?.toLowerCase() === 'input' &&
      ignoreInputTypes.includes(target.getAttribute('type'))
    )
  ) {
    event.stopImmediatePropagation();
    return;
  }

  dropdownButton.value?.focus
    ? dropdownButton.value.focus()
    : dropdownButton.value?.$el?.focus();

  event.stopImmediatePropagation();
  hide();
}
</script>

<style lang="scss">
.apos-context-menu__dropdown-content {
  z-index: $z-index-notifications;
  position: absolute;
  line-height: var(--a-line-base);
  width: max-content;

  &[aria-hidden='true'] {
    visibility: hidden;
    opacity: 0;
  }

  &[aria-hidden='false'] {
    visibility: visible;
    opacity: 1;
  }

  &--teleported {
    z-index: $z-index-notifications;

    /* Keep position: absolute (inherited) so it positions relative to the document */
  }
}

.apos-context-menu__popup--unpadded .apos-context-menu__pane  {
  padding: 0;
}

.apos-context-menu__popup--tb-padded .apos-context-menu__pane{
  padding-top: $spacing-double;
  padding-bottom: $spacing-double;
}

.apos-context-menu__popup {
  display: inline-block;
  color: var(--a-text-primary);
  transition: scale 200ms ease, translatey 200ms ease;
}

.apos-context-menu__inner {
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  background-color: var(--a-background-primary);
  border: 1px solid var(--a-base-8);
}

.apos-context-menu__pane {
  @include type-base;

  & {
    padding: $spacing-half 0;
    border: 1px solid var(--a-base-9);
    border-radius: var(--a-border-radius-large);
    font-size: var(--a-type-menu);
    box-shadow: var(--a-box-shadow);
    background-color: var(--a-background-primary);
  }

  &:focus {
    outline: none;
  }
}

.apos-context-menu__items {
  @include apos-list-reset();

  & {
    display: inline-block;
    list-style-type: none;
    width: max-content;
    margin-block: 0;
    margin: $spacing-half 0;
  }
}
</style>
