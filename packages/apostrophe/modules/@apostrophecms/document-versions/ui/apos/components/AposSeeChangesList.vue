<template>
  <div class="apos-see-changes-list">
    <div
      ref="list"
      class="apos-see-changes-list__scroller"
      tabindex="-1"
      data-apos-test="see-changes-list"
    >
      <p
        v-if="!rows.length"
        class="apos-see-changes-list__empty"
        data-apos-test="see-changes-empty"
      >
        {{ $t('apostrophe:seeChangesNone') }}
      </p>
      <p
        v-else-if="!groups.length"
        class="apos-see-changes-list__empty"
        data-apos-test="see-changes-no-match"
      >
        {{ $t('apostrophe:versionNoChangesMatch') }}
      </p>
      <section
        v-for="(group, groupIndex) in groups"
        :key="group.key"
        :ref="el => setGroupEl(group.key, el)"
        class="apos-see-changes-list__group"
        :class="{ 'apos-see-changes-list__group--current': position === groupIndex }"
        data-apos-test="see-changes-group"
      >
        <AposDocVersionChangeGroup
          :group="group"
          :current="position === groupIndex"
          @select="select(groupIndex)"
        />
        <ul class="apos-see-changes-list__entries">
          <AposDocVersionChangeEntry
            v-for="entry in group.entries"
            :key="entry.key"
            :entry="entry"
            :expanded="expanded.has(entry.key)"
            :detail-id="`${baseId}-${entry.key}`"
            :labels="labels"
            :revealed="revealed"
            @toggle="toggle(entry.key, groupIndex)"
          >
            <template #meta>
              <p
                v-if="entry.row.authors?.length || entry.row.changedAt"
                class="apos-see-changes-list__credit"
                data-apos-test="see-changes-credit"
              >
                <span
                  v-if="entry.row.authors?.length"
                  data-apos-test="see-changes-authors"
                >{{ formatList(entry.row.authors.map(author => author.title)) }}</span>
                <span
                  v-if="entry.row.authors?.length && entry.row.changedAt"
                  aria-hidden="true"
                > · </span>
                <time
                  v-if="entry.row.changedAt"
                  v-apos-tooltip="formatDate(entry.row.changedAt)"
                  :datetime="entry.row.changedAt"
                  data-apos-test="see-changes-time"
                >{{ formatRelative(entry.row.changedAt, now) }}</time>
              </p>
            </template>
          </AposDocVersionChangeEntry>
        </ul>
      </section>
    </div>
    <AposDocVersionChangeNav
      v-if="groups.length"
      ref="nav"
      :path="position >= 0 ? groups[position].path : null"
      :position="position"
      :total="groups.length"
      position-label="apostrophe:seeChangesPosition"
      @step="step"
    >
      <span
        v-if="!onPage"
        class="apos-sr-only"
      >{{ $t('apostrophe:seeChangesNotOnPage') }}</span>
    </AposDocVersionChangeNav>
  </div>
</template>

<script setup>
// The changes of the draft since its last publication, a group per field
// or widget, the group changed most recently first. Each entry names who
// changed it and how long ago, and its detail compares the value with the
// published one, or with the default when the document was never published.
// The navigator at the bottom steps through the groups; a click on a group
// header goes to that one, and so does the first toggle of an entry in a
// group the navigator is not at.
// The list scrolls on its own and is no tab stop, which Firefox makes of a
// scroll container: its buttons are the stops, and the arrow keys scroll it
import {
  computed, nextTick, reactive, ref, useId, watch
} from 'vue';
import scroll from '../utils/scroll.js';
import changeGroups from '../lib/change-groups.js';
import locale from '../utils/locale.js';
import { useDocVersionNavigator } from '../composables/useDocVersionNavigator.js';

const props = defineProps({
  // The rows of the `draft-changes` route
  rows: {
    type: Array,
    required: true
  },
  // What the rows compare with, `{ kind: 'published' | 'default' }`
  baseline: {
    type: Object,
    default: null
  },
  // The checked filter options
  filter: {
    type: Array,
    default: () => []
  },
  // Whether the page shows the selected group
  onPage: {
    type: Boolean,
    default: true
  }
});

