<template>
  <div class="apos-context-menu">
    <slot name="prebutton" />
    <div
      ref="dropdown"
      class="apos-popover__btn apos-context-menu__dropdown"
    >
      <AposButton
        v-bind="button"
        ref="button"
        class="apos-context-menu__btn"
        role="button"
        :data-apos-test="identifier"
        :state="buttonState"
        :disabled="disabled"
        :tooltip="tooltip"
        :attrs="{
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen ? true : false
        }"
        @click.stop="buttonClicked($event)"
      />
      <div
        v-if="isOpen"
        ref="dropdownContent"
        v-click-outside-element="hide"
        class="apos-context-menu__dropdown-content"
        :class="popoverClass"
        data-apos-menu
        :style="dropdownContentStyle"
        :aria-hidden="!isOpen"
      >
        <AposContextMenuDialog
          :menu-placement="placement"
          :class-list="classList"
          :menu="menu"
          :is-open="isOpen"
          @item-clicked="menuItemClicked"
          @set-arrow="setArrow"
        >
          <slot />
        </AposContextMenuDialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref, computed, watch, onMounted, onBeforeUnmount
} from 'vue';
import {
  computePosition, offset, shift, flip, arrow
} from '@floating-ui/dom';
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme';
import { createId } from '@paralleldrive/cuid2';

const props = defineProps({
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
    type: [ String, Boolean ],
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
  }
});

const emit = defineEmits([ 'open', 'close', 'item-clicked' ]);

const isOpen = ref(false);
const placement = ref(props.menuPlacement);
const event = ref(null);
const dropdown = ref();
const dropdownContent = ref();
const dropdownContentStyle = ref({});
const arrowEl = ref();
const menuOffset = getMenuOffset();

defineExpose({
  hide,
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

watch(isOpen, (newVal) => {
  emit(newVal ? 'open' : 'close', event.value);
  if (newVal) {
    window.addEventListener('resize', setDropdownPosition);
    window.addEventListener('scroll', setDropdownPosition);
    window.addEventListener('keydown', handleKeyboard);
    setDropdownPosition();
    dropdownContent.value.querySelector('[tabindex]')?.focus();
  } else {
    window.removeEventListener('resize', setDropdownPosition);
    window.removeEventListener('scroll', setDropdownPosition);
    window.removeEventListener('keydown', handleKeyboard);
    dropdown.value.querySelector('[tabindex]').focus();
  }
}, { flush: 'post' });

const { themeClass } = useAposTheme();

onMounted(() => {
  apos.bus.$on('context-menu-toggled', hideWhenOtherOpen);
  apos.bus.$on('close-context-menus', hide);
});

onBeforeUnmount(() => {
  apos.bus.$off('context-menu-toggled', hideWhenOtherOpen);
  apos.bus.$off('close-context-menus', hide);
});

function getMenuOffset() {
  return {
    mainAxis: Array.isArray(props.menuOffset) ? props.menuOffset[0] : props.menuOffset,
    crossAxis: Array.isArray(props.menuOffset) ? (props.menuOffset[1] ?? 0) : 0
  };
}

function hideWhenOtherOpen({ menuId }) {
  if (props.menuId !== menuId) {
    hide();
  }
}

function hide() {
  isOpen.value = false;
}

function buttonClicked(e) {
  isOpen.value = !isOpen.value;
  apos.bus.$emit('context-menu-toggled', {
    menuId: props.menuId,
    isOpen: isOpen.value
  });
  event.value = e;
}

function setArrow(el) {
  arrowEl.value = el;
}

function menuItemClicked(name) {
  emit('item-clicked', name);
  hide();
}

async function setDropdownPosition() {
  if (!dropdown.value || !dropdownContent.value) {
    return;
  }
  const {
    x, y, middlewareData, placement: dropdownPlacement
  } = await computePosition(dropdown.value, dropdownContent.value, {
    placement: props.menuPlacement,
    middleware: [
      offset(menuOffset),
      shift({ padding: 5 }),
      flip(),
      arrow({
        element: arrowEl.value,
        padding: 5
      })
    ]
  });

  placement.value = dropdownPlacement;
  dropdownContentStyle.value = {
    left: `${x}px`,
    top: `${y}px`
  };

  const { x: arrowX, y: arrowY } = middlewareData.arrow;
  Object.assign(arrowEl.value.style, {
    ...arrowX && { left: `${arrowX}px` },
    ...arrowY && { top: `${arrowY}px` }
  });
}

function handleKeyboard(event) {
  if (event.key === 'Escape') {
    hide();
  }
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
}

.apos-context-menu__popup--unpadded .apos-context-menu__pane  {
  padding: 0;
}

.apos-context-menu__popup--tb-padded .apos-context-menu__pane{
  padding-top: 20px;
  padding-bottom: 20px;
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

  padding: 20px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  background-color: var(--a-background-primary);

  &:focus {
    outline: none;
  }
}

.apos-context-menu__items {
  @include apos-list-reset();

  display: inline-block;
  list-style-type: none;
  width: max-content;
  margin: none;
  margin-block: 0;
  padding: 10px 0;
}
</style>
