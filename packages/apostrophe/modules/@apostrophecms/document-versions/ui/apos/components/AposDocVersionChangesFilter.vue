<template>
  <AposContextMenu
    :button="button"
    menu-placement="bottom-end"
    identifier="doc-version-changes-filter"
    dialog-label="apostrophe:versionFilterChanges"
    :trigger-aria-label="$t('apostrophe:versionFilterShowing', { count: shown })"
  >
    <ul
      class="apos-doc-version-changes-filter"
      :aria-label="$t('apostrophe:versionFilterChanges')"
      data-apos-test="doc-version-changes-filter"
    >
      <li
        v-for="option in options"
        :key="option.value"
        :data-apos-test="`doc-version-changes-filter-${option.value}`"
      >
        <label
          class="apos-choice-label apos-doc-version-changes-filter__option"
          :class="{ 'apos-choice-label--disabled': !option.count }"
        >
          <input
            type="checkbox"
            class="apos-sr-only apos-input--choice apos-input--checkbox"
            :value="option.value"
            :checked="modelValue.includes(option.value)"
            :disabled="!option.count"
            @change="toggle(option.value, $event.target.checked)"
          >
          <span
            class="apos-input-indicator apos-doc-version-changes-filter__indicator"
            aria-hidden="true"
          >
            <check-bold-icon
              v-if="modelValue.includes(option.value)"
              :size="10"
            />
          </span>
          <span class="apos-choice-label-text">{{ $t(option.label) }}</span>
          <span class="apos-doc-version-changes-filter__count">
            <span class="apos-sr-only">, </span>{{ option.count }}
          </span>
        </label>
      </li>
    </ul>
  </AposContextMenu>
</template>

<script setup>
// Which kinds of change a version's change list shows: a change shows when
// any checked option matches it. An option nothing matches is disabled.
import { computed, inject } from 'vue';

const props = defineProps({
  // The checked options: `ai`, `added`, `modified`, `deleted`
  modelValue: {
    type: Array,
    required: true
  },
  // The route's counts per option
  counts: {
    type: Object,
    required: true
  },
  // How many changes the filter lets through
  shown: {
    type: Number,
    required: true
  }
});

const emit = defineEmits([ 'update:modelValue' ]);

const $t = inject('i18n');

const labels = {
  ai: 'apostrophe:versionChangeAi',
  added: 'apostrophe:versionChangeAdded',
  modified: 'apostrophe:versionChangeModified',
  deleted: 'apostrophe:versionChangeDeleted'
};

const options = computed(() => Object.entries(labels).map(([ value, label ]) => ({
  value,
  label,
  count: props.counts[value] || 0
})));

function toggle(value, checked) {
  const others = props.modelValue.filter(item => item !== value);
  emit('update:modelValue', checked ? [ ...others, value ] : others);
}

const button = computed(() => ({
  label: String(props.shown),
  icon: 'filter-variant-icon',
  modifiers: [ 'small' ],
  type: 'outline'
}));
</script>

<style lang="scss" scoped>
.apos-doc-version-changes-filter {
  @include apos-list-reset();

  & {
    display: flex;
    flex-direction: column;
    gap: $spacing-base;
    min-width: 160px;
  }

  &__option {
    gap: $spacing-half;
  }

  &__indicator {
    border-radius: 3px;
  }

  &__count {
    margin-left: auto;
    padding-left: $spacing-double;
    color: var(--a-base-2);
  }
}
</style>