// `navigate` carries the group a step selected, or `null` when the
// selection is gone
const emit = defineEmits([ 'navigate', 'update:filter' ]);

const baseId = useId();
const list = ref(null);
const formatDate = locale.getDateFormatter();
const formatRelative = locale.getRelativeTimeFormatter();
const formatList = locale.getListFormatter();

// The keys of the entries showing their detail
const expanded = reactive(new Set());
// Bumped by a reveal: its entries show their text as when first expanded
const revealed = ref(0);
// Relative times count from when the rows came in
const now = ref(Date.now());

const labels = computed(() => ({
  new: 'apostrophe:seeChangesCurrent',
  old: (props.baseline?.kind === 'default')
    ? 'apostrophe:seeChangesDefaultValue'
    : 'apostrophe:seeChangesLastPublished'
}));

// A change no version recorded yet is the newest
const groups = computed(() => {
  const latest = group => Math.max(
    ...group.entries.map(entry => (entry.row.changedAt
      ? new Date(entry.row.changedAt).getTime()
      : Infinity))
  );
  return changeGroups.getChangeGroups(props.rows, props.filter)
    .map(group => ({
      group,
      at: latest(group)
    }))
    .sort((one, two) => (one.at === two.at ? 0 : two.at - one.at))
    .map(({ group }) => group);
});

// --- Navigator ---

const {
  position,
  nav,
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
  now.value = Date.now();
  resetNavigator();
});

// An entry of another group makes that group the navigator's first; within
// the group the navigator is at, it only opens or closes
function toggle(key, groupIndex) {
  if (position.value !== groupIndex) {
    select(groupIndex);
  }
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
}

// Shows the changes behind a marker of the page: those of the widget
// `widgetId` (and, when it `moved`, the order of its area), or those of the
// top-level field `field` outside any widget, `marked` as `isMarkerTarget`
// takes it. Their entries expand alone, their group becomes the
// navigator's, and focus goes to the entry's toggle. Resolves `false` when
// the list has no such row
async function reveal(target) {
  const targets = props.rows.filter(row => changeGroups.isMarkerTarget(row, target));
  if (!targets.length) {
    return false;
  }
  // A filter hiding any of them is lifted
  if (!targets.every(row => changeGroups.matchesFilter(row, props.filter))) {
    emit('update:filter', []);
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
  // An entry with nothing to expand has no button: its group's header then
  const button = list.value?.querySelector(
    `[aria-controls="${CSS.escape(`${baseId}-${entry.key}`)}"]`
  ) || getGroupEl(group.key)?.querySelector(
    '[data-apos-test="doc-version-change-group-select"]'
  );
  if (button && list.value) {
    // The group's header at the top, as a navigator step leaves it. An
    // entry too far down its group to show that way is centred instead
    const section = getGroupEl(group.key);
    const box = list.value.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (section && (rect.bottom - section.getBoundingClientRect().top <= box.height)) {
      scrollToGroup(group);
    } else {
      list.value.scrollBy({
        top: rect.top - box.top - (box.height / 2),
        behavior: scroll.getScrollBehavior()
      });
    }
    button.focus({ preventScroll: true });
  }
  return true;
}

defineExpose({
  reveal
});
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;
// The entry's chevron and the gap after it
$chevron-x: 14px + $spacing-half;

.apos-see-changes-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--a-background-primary);

  &__scroller {
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

  // Above the sticky header and the entries
  &__group--current {
    position: relative;

    &::after {
      content: '';
      z-index: $z-index-default;
      position: absolute;
      inset: 0;
      border: 1px solid var(--a-primary);
      pointer-events: none;
    }
  }

  // Its own stacking context, so nothing in an entry rises above the sticky
  // group header when it scrolls under it
  &__entries {
    @include apos-list-reset();

    & {
      isolation: isolate;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  }

  // Under the entry's label
  &__credit {
    margin: (-$spacing-one-quarter) 0 0;
    padding: 0 $pad-x $spacing-half ($pad-x + $chevron-x);
    color: var(--a-base-1);
    font-size: var(--a-type-smaller);
    line-height: var(--a-line-base);
  }
}
</style>
