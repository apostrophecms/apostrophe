<template>
  <div class="apos-button-split">
    <AposButton
      v-bind="button" :label="label"
      @click="$emit(action)"
    />
    <AposContextMenu
      class="apos-button-split__menu"
      :menu="menu"
      :button="contextMenuButton"
      @item-clicked="setButton($event)"
    />
    <!-- Aposbutton here -->
    <!-- dropdown button here -->
      <!-- wrapped in context menu -->
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
          type: 'primary'
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
      contextMenuButton: {
        iconOnly: true,
        icon: 'chevron-down-icon',
        modifiers: [ 'quiet' ]
      }
    };
  },
  computed: {

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

  .apos-button-split__menu {
    position: absolute;
    top: 0;
    right: 0;
  }
</style>
