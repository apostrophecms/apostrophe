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
        <span>{{ $t('apostrophe:versionChanges') }}</span>
        <span
          class="apos-doc-version-changes__count"
          data-apos-test="doc-version-changes-count"
        >
          <span class="apos-doc-version-changes__dot">·</span>
          {{ $t('apostrophe:versionEdits', { count: rows.length }) }}
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
        v-for="(group, groupIndex) in groups"
        :key="group.key"
        :ref="el => setGroupEl(group.key, el)"
        class="apos-doc-version-changes__group"
        :class="{ 'apos-doc-version-changes__group--current': position === groupIndex }"
        data-apos-test="doc-version-change-group"
      >
        <h3 class="apos-doc-version-changes__group-header">
          <button
            type="button"
            class="apos-doc-version-changes__group-title"
            :aria-current="position === groupIndex ? 'true' : undefined"
            data-apos-test="doc-version-change-group-select"
            @click="select(groupIndex)"
          >
            <AposDocVersionChangePath
              :segments="group.path"
            />
            <span class="apos-sr-only">{{ `, ${$t('apostrophe:versionNavShow')}` }}</span>
          </button>
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
                <AposDocVersionAiBadge
                  v-if="entry.row.ai"
                  v-apos-tooltip="'apostrophe:versionAiChangeTooltip'"
                  data-apos-test="doc-version-change-ai"
                />
                <AposButton
                  v-if="entry.detail"
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
                <AposDocVersionChangeType
                  v-else-if="!entry.own"
                  :type="entry.row.type"
                />
              </span>
            </div>
            <div
              v-if="entry.detail && expanded.has(entry.key)"
              :id="`${baseId}-${entry.key}`"
              class="apos-doc-version-changes__diff"
              data-apos-test="doc-version-change-diff"
            >
              <AposDocVersionChangeText
                v-if="entry.changed"
                :key="revealed"
                :entry="entry"
              />
              <AposDocVersionChangeFormat
                v-if="entry.format.length"
                :lines="entry.format"
              />
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
// the groups the filter shows; a click on a group header goes to that one.
import {
  computed, inject, nextTick, reactive, ref, useId, watch
} from 'vue';
import scroll from '../utils/scroll.js';
import changeGroups from '../lib/change-groups.js';
import { useDocVersionNavigator } from '../composables/useDocVersionNavigator.js';

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

// The keys of the rows showing their values
const expanded = reactive(new Set());
// Bumped by a reveal: its rows show their text as when first expanded
const revealed = ref(0);
// The checked filter options
const filter = ref([]);

function toggle(key) {
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
}

function matches(row) {
  return changeGroups.matchesFilter(row, filter.value);
}

const shownRows = computed(() => props.rows.filter(matches));

const groups = computed(() => changeGroups.getChangeGroups(props.rows, filter.value));

// --- Navigator ---

const {
  position,
  previousButton,
  nextButton,
  setGroupEl,
  getGroupEl,
  reset: resetNavigator,
  select,
  step,
  scrollToGroup
} = useDocVersionNavigator({
  groups,
  list,
  onNavigate: group => emit('navigate', group)
});

watch(() => props.rows, () => {
  expanded.clear();
  filter.value = changeGroups.getDefaultFilter(props.counts);
  resetNavigator();
}, { immediate: true });

function focus() {
  backButton.value?.focus({ preventScroll: true });
}

// Shows the changes behind a marker of the body: those of the widget
// `widgetId` (and, when it `moved`, the order of its area), or those of the
// top-level field `field` outside any widget. Their rows expand alone,
// their group becomes the navigator's, and focus goes to the row's toggle.
// Resolves `false` when the list has no such row
async function reveal(target) {
  const targets = props.rows.filter(row => changeGroups.isMarkerTarget(row, target));
  if (!targets.length) {
    return false;
  }
  // A filter hiding any of them is lifted
  if (!targets.every(matches)) {
    filter.value = changeGroups.getDefaultFilter(props.counts);
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
  revealed.value++;
  for (const { entry } of entries.filter(({ entry }) => entry.detail)) {
    expanded.add(entry.key);
  }
  // The widget's own group rather than its area's order
  const { group, entry } = entries.find(({ entry }) => !entry.order) || entries[0];
  select(groups.value.indexOf(group));
  await nextTick();
  // A row with nothing to expand has no toggle: its group's header then
  const toggle = list.value?.querySelector(
    `[aria-controls="${CSS.escape(`${baseId}-${entry.key}`)}"]`
  ) || getGroupEl(group.key)?.querySelector(
    '[data-apos-test="doc-version-change-group-select"]'
  );
  // The list alone scrolls: `scrollIntoView` would also push the sliding
  // panel around it sideways
  if (toggle && list.value) {
    // The group's header at the top, as a navigator step leaves it. A row
    // too far down its group to show that way is centred instead
    const section = getGroupEl(group.key);
    const box = list.value.getBoundingClientRect();
    const rect = toggle.getBoundingClientRect();
    if (section && (rect.bottom - section.getBoundingClientRect().top <= box.height)) {
      scrollToGroup(group);
    } else {
      list.value.scrollBy({
        top: rect.top - box.top - (box.height / 2),
        behavior: scroll.getScrollBehavior()
      });
    }
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
    @include type-base;

    & {
      display: flex;
      box-sizing: border-box;
      flex-shrink: 0;
      align-items: center;
      gap: $spacing-half;
      width: 100%;
      padding: $spacing-base $pad-x $spacing-base ($spacing-base + $spacing-one-quarter);
      border-bottom: 1px solid var(--a-base-8);
      background-color: var(--a-base-10);
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
      line-height: 1;
    }
  }

  &__count {
    display: inline-flex;
    align-items: center;
    gap: $spacing-half;
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
    font-weight: var(--a-weight-base);
    line-height: 1;
  }

  &__dot {
    font-size: var(--a-type-large);
    line-height: 1;
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
      z-index: $z-index-default;
      position: sticky;
      top: 0;
      display: flex;
      overflow: hidden;
      align-items: center;
      gap: $spacing-base;
      margin: 0;
      padding: $spacing-base $pad-x;
      border-bottom: 1px solid var(--a-base-7);
      background-color: var(--a-base-9);
    }

    // Same bar as the current group; off-canvas until hover
    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 3px;
      background-color: var(--a-primary);
      transform: translateX(-100%);
      transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    &:hover::before,
    &:focus-within::before {
      transform: translateX(-1px);
    }
  }

  // The group the navigator is at
  &__group--current &__group-header::before {
    transform: translateX(0);
  }

  &__group-title {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  // Its own stacking context, so nothing in a row (the buttons' layers)
  // rises above the sticky group header when it scrolls under it
  &__rows {
    @include apos-list-reset();

    & {
      isolation: isolate;
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

  &__diff {
    overflow: hidden;
    margin-top: $spacing-base;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
  }

  &__pane + &__format {
    border-top: 1px solid var(--a-base-8);
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
