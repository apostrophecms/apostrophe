<template>
  <div class="apos-widget-controls apos-widget-modify">
    <AposButtonGroup>
      <AposButton
        v-bind="removeButton"
        @click="remove"
      />
      <AposButton
        v-bind="editButton"
        @click="edit"
      />
    </AposButtonGroup>
  </div>
</template>

<script>

export default {
  props: {
  },
  emits: [ 'edit', 'remove' ],
  data() {
    return {
      buttonDefaults: {
        type: 'group',
        modifiers: [ 'small' ],
        role: 'menuitem'
      }
    };
  },
  computed: {
    removeButton() {
      return {
        ...this.buttonDefaults,
        icon: 'delete-icon',
        label: 'Delete Widget',
        iconOnly: true
      };
    },
    editButton() {
      return {
        ...this.buttonDefaults,
        label: 'Edit'
      };
    }
  },
  methods: {
    edit() {
      this.$emit('edit');
    },
    remove() {
      this.$emit('remove');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-widget-modify {
    // TODO position with this
  }
</style>
