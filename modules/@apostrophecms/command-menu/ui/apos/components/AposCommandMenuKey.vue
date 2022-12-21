<template>
  <span :class="classes">
    <AposIndicator
      v-if="icon"
      :icon="icon"
      :icon-size="iconSize"
      class="apos-button__icon"
      fill-color="color"
    />
    <slot name="label" v-if="label">
      {{ $t(label ) }}
    </slot>
  </span>
</template>

<script>
export default {
  name: 'AposCommandMenuKey',
  props: {
    label: {
      type: [ String, Object ],
      default: null
    },
    color: {
      type: String,
      default: null
    },
    textColor: {
      type: String,
      default: null
    },
    icon: {
      type: String,
      default: null
    },
    iconSize: {
      type: Number,
      default: 12
    },
    textOnly: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    classes() {
      return [
        this.textOnly ? 'apos-command-menu-text' : 'apos-command-menu-key',
        !this.icon && this.label.length > 1 ? 'apos-command-menu-key-auto' : ''
      ];
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-command-menu-key {
  @include type-small;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: $spacing-double;
  height: $spacing-double;
  padding: 3px $spacing-half;
  margin-left: $spacing-half;
  border: 1px solid var(--a-base-7);
  border-radius: 3px;
  border-color: var(--a-base-7);
  border-bottom: 2px solid var(--a-base-7);
  color: var(--a-base-1);
  background: linear-gradient(180deg, var(--a-base-10) 0%, var(--a-base-9) 100%);
  font-weight: 600;

  &.apos-command-menu-key-auto {
    width: auto;
  }
}

.apos-command-menu-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: auto;
  height: $spacing-double;
  padding: 3px 2px;
  margin-left: $spacing-half;
  @include type-small;
  color: var(--a-base-1);
}

</style>
