<template>
  <section
    class="apos-doc-version-changes"
    :aria-label="$t('apostrophe:versionChanges')"
    data-apos-test="doc-version-changes"
  >
    <button
      ref="backButton"
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
      <AposDocVersionChangesFilter
        v-if="rows.length"
        v-model="filter"
        :counts="counts"
        :shown="shownRows.length"
      />
    </div>
    <div
      ref="list"
      class="apos-doc-version-changes__list"
    >
      <p
        v-if="!rows.length"
        class="apos-doc-version-changes__empty"
        data-apos-test="doc-version-changes-empty"
      >
        {{ $t(version?.restoredFrom
          ? 'apostrophe:versionRestoredBaseline'
          : 'apostrophe:versionNoChanges') }}
      </p>
      <p
        v-else-if="!shownRows.length"
        class="apos-doc-version-changes__empty"
        data-apos-test="doc-version-changes-no-match"
      >
        {{ $t('apostrophe:versionNoChangesMatch') }}
      </p>
      <section
        v-for="group in groups"
        :key="group.key"
        :ref="el => setGroupEl(group.key, el)"
        class="apos-doc-version-changes__group"
        data-apos-test="doc-version-change-group"
      >
        <h3 class="apos-doc-version-changes__group-header">
          <AposDocVersionChangePath
            class="apos-doc-version-changes__group-title"
            :segments="group.path"
            bold-last
          />
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
              <AposDocVersionChangePath
                class="apos-doc-version-changes__row-label"
                :segments="entry.segments"
                data-apos-test="doc-version-change-path"
              />
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
              <p
                v-if="!entry.changed"
                class="apos-doc-version-changes__unchanged"
                data-apos-test="doc-version-change-modified"
              >
                {{ $t('apostrophe:versionChangeModified') }}
              </p>
              <template v-else>
                <div
                  v-for="pane in panes"
                  :key="pane.side"
                  class="apos-doc-version-changes__pane"
                  :class="`apos-doc-version-changes__pane--${pane.side}`"
                  :data-apos-test="`doc-version-change-${pane.side}`"
                >
                  <span
                    class="apos-doc-version-changes__kicker"
                    :class="`apos-doc-version-changes__kicker--${pane.side}`"
                  >
                    {{ $t(pane.label) }}
                  </span>
                  <div class="apos-doc-version-changes__value-line">
                    <component
                      :is="pane.icon"
                      :size="14"
                      class="apos-doc-version-changes__value-icon"
                      :title="$t(pane.markLabel)"
                    />
                    <p
                      class="apos-doc-version-changes__value"
                      :class="entry.order && `apos-doc-version-changes__value--${pane.side}`"
                    >
                      <template v-if="entry.text[pane.side]">
                        <template
                          v-for="(part, index) in entry.parts[pane.side]"
                          :key="index"
                        >
                          <span v-if="entry.order && index">, </span>
                          <span v-if="part.change === 'same'">{{ part.text }}</span>
                          <component
                            :is="pane.tag"
                            v-else
                            class="apos-doc-version-changes__mark"
                            :class="`apos-doc-version-changes__mark--${pane.side}`"
                          >
                            <span class="apos-sr-only">{{ `${$t(pane.markLabel)} ` }}</span>{{ part.text }}
                          </component>
                        </template>
                      </template>
                      <template v-else>
                        <span
                          class="apos-doc-version-changes__none"
                          :class="`apos-doc-version-changes__none--${pane.side}`"
                          aria-hidden="true"
                        >—</span>
                        <span class="apos-sr-only">{{ $t('apostrophe:versionEmptyValue') }}</span>
                      </template>
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </div>
    <nav
      v-if="groups.length"
      class="apos-doc-version-changes__nav"
      :aria-label="$t('apostrophe:versionNavLabel')"
      data-apos-test="doc-version-changes-nav"
    >
      <div
        class="apos-doc-version-changes__nav-status"
        aria-live="polite"
        aria-atomic="true"
      >
        <AposDocVersionChangePath
          v-if="position >= 0"
          class="apos-doc-version-changes__nav-label"
          :segments="groups[position].path"
          bold-last
          data-apos-test="doc-version-changes-nav-label"
        />
        <span
          v-else
          class="apos-doc-version-changes__nav-label"
          data-apos-test="doc-version-changes-nav-label"
        >{{ $t('apostrophe:versionNavLabel') }}</span>
        <span
          class="apos-doc-version-changes__nav-position"
          data-apos-test="doc-version-changes-nav-position"
        >
          {{ $t('apostrophe:versionNavPosition', {
            current: position + 1,
            total: groups.length
          }) }}
        </span>
      </div>
      <div class="apos-doc-version-changes__nav-buttons">
        <AposButton
          ref="previousButton"
          type="outline"
          icon="chevron-left-icon"
          icon-only
          label="apostrophe:versionNavPrevious"
          tooltip="apostrophe:versionNavPrevious"
          :modifiers="[ 'small' ]"
          :disabled="position <= 0"
          :attrs="{ 'data-apos-test': 'doc-version-changes-nav-previous' }"
          @click="step(-1)"
        />
        <AposButton
          ref="nextButton"
          type="outline"
          icon="chevron-right-icon"
          icon-only
          label="apostrophe:versionNavNext"
          tooltip="apostrophe:versionNavNext"
          :modifiers="[ 'small' ]"
          :disabled="position === groups.length - 1"
          :attrs="{ 'data-apos-test': 'doc-version-changes-nav-next' }"
          @click="step(1)"
        />
      </div>
    </nav>
  </section>
