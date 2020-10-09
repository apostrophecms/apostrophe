<template>

</template>

<script>
export default {
  name: 'AposArrayItems',
  props: {
    items: {
      type: Array,
      required: true
    },
    currentId: {
      type: String,
      default: null
    },
    field: {
      type: Object,
      required: true
    },
    minError: {
      type: Boolean,
      default: false
    },
    maxError: {
      type: Boolean,
      default: false
    },
    itemError: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'select', 'remove', 'up', 'down', 'add' ],
  computed: {
    maxed() {
      if (this.field.max === undefined) {
        return false;
      }
      return (this.items.length >= this.field.max);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-modal-array-items {
  display: flex;
  height: 100%;
}

.apos-modal-array-items__items {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--a-base-9);
}

.apos-modal-array-items__item {
  display: block;
}

.apos-modal-array-items__btn {
  position: relative;
  width: 100%;
  margin: 0;
  padding: 25px 20px;
  border-width: 0;
  border-bottom: 1px solid var(--a-base-4);
  border-radius: 0;
  color: var(--a-text-primary);
  background-color: var(--a-base-9);
  font-size: map-get($font-sizes, modal);
  letter-spacing: 0.5px;
  text-align: left;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 0;
    background-color: var(--a-primary);
    transition: width 0.25s cubic-bezier(0, 1.61, 1, 1.23);
  }

  &[aria-selected='true'],
  &[aria-selected='true']:hover,
  &[aria-selected='true']:focus {
    background-color: var(--a-background-primary);
    &::before {
      background-color: var(--a-primary);
    }
  }

  &:hover,
  &:focus {
    background-color: var(--a-base-10);
    &::before {
      width: 3px;
      background-color: var(--a-base-5);
    }
  }

  &[aria-selected='true'] {
    &::before {
      width: 6px;
    }
  }
}
</style>
