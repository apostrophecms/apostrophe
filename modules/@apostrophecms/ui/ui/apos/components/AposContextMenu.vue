<template>
  <div class="apos-context-menu">
    <slot name="prebutton" />
    <div
      ref="dropdown"
      class="apos-context-menu__dropdown"
      :class="popoverClass"
    >
      <AposButton
        v-bind="button"
        ref="button"
        class="apos-context-menu__btn"
        data-apos-test="contextMenuTrigger"
        role="button"
        :state="buttonState"
        :disabled="disabled"
        :tooltip="tooltip"
        :attrs="{
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen ? true : false
        }"
        @click.stop="buttonClicked($event)"
      />
      <Teleport to="body">
        <div
          v-if="isOpen"
          ref="dropdownContent"
          v-click-outside-element="hide"
          class="apos-context-menu__dropdown-content"
          :style="dropdownContentStyle"
          :aria-hidden="!isOpen"
        >
          <AposContextMenuDialog
            :menu-placement="menuPlacement"
            :class-list="classList"
            :menu="menu"
            @item-clicked="menuItemClicked"
          >
            <slot />
          </AposContextMenuDialog>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import {
  ref, computed, watch, nextTick
} from 'vue';
import {
  computePosition, offset, shift
} from '@floating-ui/dom';
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme';

const props = defineProps({
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
    type: [ Number, String ],
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
  }
});

const emit = defineEmits([ 'open', 'close', 'item-clicked' ]);
const isOpen = ref(false);
const position = ref('');
const event = ref(null);
const dropdown = ref();
const dropdownContent = ref();
const dropdownContentStyle = ref({});

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
    nextTick(() => {
      setDropdownPosition();
    });
  }
});

const { themeClass } = useAposTheme();

function hide() {
  isOpen.value = false;
}

function buttonClicked(e) {
  isOpen.value = !isOpen.value;
  event.value = e;
}

function menuItemClicked(name) {
  emit('item-clicked', name);
  hide();
}

async function setDropdownPosition() {
  const {
    x, y
  } = await computePosition(dropdown.value, dropdownContent.value, {
    placement: props.placement,
    middleware: [
      offset(11),
      shift({ padding: 5 })
    ]
  });

  dropdownContentStyle.value = {
    left: `${x}px`,
    top: `${y}px`
  };
}
</script>

<style lang="scss">

/* .apos-context-menu { */
/*   position: relative; */
/* } */

.apos-context-menu__dropdown-content {
  position: absolute;
  z-index: $z-index-notifications;

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
  transition: scale 0.15s ease, translatey 0.15s ease;
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
  margin-block-start: 0;
  margin-block-end: 0;
  padding: 10px 0;
}

.apos-context-menu {
  &:deep(.v-popper__wrapper),
  &:deep(div:not([class])),
  &:deep(.apos-context-menu__dialog),
  &:deep(.v-popover__popper),
  &:deep(.v-popper__inner ){
    &:focus {
      outline: none;
    }
  }
}

.v-popper__popper {
  z-index: $z-index-modal;
  display: block;

  .tooltip-arrow {
    display: none;
  }

  &[x-placement^='top'] {
    margin-bottom: 5px;
  }

  &[x-placement^='bottom'] {
    margin-top: 5px;
  }

  &[x-placement$='end'] {
    margin-right: -15px;
  }

  &[x-placement$='start'] {
    margin-left: -15px;
  }

  &[aria-hidden='true'] {
    visibility: hidden;
    opacity: 0;
  }

  &[aria-hidden='false'] {
    visibility: visible;
    opacity: 1;
  }
}

.v-popper__popper--z-index-in-context {
  z-index: $z-index-widget-focused-controls;
}

</style>
