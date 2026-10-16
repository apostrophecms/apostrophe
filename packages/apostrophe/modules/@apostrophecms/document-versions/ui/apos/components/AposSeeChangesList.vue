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
      <TransitionGroup
        :css="false"
        @leave="onLeave"
      >
        <section
          v-for="(group, groupIndex) in groups"
          :key="group.key"
          :ref="el => setGroupEl(group.key, el)"
          class="apos-see-changes-list__group"
          :class="{
            'apos-see-changes-list__group--current': position === groupIndex,
            'apos-see-changes-list__leaving': group.entries
              .every(entry => leaving.has(idOf(entry.row)))
          }"
          data-apos-test="see-changes-group"
        >
          <AposDocVersionChangeGroup
            :group="group"
            :current="position === groupIndex"
            @select="select(groupIndex)"
          />
          <TransitionGroup
            tag="ul"
            class="apos-see-changes-list__entries"
            :css="false"
            @leave="onLeave"
          >
            <AposDocVersionChangeEntry
              v-for="entry in group.entries"
              :key="idOf(entry.row)"
              :class="{ 'apos-see-changes-list__leaving': leaving.has(idOf(entry.row)) }"
              :entry="entry"
              :expanded="expanded.has(idOf(entry.row))"
              :detail-id="`${baseId}-${entry.key}`"
              :labels="labels"
              :revealed="revealed"
              @toggle="toggle(idOf(entry.row), groupIndex)"
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
              <template
                v-if="entry.row.restore"
                #actions
              >
                <AposButton
                  :ref="el => setRestoreEl(idOf(entry.row), el)"
                  class="apos-see-changes-list__action"
                  :class="{
                    'apos-see-changes-list__action--shown': expanded.has(idOf(entry.row)) ||
                      (confirming === idOf(entry.row))
                  }"
                  type="quiet"
                  label="apostrophe:restore"
                  :disabled="restoring"
                  :attrs="{ 'data-apos-test': 'see-changes-restore' }"
                  @click="openConfirm(entry)"
                />
              </template>
              <template
                v-if="confirming === idOf(entry.row)"
                #panel
              >
                <AposSeeChangesConfirm
                  :ref="el => el && (confirm = el)"
                  :entry="entry"
                  :baseline="baseline?.kind"
                  :busy="saving"
                  :invalid="invalid"
                  @cancel="cancel"
                  @restore="restore(entry)"
                />
              </template>
            </AposDocVersionChangeEntry>
          </TransitionGroup>
        </section>
      </TransitionGroup>
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
// group the navigator is not at. An entry that can be restored asks first,
// then leaves the list once the restore is saved.
// The list scrolls on its own and is no tab stop, which Firefox makes of a
// scroll container: its buttons are the stops, and the arrow keys scroll it
import {
  computed, nextTick, reactive, ref, useId, watch
} from 'vue';
import scroll from '../utils/scroll.js';
import changeGroups from '../lib/change-groups.js';
import locale from '../utils/locale.js';
import { useDocVersionNavigator } from '../composables/useDocVersionNavigator.js';
import { useSeeChangesStore } from '../stores/seeChanges.js';

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
const store = useSeeChangesStore();
const formatDate = locale.getDateFormatter();
const formatRelative = locale.getRelativeTimeFormatter();
const formatList = locale.getListFormatter();

// Which row an entry shows, the same when the rows reload
const idOf = row => [ row.kind, ...row.path.map(segment => segment.name) ].join('.');

// The entries showing their detail, by `idOf`
const expanded = reactive(new Set());
// The entry asking before its restore, by `idOf`
const confirming = ref(null);
const confirm = ref(null);
const restoreEls = new Map();
// From a click until the rows reload: the patches are exact against the
// draft the rows were computed from
const restoring = ref(false);
const saving = ref(false);
// Whether the server refused the value as invalid
const invalid = ref(false);
// A restored entry leaves animated, then stays out until the rows reload
const leaving = reactive(new Set());
const gone = reactive(new Set());

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
  const rows = props.rows.filter(row => !gone.has(idOf(row)));
  return changeGroups.getChangeGroups(rows, props.filter)
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
  select,
  step,
  scrollToGroup
} = useDocVersionNavigator({
  groups,
  list,
  onNavigate: group => emit('navigate', group)
});

