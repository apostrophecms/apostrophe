<template>
  <AposContextMenu
    :button="button"
    menu-placement="bottom-end"
  >
    <div class="apos-recently-edited-filters">
      <div class="apos-recently-edited-filters__header">
        <h3 class="apos-recently-edited-filters__title">
          {{ $t('apostrophe:recentlyEditedFilters') }}
        </h3>
        <button
          type="button"
          class="apos-recently-edited-filters__clear"
          @click="clearFilters"
        >
          {{ $t('apostrophe:recentlyEditedResetFilters') }}
        </button>
      </div>
      <div
        v-for="filter in filters"
        :key="filter.name"
        class="apos-recently-edited-filters__row"
      >
        <AposInputSelect
          :field="fieldMap[filter.name]"
          :model-value="modelValueMap[filter.name]"
          :status="{}"
          :modifiers="['small', 'inline']"
          :no-blur-emit="true"
          @update:model-value="updateFilter(filter.name, $event)"
        />
      </div>
    </div>
  </AposContextMenu>
</template>

<script setup>
import { computed, inject } from 'vue';

const $t = inject('i18n');

const props = defineProps({
  filters: {
    type: Array,
    default: () => []
  },
  filterChoices: {
    type: Object,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits([ 'update:modelValue' ]);

const SORTED_FILTERS = new Set([ '_editedBy', '_docType' ]);

const currentUser = computed(() => apos?.login?.user || apos?.user || null);

const button = computed(() => ({
  label: 'apostrophe:filter',
  icon: 'tune-icon',
  modifiers: [ 'small' ],
  type: 'outline'
}));

// Cached field configs
const fieldMap = computed(() => {
  return Object.fromEntries(
    props.filters.map(filter => [
      filter.name,
      {
        name: filter.name,
        type: filter.inputType || 'select',
        label: filter.label,
        choices: getChoices(filter)
      }
    ])
  );
});

// Cached model-value wrappers
const modelValueMap = computed(() => {
  return Object.fromEntries(
    props.filters.map(filter => [
      filter.name,
      {
        data: filter.name in props.modelValue
          ? props.modelValue[filter.name]
          : filter.def ?? null
      }
    ])
  );
});

function getChoices(filter) {
  const choices = props.filterChoices[filter.name];

  if (!choices) {
    return [
      {
        label: 'apostrophe:filterMenuLoadingChoices',
        value: null
      }
    ];
  }

  const mappedChoices = choices.map(choice => ({
    ...choice,
    label: formatChoiceLabel(filter.name, choice)
  }));

  // Sort dynamic-choices filters by translated label so the order
  // is meaningful regardless of i18n key names. Static-choices
  // filters (_status, _action, etc.) keep their intentional order.
  if (SORTED_FILTERS.has(filter.name)) {
    const currentUserId = currentUser.value?._id;
    mappedChoices.sort((a, b) => {
      if (a.value === null) {
        return -1;
      }
      if (b.value === null) {
        return 1;
      }
      // Pin current user right after "Any" for _editedBy.
      if (filter.name === '_editedBy' && currentUserId) {
        if (String(a.value) === String(currentUserId)) {
          return -1;
        }
        if (String(b.value) === String(currentUserId)) {
          return 1;
        }
      }
      return String(a.label).localeCompare(String(b.label));
    });
  }

  if (mappedChoices.find(choice => choice.value === null)) {
    return mappedChoices;
  }

  return [
    {
      label: 'apostrophe:any',
      value: null
    },
    ...mappedChoices
  ];
}

function formatChoiceLabel(name, choice) {
  if (
    name === '_editedBy' &&
    choice?.value &&
    currentUser.value?._id &&
    String(choice.value) === String(currentUser.value._id)
  ) {
    const currentUserLabel = currentUser.value.title || currentUser.value.username;
    return $t('apostrophe:recentlyEditedCurrentUser', {
      user: currentUserLabel
    });
  }

  if (choice.label && typeof choice.label === 'object') {
    return $t(choice.label);
  }

  if (typeof choice.label === 'string' && choice.label.length) {
    return $t(choice.label);
  }

  return choice.label;
}

function updateFilter(name, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    [name]: value.data
  });
}

function clearFilters() {
  emit('update:modelValue', props.filters.reduce((acc, filter) => {
    acc[filter.name] = filter.def ?? null;
    return acc;
  }, {}));
}
</script>

<style lang="scss" scoped>
.apos-recently-edited-filters {
  width: 340px;
  padding: 10px 14px 12px;
}

.apos-recently-edited-filters__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--a-base-9);
}

.apos-recently-edited-filters__title {
  @include type-large;

  & {
    margin: 0;
    font-weight: var(--a-weight-bold);
  }
}

.apos-recently-edited-filters__clear {
  @include type-base;

  & {
    border: 0;
    color: var(--a-primary);
    background: transparent;
    cursor: pointer;
  }
}

.apos-recently-edited-filters__row {
  margin-bottom: 6px;
}

.apos-recently-edited-filters__row:last-child {
  margin-bottom: 0;
}

.apos-recently-edited-filters :deep(.apos-field--inline .apos-input-wrapper) {
  flex: 0 0 60%;
}
</style>
