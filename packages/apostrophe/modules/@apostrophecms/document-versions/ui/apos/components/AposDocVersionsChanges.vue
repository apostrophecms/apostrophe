<template>
  <section
    class="apos-doc-version-changes"
    :aria-label="$t('apostrophe:versionChanges')"
    data-apos-test="doc-version-changes"
  >
    <button
      type="button"
      class="apos-doc-version-changes__back"
      data-apos-test="doc-version-changes-back"
      @click="$emit('back')"
    >
      <chevron-left-icon
        :size="16"
        class="apos-doc-version-changes__back-icon"
      />
      <span>{{ $t('apostrophe:versionBackToAll') }}</span>
    </button>
    <div
      v-if="version"
      class="apos-doc-version-changes__version"
    >
      <AposDocVersionsEntry
        :version="version"
        layout="detail"
      />
    </div>
    <div class="apos-doc-version-changes__bar">
      <h2 class="apos-doc-version-changes__title">
        {{ $t('apostrophe:versionChanges') }}
        <span
          class="apos-doc-version-changes__count"
          data-apos-test="doc-version-changes-count"
        >
          · {{ $t('apostrophe:versionEdits', { count: rows.length }) }}
        </span>
      </h2>
    </div>
    <div class="apos-doc-version-changes__list">
      <p
        v-if="!rows.length"
        class="apos-doc-version-changes__empty"
        data-apos-test="doc-version-changes-empty"
      >
        {{ $t('apostrophe:versionNoChanges') }}
      </p>
      <section
        v-for="group in groups"
        :key="group.key"
        class="apos-doc-version-changes__group"
        data-apos-test="doc-version-change-group"
      >
        <h3 class="apos-doc-version-changes__group-header">
          <span class="apos-doc-version-changes__group-title">
            <template
              v-for="(segment, index) in group.path"
              :key="index"
            >
              <chevron-right-icon
                v-if="index"
                :size="12"
                class="apos-doc-version-changes__crumb-icon"
                aria-hidden="true"
              />
              <span
                v-if="index"
                class="apos-sr-only"
              >, </span>
              <span
                class="apos-doc-version-changes__crumb"
                :class="{
                  'apos-doc-version-changes__crumb--last': index === group.path.length - 1
                }"
              >{{ segmentText(segment) }}</span>
            </template>
          </span>
          <AposDocVersionChangeType :type="group.type" />
        </h3>
        <ul class="apos-doc-version-changes__rows">
          <li
            v-for="entry in group.entries"
            :key="entry.key"
            class="apos-doc-version-changes__row"
            data-apos-test="doc-version-change"
            :data-apos-change-type="entry.row.type"
          >
            <div class="apos-doc-version-changes__row-main">
              <span
                class="apos-doc-version-changes__row-label"
                data-apos-test="doc-version-change-path"
              >
                <template
                  v-for="(segment, index) in entry.segments"
                  :key="index"
                >
                  <chevron-right-icon
                    v-if="index"
                    :size="12"
                    class="apos-doc-version-changes__crumb-icon"
                    aria-hidden="true"
                  />
                  <span
                    v-if="index"
                    class="apos-sr-only"
                  >, </span>
                  <span class="apos-doc-version-changes__crumb">{{ segmentText(segment) }}</span>
                </template>
              </span>
              <span class="apos-doc-version-changes__row-aside">
                <span
                  v-if="entry.row.ai"
                  v-apos-tooltip="'apostrophe:versionAiChangeTooltip'"
                  class="apos-doc-version-changes__ai"
                  data-apos-test="doc-version-change-ai"
                >AI</span>
                <AposButton
                  type="quiet"
                  :label="expanded.has(entry.key)
                    ? 'apostrophe:versionCollapseChanges'
                    : 'apostrophe:versionSeeChanges'"
                  :attrs="{
                    'aria-expanded': expanded.has(entry.key),
                    'aria-controls': `${baseId}-${entry.key}`,
                    'data-apos-test': 'doc-version-change-toggle'
                  }"
                  @click="toggle(entry.key)"
                />
              </span>
            </div>
            <div
              v-if="expanded.has(entry.key)"
              :id="`${baseId}-${entry.key}`"
              class="apos-doc-version-changes__diff"
              data-apos-test="doc-version-change-diff"
            >
              <div
                class="apos-doc-version-changes__pane apos-doc-version-changes__pane--new"
              >
                <span
                  class="apos-doc-version-changes__kicker apos-doc-version-changes__kicker--new"
                >
                  {{ $t('apostrophe:versionThisVersion') }}
                </span>
                <p class="apos-doc-version-changes__value">
                  {{ entry.row.newText }}
                </p>
              </div>
              <div
                class="apos-doc-version-changes__pane apos-doc-version-changes__pane--old"
              >
                <span
                  class="apos-doc-version-changes__kicker apos-doc-version-changes__kicker--old"
                >
                  {{ $t('apostrophe:versionPreviousVersion') }}
                </span>
                <p class="apos-doc-version-changes__value">
                  {{ entry.row.oldText }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup>
// One version's changes, grouped under the top-level field they belong
// to, or under the widget when that field is an area. A row's breadcrumb
// runs from below its group down to the changed value. The group header
// alone states the change type.
import {
  computed, inject, reactive, useId, watch
} from 'vue';

const props = defineProps({
  // The version whose changes these are, as the list holds it
  version: {
    type: Object,
    default: null
  },
  // The rows of the `changes` route
  rows: {
    type: Array,
    required: true
  }
});

defineEmits([ 'back' ]);

const $t = inject('i18n');
const baseId = useId();

// The keys of the rows showing their values
const expanded = reactive(new Set());

watch(() => props.rows, () => {
  expanded.clear();
});

function toggle(key) {
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
}

function segmentText(segment) {
  const label = $t(segment.label);
  return segment.title ? `${label} · ${segment.title}` : label;
}

// A row's group is its top-level field, plus the widget right below it
// when the field is an area
function getGroupPath(row) {
  const depth = row.path[1]?.widgetType ? 2 : 1;
  return row.path.slice(0, depth);
}

const groups = computed(() => {
  const list = [];
  const byKey = new Map();
  props.rows.forEach((row, index) => {
    const path = getGroupPath(row);
    const key = path.map(segment => segment.name).join('.');
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        path,
        type: 'modified',
        entries: []
      };
      byKey.set(key, group);
      list.push(group);
    }
    const segments = row.path.slice(path.length);
    // The row is the group's own field or widget: it was added or deleted
    // whole, and its label stands in for the empty breadcrumb
    if (!segments.length) {
      group.type = row.type;
      segments.push(path.at(-1));
    }
    group.entries.push({
      key: String(index),
      row,
      segments
    });
  });
  return list;
});
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

