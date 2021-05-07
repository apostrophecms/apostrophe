<template>
  <div class="apos-button-split" :class="modifiers">
    <AposButton
      v-bind="myButton" :label="label"
      @click="$emit(action)"
      class="apos-button-split__button"
    />
    <AposContextMenu
      class="apos-button-split__menu"
      :menu="menu"
      :button="contextMenuButton"
      @item-clicked="setButton($event)"
      menu-offset="1, 10"
      menu-placement="bottom-end"
    />
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
    button: {
      type: Object,
      default() {
        return {
          label: 'Something here',
          type: 'primary',
          modifiers: [ 'no-motion' ]
        };
      }
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
      myMenu: [ ...this.menu ],
      myButton: { ...this.button },
      contextMenuButton: {
        iconOnly: true,
        icon: 'chevron-down-icon',
        modifiers: [ 'no-motion' ],
        type: this.button.type
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
  mounted() {
    // set the initial button action
    let initial = this.menu[0].action || null;
    if (this.selected) {
      initial = this.selected;
    } else if (this.menu.find(i => i.def)) {
      initial = this.menu.find(i => i.def).action;
    }
    this.setButton(initial);

    this.myButton.modifiers
      ? this.myButton.modifiers.push('no-motion')
      : this.myButton.modifiers = [ 'no-motion' ];
  },
  methods: {
    // sets the label and emitted action of the button
    setButton(action) {
      this.action = action;
      this.label = this.menu.find(i => i.action === action).label;
    },
    click($event) {
      this.$emit('click', $event);
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-button-split {
    position: relative;
  }

  .apos-button-split__button /deep/ .apos-button {
    padding-right: $spacing-quadruple + $spacing-base;
    margin-top: 0;
    margin-bottom: 0;
  }

  .apos-button-split {
    .apos-button-split__menu /deep/ .apos-button {
      color: var(--a-text-primary);
      &:hover,
      &:focus,
      &:active {
        color: var(--a-text-primary);
      }
    }
  }

  .apos-button-split--type-primary {
    .apos-button-split__menu /deep/ .apos-button {
      &:hover,
      &:focus,
      &:active {
        color: var(--a-white);
      }
    }
  }

  .apos-button-split__menu {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    /deep/ {
      .v-popover,
      .trigger,
      .apos-button__wrapper {
        height: 100%;
      }
    }
    /deep/ .apos-button {
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
