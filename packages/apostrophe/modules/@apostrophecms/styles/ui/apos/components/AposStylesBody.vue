<template>
  <div
    class="apos-styles-body"
    :class="{'apos-styles-body--root': !currentPath.length}"
    @mousedown.stop=""
  >
    <h3
      v-if="currentPath.length"
      class="apos-styles-body__title"
    >
      {{ $t(current.label) }}
    </h3>
    <div
      v-if="current.fields?.length"
      class="apos-styles-body__fields"
      :data-test-group="currentGroupName"
    >
      <AposSchema
        :model-value="fieldValue"
        :schema="current.schema"
        :modifiers="[ 'micro' ]"
        :field-modifiers="{ select: ['micro'], range: ['micro'] }"
        :display-options="{ helpTooltip: true }"
        @update:model-value="emit('update-data', $event)"
      />
    </div>

    <div
      v-for="(group, groupName) in current.inlineGroup"
      :key="group.label"
      class="apos-styles-body__inline-group"
    >
      <h4 class="apos-styles-body__inline-label">
        {{ $t(group.label) }}
      </h4>
      <AposSchema
        :model-value="inlineValue[groupName]"
        :schema="group.schema"
        :modifiers="[ 'micro' ]"
        :field-modifiers="{ select: ['micro'], range: ['micro'] }"
        :display-options="{ helpTooltip: true }"
        @update:model-value="emit('update-data', $event)"
      />
    </div>

    <ul class="apos-styles-body__nav">
      <li
        v-for="(group, key) in current.subGroup"
        :key="key"
        class="apos-styles-body__nav-link"
        @click="emit('navigate-right', key)"
      >
        <span class="apos-styles-body__nav-link-title">
          {{ $t(group.label) }}
        </span>
        <AposIndicator
          class="apos-styles-body__nav-link-icon"
          icon="chevron-right-icon"
          :icon-size="20"
        />
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  current: {
    type: Object,
    required: true
  },
  currentPath: {
    type: Array,
    required: true
  },
  fieldValue: {
    type: Object,
    default: () => ({})
  },
  inlineValue: {
    type: Object,
    default: () => ({})
  }
});

const currentGroupName = computed(() => {
  return props.currentPath[props.currentPath.length - 1];
});

const emit = defineEmits([ 'navigate-right', 'update-data' ]);

</script>

<style lang="scss" scoped>
$padding-unit: 10px;
$slideDuration: 250ms;
$slideTiming: cubic-bezier(0.45, 0, 0.55, 1);

.apos-styles-body {
  padding-bottom: 20px;
  cursor: auto;
  scrollbar-width: thin;
}

.apos-styles-body__title {
  margin: 0 0 15px;
  color: var(--a-background-inverted);
  font-family: var(--a-family-default);
  font-size: 21px;
  text-align: left;
  line-height: 1;
  font-weight: var(--a-weight-base);
}

.apos-styles-body__nav {
  margin: 20px 0 0;
  padding-left: 0;
}

.apos-styles-body__nav-link {
  @include type-label;

  & {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
    padding: 5px 0;
    list-style: none;
    cursor: pointer;
    line-height: var(--a-line-tall);
  }

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  &:hover .apos-styles-body__nav-link-icon {
    transform: translateX(3px);
  }
}

.apos-styles-body--root {
  .apos-styles-body__nav {
    margin: 0;
  }

  .apos-styles-body__nav-link {
    justify-content: unset;
    color: var(--a-base-1);
    font-family: var(--a-family-default);
    font-size: 21px;
    font-weight: 400;

    &:hover {
      color: var(--a-background-inverted);

      .apos-styles-body__nav-link-icon {
        opacity: 1;
      }
    }
  }

  .apos-styles-body__nav-link-icon {
    position: relative;
    top: 2px;
    opacity: 0;
  }
}

.apos-styles-body__nav-link-icon {
  transition: all 0.2s $slideTiming;
}

.apos-styles-body__inline-label {
  color: var(--a-base-2);
  font-size: 12px;
  text-align: left;
  line-height: 1;
  font-weight: 600;
}

.apos-styles-body__inline-group {
  margin-top: 30px;
}

:deep(.apos-schema) {
  margin: 0;
  padding-top: 0;

  &:not(:last-child) {
    margin-bottom: $padding-unit * 2;
  }

  .apos-field {
    padding: 5px 0;
  }

  .apos-field_label-info {
    @include type-label;
  }

  .apos-field.apos-field--micro {
    margin-bottom: 10px;
  }

  .apos-field:not(:last-child) {
    margin-bottom: 10px;
  }

  .apos-field__outer {
    padding: 0 $padding-unit;
  }

  .apos-input {
    background-color: var(--a-primary-background);
  }

  .apos-field__wrapper {
    position: inherit;
  }

  .apos-field--inline {
    justify-content: space-between;
  }

  .apos-field--select > .apos-input-wrapper {
    flex-grow: 1;
  }

  .apos-range__input {
    margin: 0;
  }
}
</style>
