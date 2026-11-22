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
        ref="fieldsSchema"
        :model-value="fieldValue"
        :schema="current.schema"
        :modifiers="[ 'micro' ]"
        :field-modifiers="{ select: ['micro'], range: ['micro'] }"
        :display-options="{ helpTooltip: true }"
        :outside-states="outsideStates"
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
        ref="inlineSchemas"
        :model-value="inlineValue[groupName]"
        :schema="group.schema"
        :modifiers="[ 'micro' ]"
        :field-modifiers="{ select: ['micro'], range: ['micro'] }"
        :display-options="{ helpTooltip: true }"
        :outside-states="outsideStates"
        @update:model-value="emit('update-data', $event)"
      />
    </div>

    <ul class="apos-styles-body__nav">
      <li
        v-for="(group, key) in current.subGroup"
        :key="key"
        class="apos-styles-body__nav-item"
      >
        <button
          type="button"
          class="apos-styles-body__nav-link"
          :class="{ 'apos-styles-body__nav-link--busy': groupStates[key]?.busy }"
          :aria-busy="groupStates[key]?.busy ? 'true' : null"
          @click="emit('navigate-right', key)"
        >
          <span class="apos-styles-body__nav-link-title">
            <transition name="apos-styles-body__ai-mark">
              <AposAiMark
                v-if="groupStates[key]"
                class="apos-styles-body__ai-mark"
                :busy="groupStates[key].busy"
                :focusable="false"
              />
            </transition>
            {{ $t(group.label) }}
          </span>
          <AposIndicator
            class="apos-styles-body__nav-link-icon"
            icon="chevron-right-icon"
            :icon-size="20"
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

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
  },
  // What came from outside the window (see `AposOutsideMixin`)
  outsideStates: {
    type: Object,
    default: null
  }
});

const fieldsSchema = ref(null);
const inlineSchemas = ref([]);

// Each group row shows what came from outside for the fields below it, at
// any depth: `{ busy, edited }` by group name
const groupStates = computed(() => {
  const tops = props.outsideStates?.tops || {};
  const states = {};
  for (const [ key, group ] of Object.entries(props.current.subGroup || {})) {
    for (const name of getGroupFields(group)) {
      if (tops[name]) {
        states[key] = {
          busy: Boolean(states[key]?.busy || tops[name].busy),
          edited: Boolean(states[key]?.edited || tops[name].edited)
        };
      }
    }
  }
  return states;
});

function getGroupFields(group) {
  return [
    ...(group.fields || []),
    ...Object.values(group.group || {}).flatMap(getGroupFields)
  ];
}

// The schema showing a field, if its group shows
function getSchema(name) {
  return [ fieldsSchema.value, ...inlineSchemas.value ]
    .find(schema => schema?.schema.some(field => field.name === name)) || null;
}

defineExpose({ getSchema });

const currentGroupName = computed(() => {
  return props.currentPath[props.currentPath.length - 1];
});

const emit = defineEmits([ 'navigate-right', 'update-data' ]);

</script>

<style lang="scss" scoped>
$padding-unit: 10px;
$slide-duration: 250ms;
$slide-timing: cubic-bezier(0.45, 0, 0.55, 1);

.apos-styles-body {
  padding-bottom: 20px;
  cursor: auto;
  scrollbar-width: thin;
}

.apos-styles-body__title {
  margin: 0 0 15px;
  color: var(--a-background-inverted);
  font-family: var(--a-family-default);
  // stylelint-disable-next-line declaration-property-unit-allowed-list
  font-size: 21px;
  text-align: left;
  line-height: 1;
  font-weight: var(--a-weight-base);
}

.apos-styles-body__nav {
  margin: 20px 0 0;
  padding-left: 0;
}

.apos-styles-body__nav-item {
  margin-bottom: 5px;
  list-style: none;

  &:last-child {
    margin-bottom: 0;
  }
}

.apos-styles-body__nav-link {
  @include type-label;

  & {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin: 0;
    padding: 5px 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    line-height: var(--a-line-tall);
  }

  .apos-styles-body__nav-item:first-child & {
    padding-top: 0;
  }

  &:hover .apos-styles-body__nav-link-icon {
    transform: translateX(3px);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--a-primary-light-40);
    outline: none;
    border-radius: var(--a-border-radius);
  }
}

// Busy while a value from outside is on its way to a field below the row,
// then "Edited by AI", leading the label as on a field
.apos-styles-body__nav-link--busy {
  $tint: color-mix(in srgb, var(--a-primary) 10%, transparent);

  background-image: linear-gradient($tint, $tint);
  // The tint reaches past the row on both sides, the row itself unmoved
  box-shadow: -8px 0 0 $tint, 8px 0 0 $tint;
}

.apos-styles-body__nav-link-title {
  display: inline-flex;
  align-items: center;
}

.apos-styles-body__ai-mark {
  margin-right: 6px;
}

.apos-styles-body__ai-mark-enter-active {
  transition: opacity 240ms ease-out, transform 240ms ease-out;
}

.apos-styles-body__ai-mark-leave-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.apos-styles-body__ai-mark-enter-from,
.apos-styles-body__ai-mark-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.apos-styles-body--root {
  .apos-styles-body__nav {
    margin: 0;
  }

  .apos-styles-body__nav-link {
    justify-content: unset;
    color: var(--a-base-1);
    font-family: var(--a-family-default);
    // stylelint-disable-next-line declaration-property-unit-allowed-list
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
  transition: all 200ms $slide-timing;
}

.apos-styles-body__inline-label {
  color: var(--a-base-2);
  // stylelint-disable-next-line declaration-property-unit-allowed-list
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