</template>

<script setup>
// One version's changes, grouped under the top-level field they belong
// to, or under the widget when that field is an area. A row's breadcrumb
// runs from below its group down to the changed value. The group header
// alone states the change type. The navigator at the bottom steps through
// the groups the filter shows.
import {
  computed, inject, nextTick, reactive, ref, useId, watch
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
  },
  // The counts of the `changes` route
  counts: {
    type: Object,
    default: null
  }
});

// `navigate` carries the group a step selected, or `null` when the
// selection is gone
const emit = defineEmits([ 'back', 'navigate' ]);

const $t = inject('i18n');
const baseId = useId();

const backButton = ref(null);
const list = ref(null);

// The expanded row's two sides, newer first. A side shows the words both
// sides share and its own changed words.
const panes = [
  {
    side: 'new',
    change: 'added',
    tag: 'ins',
    label: 'apostrophe:versionThisVersion',
    icon: 'plus-circle-icon',
    markLabel: 'apostrophe:versionAddedText'
  },
  {
    side: 'old',
    change: 'removed',
    tag: 'del',
    label: 'apostrophe:versionPreviousVersion',
    icon: 'minus-circle-icon',
    markLabel: 'apostrophe:versionRemovedText'
  }
];

// The keys of the rows showing their values
const expanded = reactive(new Set());
// The checked filter options
const filter = ref([]);
// The navigator's index into the groups, -1 until a step selects one
const position = ref(-1);

watch(() => props.rows, () => {
  expanded.clear();
  filter.value = Object.entries(props.counts || {})
    .filter(([ , count ]) => count)
    .map(([ name ]) => name);
  position.value = -1;
  emit('navigate', null);
}, { immediate: true });

function toggle(key) {
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
}

function matches(row) {
  return filter.value.includes(row.type) || (row.ai && filter.value.includes('ai'));
}

const shownRows = computed(() => props.rows.filter(matches));

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
    if (!matches(row)) {
      return;
    }
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
    // The order of an array's or area's items reads as the last crumb
    const order = [ 'array', 'area' ].includes(row.fieldType);
    if (order) {
      segments.push({ label: 'apostrophe:versionOrderChanged' });
    }
    // The row is the group's own field or widget: it was added or deleted
    // whole, and its label stands in for the empty breadcrumb
    if (!segments.length) {
      group.type = row.type;
      segments.push(path.at(-1));
    }
    const diff = row.diff || [];
    group.entries.push({
      key: String(index),
      row,
      segments,
      // Its parts are whole items, shown as a list in the side's colour
      order,
      // What each side shows: the parts both share and its own
      parts: Object.fromEntries(panes.map(pane => [
        pane.side,
        diff.filter(part => [ 'same', pane.change ].includes(part.change))
      ])),
      // Whether the text shows the change at all
      changed: diff.some(part => part.change !== 'same'),
      text: {
        new: Boolean(row.newText),
        old: Boolean(row.oldText)
      }
    });
  });
  return list;
});

// --- Navigator ---

const groupEls = new Map();

function setGroupEl(key, el) {
  if (el) {
    groupEls.set(key, el);
  } else {
    groupEls.delete(key);
  }
}

const previousButton = ref(null);
const nextButton = ref(null);

// The filter changes the groups: the current group keeps its place while
// it shows, otherwise the selection is gone
watch(groups, (current, previous) => {
  if (position.value < 0) {
    return;
  }
  const key = previous?.[position.value]?.key;
  const index = key ? current.findIndex(group => group.key === key) : -1;
  if (index !== -1) {
    position.value = index;
    return;
  }
  position.value = -1;
  emit('navigate', null);
});

