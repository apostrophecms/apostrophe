<template>
  <AposContextMenu
    :button="button"
    menu-placement="bottom-end"
    identifier="recently-edited-filter-menu"
  >
    <div
      class="apos-recently-edited-filters"
      data-apos-test="recently-edited-filters"
    >
      <div class="apos-recently-edited-filters__header">
        <h3 class="apos-recently-edited-filters__title">
          {{ $t('apostrophe:recentlyEditedFilters') }}
        </h3>
        <button
          type="button"
          class="apos-recently-edited-filters__clear"
          data-apos-test="recently-edited-filter-reset"
          @click="clearFilters"
        >
          {{ $t('apostrophe:recentlyEditedResetFilters') }}
        </button>
      </div>
      <div
        v-for="filterSet in filterSets"
        :key="filterSet.key"
        class="apos-recently-edited-filters__row"
        :data-apos-test="'recently-edited-filter-' + filterSet.name"
      >
        <component
          :is="COMPONENT_MAP[filterSet.field.type] || COMPONENT_MAP.select"
          :field="filterSet.field"
          :model-value="filterSet.value"
          :status="filterSet.status"
          :modifiers="['small', 'inline']"
          :add-label="filterSet.addLabel"
          :no-blur-emit="true"
          @update:model-value="updateFilter(filterSet.name, $event)"
        />
      </div>
    </div>
  </AposContextMenu>
</template>

<script setup>
import {
  computed, inject, ref, watch
} from 'vue';

const $t = inject('i18n');

const COMPONENT_MAP = {
  select: 'AposInputSelect',
  radio: 'AposInputSelect',
  combo: 'AposRecentlyEditedCombo'
};

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

// Per-filter generation: only remount the specific filter whose
// choices changed, rather than fingerprinting all choices at once.
const generationMap = ref({});

function choicesChanged(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return a !== b;
  }
  if (a.length !== b.length) {
    return true;
  }
  return a.some((choice, i) => choice.value !== b[i]?.value);
}

watch(() => props.filterChoices, (next, prev) => {
  for (const name of Object.keys(next || {})) {
    if (choicesChanged(next[name], prev?.[name])) {
      generationMap.value[name] = (generationMap.value[name] || 0) + 1;
    }
  }
}, { deep: true });

// AposFilterMenu-style filterSets: creates fresh { data: value }
// wrappers per evaluation — no persistent reactive objects needed.
const filterSets = computed(() => {
  return props.filters.map(filter => ({
    name: filter.name,
    key: `${generationMap.value[filter.name] || 0}:${filter.name}`,
    field: {
      name: filter.name,
      type: isCheckboxFilter(filter) ? 'combo' : 'select',
      label: filter.label,
      choices: getChoices(filter),
      def: filter.def
    },
    addLabel: isCheckboxFilter(filter) ? 'apostrophe:recentlyEditedAddFilter' : undefined,
    value: {
      data: props.modelValue[filter.name] ?? filterDefault(filter)
    },
    status: {}
  }));
});

function getChoices(filter) {
  const choices = props.filterChoices[filter.name];
  if (!choices) {
    // Combo renders nothing when choices are empty.
    if (isCheckboxFilter(filter)) {
      return [];
    }
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

  if (isCheckboxFilter(filter)) {
    return mappedChoices;
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
    acc[filter.name] = filterDefault(filter);
    return acc;
  }, {}));
}

function isCheckboxFilter(filter) {
  return (filter.inputType || 'select') === 'checkbox';
}

function filterDefault(filter) {
  if (filter.def !== undefined) {
    return filter.def;
  }
  return isCheckboxFilter(filter) ? [] : null;
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
