<template>
  <div
    class="apos-table__cell-field" :class="classes"
  >
    <AposContextMenu
      class="apos-admin-bar__sub"
      :menu="header.menu"
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
  name: 'AposCellMenu',
  props: {
    state: {
      type: Object,
      required: true
    },
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
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
      const classes = [ `apos-table__cell-field--${this.header.name}` ];
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
