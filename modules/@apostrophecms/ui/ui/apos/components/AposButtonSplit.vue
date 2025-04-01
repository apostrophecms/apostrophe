<template>
  <div
    class="apos-button-split"
    :class="modifiers"
    :data-apos-test-button-split-type="type"
  >
    <AposButton
      class="apos-button-split__button"
      v-bind="button"
      :label="label"
      :disabled="disabled"
      :tooltip="tooltip"
      data-apos-test-button-split-submit
      @click="emit('click', action)"
    />
    <AposContextMenu
      ref="contextMenu"
      class="apos-button-split__menu"
      :menu="menu"
      :button="contextMenuButton"
      :disabled="disabled"
      menu-placement="bottom-end"
      data-apos-test-button-split-trigger
    >
      <ul
        class="apos-button-split__menu__dialog"
        role="menu"
        :aria-label="menuLabel"
        data-apos-test-button-split-menu
      >
        <li
          v-for="item in menu"
          :key="item.action"
          class="apos-button-split__menu__dialog-item"
          :class="{ 'apos-is-selected': item.action === action }"
          :aria-checked="item.action === action ? 'true' : 'false'"
          :data-apos-test-button-split-item="item.action"
          role="menuitemradio"
        >
          <button
            class="apos-button-split__menu__dialog-button"
            :value="item.action"
            :data-apos-test-button-split-item-trigger="item.action"
            @click="selectionHandler(item.action)"
          >
            <span style="display: none;">
              {{ $t(item.label) }}
            </span>
          </button>
          <AposIndicator
            v-if="action === item.action"
            class="apos-button-split__menu__dialog-check"
            icon="check-bold-icon"
            :icon-size="18"
            icon-color="var(--a-primary)"
          />
          <span class="apos-button-split__menu__dialog-label">
            {{ $t(item.label) }}
          </span>
          <span
            v-if="item.description"
            class="apos-button-split__menu__dialog-description"
          >
            {{ $t(item.description) }}
          </span>
        </li>
      </ul>
    </AposContextMenu>
  </div>
</template>

<script setup>
import {
  ref, computed, watch
} from 'vue';

const props = defineProps({
  menu: {
    type: Array,
    required: true
  },
  menuLabel: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'primary'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  tooltip: {
    type: [ String, Object ],
    default: null
  },
  selected: {
    // corresponds to a menu item action
    type: String,
    default: null
  },
  attrs: {
    type: Object,
    default() {
      return {};
    }
  }
});

const emit = defineEmits([ 'click' ]);

const label = ref(null);
const action = ref(null);
const button = ref({
  type: props.type,
  modifiers: [ 'no-motion' ],
  attrs: props.attrs
});
const contextMenu = ref();
const contextMenuButton = ref({
  iconOnly: true,
  icon: 'chevron-down-icon',
  modifiers: [ 'no-motion' ],
  type: props.type
});

const modifiers = computed(() => {
  const classes = [];
  classes.push(`apos-button-split--type-${button.value.type}`);
  return classes;
});

watch(() => props.menu, () => {
  initialize();
}, { immediate: true });

// sets the label and emitted action of the button
function setButton(btnAction) {
  action.value = btnAction;
  label.value = props.menu.find(i => i.action === btnAction).label;
}

function selectionHandler(btnAction) {
  setButton(btnAction);
  contextMenu.value.hide();
}

function initialize() {
  let initial = props.menu[0].action || null;
  if (props.selected && props.menu.find(i => i.action === props.selected)) {
    initial = props.selected;
  } else if (props.menu.find(i => i.def)) {
    initial = props.menu.find(i => i.def).action;
  }

  setButton(initial);
}

</script>
<style lang="scss" scoped>
  .apos-button-split {
    position: relative;
  }

  .apos-button-split__menu__dialog {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    min-width: 300px;
    list-style: none;
  }

  .apos-button-split__menu__dialog-item {
    @include apos-transition();

    & {
      position: relative;
      padding: $spacing-base + $spacing-half $spacing-double $spacing-base + $spacing-half $spacing-quadruple;
      border-bottom: 1px solid var(--a-base-9);
    }

    &:has(.apos-button-split__menu__dialog-button:hover),
    &:focus-within,
    &:has(.apos-button-split__menu__dialog-button:active),
    &.apos-is-selected {
      background-color: var(--a-base-9);
    }

    &:focus-within,
    &:has(.apos-button-split__menu__dialog-button:active) {
      box-shadow: inset 0 0 0 1px var(--a-primary);
    }

    &:last-child {
      margin-bottom: 0;
      border-bottom: 0;
    }
  }

  .apos-button-split__menu__dialog-button {
    @include apos-button-reset();

    & {
      position: absolute;
      outline: none;
      background: transparent;
      inset: 0;
      cursor: pointer;
    }
  }

  .apos-button-split__menu__dialog-check {
    position: absolute;
    left: $spacing-base;
  }

  .apos-button-split__menu__dialog-label {
    @include type-large;

    & {
      display: block;
      margin-bottom: $spacing-half;
    }
  }

  .apos-button-split__menu__dialog-description {
    margin-left: 0;
    color: var(--a-base-2);
    font-size: var(--a-type-base);
  }

  .apos-button-split__button :deep(.apos-button) {
    margin-top: 0;
    margin-bottom: 0;
    padding-right: $spacing-quadruple + $spacing-base;
  }

  .apos-button-split__menu {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;

    :deep(.apos-popover__btn),
    :deep(.trigger),
    :deep(.apos-button__wrapper) {
      height: 100%;
    }

    :deep(.apos-button) {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      height: 100%;
      margin: 0;
      padding-top: 0;
      padding-bottom: 0;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }
</style>
