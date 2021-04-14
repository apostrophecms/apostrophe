<template>
  <div
    class="apos-table__cell-field apos-table__cell-field--context-menu" :class="classes"
  >
    <AposContextMenu
      class="apos-admin-bar__sub"
      :menu="menu"
      :button="{
        label: 'More Operations',
        modifiers: [ 'no-motion', 'tiny' ],
        iconOnly: true,
        icon: 'dots-vertical-icon',
        type: 'outline'
      }"
      menu-position="bottom-end"
      @item-clicked="handler"
    />
  </div>
</template>

<script>
export default {
  name: 'AposCellContextMenu',
  props: {
    state: {
      type: Object,
      required: true
    },
    menu: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      hidden: true
    };
  },
  computed: {
    classes() {
      const classes = [ ];
      if (this.state.hover) {
        classes.push('is-hovered');
      }
      return classes;
    }
  },
  methods: {
    handler(action) {
      this.$emit(action);
    }
  }
};
</script>

<style lang="scss" scoped>
  // .is-hovered {
  //   border: 3px solid var(--a-danger);
  // }
</style>