// What still shows keeps its place: the navigator follows its group, and
// open entries and the confirmation stay open
watch(() => props.rows, rows => {
  const ids = new Set(rows.map(idOf));
  for (const id of expanded) {
    if (!ids.has(id)) {
      expanded.delete(id);
    }
  }
  if (!ids.has(confirming.value)) {
    confirming.value = null;
  }
  leaving.clear();
  gone.clear();
  restoring.value = false;
  invalid.value = false;
  now.value = Date.now();
});

// An entry of another group makes that group the navigator's first; within
// the group the navigator is at, it only opens or closes. Closing an entry
// that asks before its restore closes the question too
function toggle(id, groupIndex) {
  if (position.value !== groupIndex) {
    select(groupIndex);
  }
  if (confirming.value === id) {
    confirming.value = null;
    invalid.value = false;
  }
  if (expanded.has(id)) {
    expanded.delete(id);
  } else {
    expanded.add(id);
  }
}

// --- Restore ---

function setRestoreEl(id, el) {
  if (el) {
    restoreEls.set(id, el);
  } else {
    restoreEls.delete(id);
  }
}

// The question shows in place of the entry's detail, which opens with it
// and stays open after a cancel
async function openConfirm(entry) {
  const id = idOf(entry.row);
  if (entry.detail) {
    expanded.add(id);
  }
  if (confirming.value !== id) {
    confirming.value = id;
    invalid.value = false;
  }
  await nextTick();
  confirm.value?.focus();
}

async function cancel() {
  const id = confirming.value;
  confirming.value = null;
  invalid.value = false;
  await nextTick();
  restoreEls.get(id)?.$el.querySelector('button')?.focus();
}

// Saved as any edit of the page is, so it can be undone
function restore(entry) {
  const { row } = entry;
  const id = idOf(row);
  restoring.value = true;
  saving.value = true;
  invalid.value = false;
  apos.bus.$emit('context-edited', {
    patch: row.restore.patch,
    inverse: row.restore.inverse,
    target: {
      docId: store.docId,
      widgetId: row.path.filter(segment => segment.widgetType).at(-1)?.name,
      patchKey: row.patchKey
    },
    onSaved: error => (error ? refused(error) : leave(id))
  });
}

async function leave(id) {
  saving.value = false;
  confirming.value = null;
  // Its buttons go with it
  list.value?.focus({ preventScroll: true });
  leaving.add(id);
  await nextTick();
  gone.add(id);
}

function refused(error) {
  saving.value = false;
  restoring.value = false;
  if ((error.body?.name === 'invalid') && error.body.data?.errors?.length) {
    invalid.value = true;
    return;
  }
  // The context bar tells of a lost lock, and the mode ends with it
  if (error.body?.name === 'locked') {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(error);
  apos.notify('apostrophe:changeNotSaved', {
    type: 'error',
    icon: 'alert-circle-icon'
  });
  cancel();
}

// Folds a restored entry, or its group with the last one, away; anything
// else the list drops goes at once
function onLeave(el, done) {
  if (
    !el.classList.contains('apos-see-changes-list__leaving') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    done();
    return;
  }
  el.style.overflow = 'hidden';
  el.animate([
    {
      height: `${el.offsetHeight}px`,
      opacity: 1
    },
    {
      height: '0px',
      opacity: 0
    }
  ], {
    duration: 250,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
  }).finished.then(done, done);
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
    expanded.add(idOf(entry.row));
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

  &__action :deep(.apos-button) {
    font-size: var(--a-type-smaller);
  }

  // Under the entry's label
  &__credit {
    margin: (-$spacing-one-quarter) 0 0;
    padding: 0 $pad-x $spacing-half ($pad-x + $chevron-x);
    color: var(--a-base-1);
    font-size: var(--a-type-smaller);
    line-height: var(--a-line-base);
  }

  // Shown on hover and while its entry is open, which a tap does, and to the
  // keyboard when focused
  &__entries :deep(.apos-doc-version-changes__row:not(:hover)) {
    .apos-see-changes-list__action:not(
      .apos-see-changes-list__action--shown,
      :has(:focus-visible)
    ) {
      opacity: 0;
    }
  }
}
</style>
