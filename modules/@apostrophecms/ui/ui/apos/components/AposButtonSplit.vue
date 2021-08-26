<template>
  <div class="apos-button-split" :class="modifiers">
    <AposButton
      class="apos-button-split__button"
      v-bind="button"
      :label="label"
      :disabled="disabled"
      :tooltip="tooltip"
      @click="$emit('click', action)"
    />
    <AposContextMenu
      class="apos-button-split__menu"
      :menu="menu"
      :button="contextMenuButton"
      :disabled="disabled"
      menu-offset="1, 10"
      menu-placement="bottom-end"
      ref="contextMenu"
      @open="focus"
    >
      <dl
        class="apos-button-split__menu__dialog" role="menu"
        :aria-label="menuLabel"
      >
        <button
          v-for="item in menu" :key="item.action"
          class="apos-button-split__menu__dialog-item"
          :class="{ 'apos-is-selected': item.action === action }"
          @click="selectionHandler(item.action)"
          :aria-checked="item.action === action ? 'true' : 'false'"
          role="menuitemradio"
          :value="item.action"
          ref="choices"
        >
          <AposIndicator
            v-if="action === item.action"
            class="apos-button-split__menu__dialog-check"
            icon="check-bold-icon"
            :icon-size="18"
            icon-color="var(--a-primary)"
          />
          <dt class="apos-button-split__menu__dialog-label">
            {{ $t(item.label) }}
          </dt>
          <dd v-if="item.description" class="apos-button-split__menu__dialog-description">
            {{ $t(item.description) }}
          </dd>
        </button>
      </dl>
    </AposContextMenu>
  </div>
</template>

<script>

export default {
  name: 'AposButtonSplit',
  props: {
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
    }
  },
  emits: [ 'click' ],
  data() {
    return {
      label: null,
      action: null,
      button: {
        type: this.type,
        modifiers: [ 'no-motion' ]
      },
      contextMenuButton: {
        iconOnly: true,
        icon: 'chevron-down-icon',
        modifiers: [ 'no-motion' ],
        type: this.type
      }
    };
  },
  computed: {
    modifiers() {
      const classes = [];
      classes.push(`apos-button-split--type-${this.button.type}`);
      return classes;
    }
  },
  watch: {
    menu() {
      this.initialize();
    }
  },
  mounted() {
    this.initialize();
  },
  methods: {
    // sets the label and emitted action of the button
    setButton(action) {
      this.action = action;
      this.label = this.menu.find(i => i.action === action).label;
    },
    selectionHandler(action) {
      this.setButton(action);
      this.$refs.contextMenu.hide();
    },
    initialize() {
      let initial = this.menu[0].action || null;
      if (this.selected && this.menu.find(i => i.action === this.selected)) {
        initial = this.selected;
      } else if (this.menu.find(i => i.def)) {
        initial = this.menu.find(i => i.def).action;
      }
      this.setButton(initial);
    },
    focus() {
      // takes a moment to be on screen and focusable
      setTimeout(() => {
        this.$refs.choices[0].focus();
      }, 200);
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-button-split {
    position: relative;
  }

  .apos-button-split__menu__dialog {
    display: flex;
    flex-direction: column;
    margin: 0;
    min-width: 300px;
  }

  .apos-button-split__menu__dialog-item {
    @include apos-button-reset();
    @include apos-transition();
    padding: $spacing-base + $spacing-half $spacing-double $spacing-base + $spacing-half $spacing-quadruple;
    border-bottom: 1px solid var(--a-base-9);
    &:hover,
    &:focus,
    &:active,
    &.apos-is-selected {
      background-color: var(--a-base-9);
    }
    &:focus,
    &:active {
      outline: 1px solid var(--a-primary);
    }
    &:last-child {
      margin-bottom: 0;
      border-bottom: 0;
    }
  }

  .apos-button-split__menu__dialog-check {
    position: absolute;
    left: $spacing-base;
  }

  .apos-button-split__menu__dialog-label {
    @include type-large;
    margin-bottom: $spacing-half;
  }

  .apos-button-split__menu__dialog-description {
    margin-left: 0;
    color: var(--a-base-2);
    font-size: var(--a-type-base);
  }

  .apos-button-split__button ::v-deep .apos-button {
    padding-right: $spacing-quadruple + $spacing-base;
    margin-top: 0;
    margin-bottom: 0;
  }

  .apos-button-split__menu {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    ::v-deep {
      .v-popover,
      .trigger,
      .apos-button__wrapper {
        height: 100%;
      }
    }
    ::v-deep .apos-button {
      display: flex;
      box-sizing: border-box;
      height: 100%;
      justify-content: center;
      align-items: center;
      margin: 0;
      padding-top: 0;
      padding-bottom: 0;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }
</style>
