<template>
  <span class="apos-command-menu-key" :class="!icon && label.length > 1 ? 'apos-command-menu-key-auto' : ''">
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
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin'; // TODO keep?

export default {
  name: 'AposCommandMenuKey',
  mixins: [ AposThemeMixin ], // TODO keep?
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
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-command-menu-key {
  border: 1px solid rgba(200,199,192, 1);
  background: linear-gradient(180deg, rgba(247, 247, 245, 1) 0%, rgba(235, 235, 232, 1) 100%);
  color: rgba(50,50,50,1);
  font-size: 12px;
  font-weight: 500;
  font-style: normal;
  letter-spacing: 0.43px;
  padding: 3px $spacing-half;
  border-radius: 3px;
  border-color: #C8C7C0;
  border-bottom: 2px solid #C8C7C0;
  box-sizing: border-box;
  width: $spacing-double;
  height: $spacing-double;
  // margin-right: $spacing-base;
  margin-left: $spacing-half;
  // vertical-align: bottom;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.apos-command-menu-key-auto {
    width: auto;
  }
}

</style>
