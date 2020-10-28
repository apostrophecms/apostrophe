<template>
  <div class="apos-tag">
    <button @click="click" class="apos-tag__button">
      <close-icon
        class="apos-tag__remove" title="Remove Tag"
        :size="10"
      />
    </button>
    {{ label }}
  </div>
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    }
  },
  emits: ['click'],
  methods: {
    click() {
      this.$emit('click', this.slug);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-tag {
  @include typeBase;
  display: inline-flex;
  padding: 6px 12px;
  border-radius: var(--a-border-radius);
  background-color: var(--a-base-1);
  color: var(--a-base-8);
  align-items: center;
  justify-content: center;
}

.apos-tag__remove {
  position: relative;
  top: 1px;
  margin-right: 5px;
  &:hover {
    cursor: pointer;
  }
}

.apos-tag__button {
  @include apos-button-reset();
}

.apos-tags {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.apos-tags .apos-tag {
  margin-right: 1rem;
}
</style>