.apos-doc-version-changes {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--a-background-primary);

  &__back {
    @include apos-button-reset();

    & {
      display: flex;
      box-sizing: border-box;
      flex-shrink: 0;
      align-items: center;
      gap: $spacing-half;
      width: 100%;
      padding: $spacing-base $pad-x;
      border-bottom: 1px solid var(--a-base-8);
      background-color: var(--a-base-10);
      color: var(--a-text-primary);
      font-family: var(--a-family-default);
      font-size: var(--a-type-large);
      font-weight: var(--a-weight-bold);
      text-align: left;
      cursor: pointer;
    }

    &:hover {
      background-color: var(--a-base-9);
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: -2px;
    }
  }

  // The icon components offset their svg below the baseline; these sit
  // in flex rows and center instead
  &__back-icon,
  &__crumb-icon {
    display: flex;

    :deep(.material-design-icon__svg) {
      bottom: 0;
    }
  }

  &__version {
    flex-shrink: 0;
    padding: $pad-x;
    border-bottom: 1px solid var(--a-base-8);
  }

  &__bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-base;
    padding: $spacing-base $pad-x;
    border-bottom: 1px solid var(--a-base-8);
    background-color: var(--a-base-10);
  }

  &__title {
    @include type-large;

    & {
      display: flex;
      align-items: center;
      gap: $spacing-half;
      margin: 0;
      font-weight: var(--a-weight-bold);
    }
  }

  &__count {
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
    font-weight: var(--a-weight-base);
  }

  &__list {
    overflow: hidden auto;
    flex: 1 1 auto;
    min-height: 0;
  }

  &__empty {
    @include type-base;

    & {
      margin: 0;
      padding: $spacing-double $pad-x;
      color: var(--a-base-2);
      text-align: center;
    }
  }

  &__group {
    background-color: var(--a-base-10);
  }

  &__group-header {
    @include type-base;

    & {
      z-index: $z-index-base;
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      gap: $spacing-base;
      margin: 0;
      padding: $spacing-base $pad-x;
      border-bottom: 1px solid var(--a-base-7);
      background-color: var(--a-base-9);
    }
  }

  &__group-title {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  &__crumb {
    overflow-wrap: anywhere;

    &--last {
      font-weight: var(--a-weight-bold);
    }
  }

  &__crumb-icon {
    flex-shrink: 0;
    color: var(--a-base-1);
  }

  &__rows {
    @include apos-list-reset();

    & {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  }

  &__row {
    padding: $spacing-base $pad-x;
    background-color: var(--a-background-primary);
  }

  &__row-main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-half $spacing-base;
  }

  &__row-label {
    @include type-base;

    & {
      display: inline-flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }
  }

  &__row-aside {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-half;
    margin-left: auto;
  }

  &__ai {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--a-border-radius);
    background-color: var(--a-primary-light-80);
    color: var(--a-primary-dark-15);
    font-family: var(--a-family-default);
    font-size: var(--a-type-tiny);
    font-weight: var(--a-weight-bold);
    letter-spacing: 0.2px;
    line-height: 1;
  }

  &__diff {
    overflow: hidden;
    margin-top: $spacing-base;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
  }

  &__pane {
    padding: $spacing-half $spacing-base $spacing-base;

    &--new {
      border-bottom: 1px solid var(--a-base-8);
      background-color: var(--a-success-fade);
    }

    &--old {
      background-color: var(--a-danger-fade);
    }
  }

  &__kicker {
    display: block;
    margin-bottom: $spacing-half;
    font-family: var(--a-family-default);
    font-size: var(--a-type-tiny);
    font-weight: var(--a-weight-bold);
    letter-spacing: 0.2px;
    text-transform: uppercase;

    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }
  }

  &__value {
    @include type-base;

    & {
      margin: 0;
      font-size: var(--a-type-smaller);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }
  }
}
</style>