async function step(delta) {
  const group = groups.value[position.value + delta];
  if (!group) {
    return;
  }
  position.value += delta;
  const section = groupEls.get(group.key);
  if (section && list.value) {
    list.value.scrollTop += section.getBoundingClientRect().top -
      list.value.getBoundingClientRect().top;
  }
  emit('navigate', group);
  // The button disabled at the end drops focus: hand it to the other one
  const atEnd = delta > 0
    ? position.value === groups.value.length - 1
    : position.value <= 0;
  if (atEnd) {
    await nextTick();
    const other = delta > 0 ? previousButton : nextButton;
    other.value?.$el.querySelector('button')?.focus();
  }
}

function focus() {
  backButton.value?.focus({ preventScroll: true });
}

// Shows the changes behind a marker of the body: those of the widget
// `widgetId` (and, when it `moved`, the order of its area), or those of the
// top-level field `field` outside any widget. Their rows expand alone,
// their group becomes the navigator's, and focus goes to the row's toggle.
// Resolves `false` when the list has no such row
async function reveal({
  field, widgetId, moved = false
}) {
  const isTarget = row => {
    const widget = row.path.findLast(segment => segment.widgetType);
    if (!widgetId) {
      return !widget && (row.path[0].name === field);
    }
    return (widget?.name === widgetId && row.fieldType !== 'area') ||
      (moved && row.fieldType === 'area' && row.new.includes(widgetId));
  };
  const targets = props.rows.filter(isTarget);
  if (!targets.length) {
    return false;
  }
  // A filter hiding any of them is lifted
  if (!targets.every(matches)) {
    filter.value = Object.entries(props.counts || {})
      .filter(([ , count ]) => count)
      .map(([ name ]) => name);
    // The navigator follows the new groups first, or it would read the
    // position set below against the old ones
    await nextTick();
  }
  const entries = groups.value
    .flatMap(group => group.entries.map(entry => ({
      group,
      entry
    })))
    .filter(({ entry }) => targets.includes(entry.row));
  expanded.clear();
  for (const { entry } of entries) {
    expanded.add(entry.key);
  }
  // The widget's own group rather than its area's order
  const { group, entry } = entries.find(({ entry }) => !entry.order) || entries[0];
  position.value = groups.value.indexOf(group);
  emit('navigate', group);
  await nextTick();
  const toggle = list.value?.querySelector(
    `[aria-controls="${CSS.escape(`${baseId}-${entry.key}`)}"]`
  );
  // The list alone scrolls: `scrollIntoView` would also push the sliding
  // panel around it sideways
  if (toggle && list.value) {
    const box = list.value.getBoundingClientRect();
    list.value.scrollTop += toggle.getBoundingClientRect().top -
      box.top - (box.height / 2);
    toggle.focus({ preventScroll: true });
  }
  return true;
}

defineExpose({
  focus,
  reveal
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

  // The icon component offsets its svg below the baseline; it sits in a
  // flex row and centers instead
  &__back-icon {
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
    flex: 1 1 auto;
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
      flex: 1 1 auto;
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

  &__value-line {
    display: flex;
    align-items: center;
    gap: $spacing-half;
  }

  &__value-icon {
    display: flex;
    flex-shrink: 0;

    :deep(.material-design-icon__svg) {
      bottom: 0;
    }

    .apos-doc-version-changes__pane--new & {
      color: var(--a-success-dark);
    }

    .apos-doc-version-changes__pane--old & {
      color: var(--a-danger-button-hover);
    }
  }

  &__value {
    @include type-base;

    & {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      font-size: var(--a-type-smaller);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }

    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }
  }

  &__mark {
    text-decoration-thickness: 1px;

    &--new {
      color: var(--a-success-dark);
      text-decoration-line: underline;
    }

    &--old {
      color: var(--a-danger-button-hover);
      text-decoration-line: line-through;
    }
  }

  // The side with no value, in its side's colour without a line
  &__none {
    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }
  }

  &__unchanged {
    @include type-base;

    & {
      margin: 0;
      padding: $spacing-half $spacing-base;
      color: var(--a-base-2);
      font-size: var(--a-type-smaller);
    }
  }

  &__nav {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-base;
    padding: $spacing-base $pad-x;
    border-top: 1px solid var(--a-base-8);
    background-color: var(--a-base-10);
  }

  &__nav-status {
    @include type-base;

    & {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
  }

  &__nav-position {
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
  }

  &__nav-buttons {
    display: flex;
    flex-shrink: 0;
    gap: $spacing-half;
  }
}
</style>
