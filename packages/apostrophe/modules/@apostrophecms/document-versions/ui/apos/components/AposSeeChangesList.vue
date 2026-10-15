<template>
  <div
    class="apos-see-changes-list"
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
      v-for="group in groups"
      :key="group.key"
      class="apos-see-changes-list__group"
      data-apos-test="see-changes-group"
    >
      <AposDocVersionChangeGroup :group="group" />
      <ul class="apos-see-changes-list__entries">
        <AposDocVersionChangeEntry
          v-for="entry in group.entries"
          :key="entry.key"
          :entry="entry"
          :expanded="expanded.has(entry.key)"
          :detail-id="`${baseId}-${entry.key}`"
          :labels="labels"
          @toggle="toggle(entry.key)"
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
</template>

<script setup>
// The changes of the draft since its last publication, a group per field
// or widget, the group changed most recently first. Each entry names who
// changed it and how long ago, and its detail compares the value with the
// published one, or with the default when the document was never published.
// The list scrolls on its own and is no tab stop, which Firefox makes of a
// scroll container: its buttons are the stops, and the arrow keys scroll it
import {
  computed, reactive, ref, useId, watch
} from 'vue';
import changeGroups from '../lib/change-groups.js';
import locale from '../utils/locale.js';

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
  }
});

const baseId = useId();
const formatDate = locale.getDateFormatter();
const formatRelative = locale.getRelativeTimeFormatter();
const formatList = locale.getListFormatter();

// The keys of the entries showing their detail
const expanded = reactive(new Set());
// Relative times count from when the rows came in
const now = ref(Date.now());

watch(() => props.rows, () => {
  expanded.clear();
  now.value = Date.now();
});

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

function toggle(key) {
  if (expanded.has(key)) {
    expanded.delete(key);
  } else {
    expanded.add(key);
  }
}
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;
// The entry's chevron and the gap after it
$chevron-x: 14px + $spacing-half;

.apos-see-changes-list {
  overflow: hidden auto;
  height: 100%;
  background-color: var(--a-background-primary);

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
