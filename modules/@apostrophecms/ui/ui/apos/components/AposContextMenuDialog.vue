<template>
  <div
    class="apos-primary-scrollbar apos-context-menu__dialog"
    :class="classes"
    role="dialog"
  >
    <AposContextMenuTip
      v-if="hasTip"
      class="apos-context-menu__tip"
      :align="tipAlignment"
      :x-placement="placementSide"
      @set-arrow="emitSetArrow"
    />
    <div class="apos-context-menu__pane">
      <slot>
        <ul
          v-if="menu"
          class="apos-context-menu__items"
          role="menu"
        >
          <AposContextMenuItem
            v-for="item in menu"
            :key="item.action"
            :data-apos-test-context-menu-item="item.action"
            :menu-item="item"
            :is-active="item.name === activeItem"
            :open="isOpen"
            @clicked="menuItemClicked"
          />
        </ul>
      </slot>
    </div>
  </div>
</template>

<script setup>
import {
  computed
} from 'vue';

const props = defineProps({
  menuPlacement: {
    type: String,
    required: true
  },
  menu: {
    type: Array,
    default: null
  },
  classList: {
    type: String,
    default: ''
  },
  isOpen: {
    type: Boolean,
    default: false
  },
  modifiers: {
    type: Array,
    default() {
      return [];
    }
  },
  hasTip: {
    type: Boolean,
    default: true
  },
  activeItem: {
    type: String,
    default: null
  }
});

const emit = defineEmits([ 'item-clicked', 'set-arrow' ]);

const menuPositions = computed(() => {
  return props.menuPlacement.split('-');
});

const placementSide = computed(() => {
  return menuPositions.value[0];
});

const tipAlignment = computed(() => {
  return !menuPositions.value[1]
    ? 'center'
    : menuPositions.value[1];
});

const classes = computed(() => {
  const classes = props.classList.split(' ');
  props.modifiers.forEach(c => {
    classes.push(`apos-context-menu__dialog--${c}`);
  });
  return classes.join(' ');
});

function menuItemClicked(action) {
  emit('item-clicked', action);
}

function emitSetArrow(arrowEl) {
  emit('set-arrow', arrowEl);
}
</script>

<style lang="scss">

.apos-context-menu__dialog--unpadded > .apos-context-menu__pane {
  padding: 0;
}

.apos-context-menu__dialog--tb-padded > .apos-context-menu__pane {
  padding-top: 20px;
  padding-bottom: 20px;
}

.apos-context-menu__dialog {
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
    padding: 20px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    box-shadow: var(--a-box-shadow);
    background-color: var(--a-background-primary);
  }
}

.apos-context-menu__items {
  @include apos-list-reset();

  & {
    display: inline-block;
    list-style-type: none;
    width: max-content;
    margin: none;
    margin-block: 0;
    padding: 10px 0;
  }
}

.apos-context-menu__dialog :deep(.apos-schema .apos-field) {
  margin-bottom: 20px;

  .apos-field__help {
    margin-top: 5px;
  }
}

.apos-context-menu__tip[x-placement^='bottom'] {
  top: -10px;
  bottom: auto;
}

.apos-context-menu__tip[x-placement^='top'] {
  top: auto;
  bottom: -10px;
  transform: rotate(180deg);
}
</style>
