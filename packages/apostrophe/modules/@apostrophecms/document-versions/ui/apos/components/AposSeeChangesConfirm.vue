<template>
  <div
    ref="root"
    class="apos-see-changes-confirm"
    role="group"
    tabindex="-1"
    :aria-labelledby="titleId"
    data-apos-test="see-changes-confirm"
    @keyup.esc.stop="$emit('cancel')"
  >
    <p
      :id="titleId"
      class="apos-see-changes-confirm__title"
    >
      {{ $t(title) }}
    </p>
    <div
      class="apos-see-changes-confirm__value"
      data-apos-test="see-changes-confirm-value"
    >
      <template v-if="item">
        <span class="apos-see-changes-confirm__type">{{ $t(item.type) }}</span>
        <template v-if="item.title">
          <span aria-hidden="true"> · </span>
          <span>{{ item.title }}</span>
        </template>
      </template>
      <template v-else-if="images">
        <span
          v-for="(image, index) in images"
          :key="index"
          class="apos-see-changes-confirm__image"
        >
          <img
            :src="`${image.href}?size=one-sixth`"
            alt=""
          >
          {{ image.text }}
        </span>
      </template>
      <span
        v-else-if="entry.row.oldText"
        ref="text"
        class="apos-see-changes-confirm__text"
        :class="{ 'apos-see-changes-confirm__text--cut': cut }"
      >{{ entry.row.oldText }}</span>
      <span
        v-else
        class="apos-see-changes-confirm__empty"
      >{{ $t('apostrophe:versionEmptyValue') }}</span>
    </div>
    <p
      v-if="invalid"
      class="apos-see-changes-confirm__invalid"
      role="alert"
      data-apos-test="see-changes-confirm-invalid"
    >
      {{ $t('apostrophe:seeChangesRestoreInvalid') }}
    </p>
    <div class="apos-see-changes-confirm__controls">
      <AposButton
        class="apos-see-changes-confirm__cancel"
        type="quiet"
        label="apostrophe:cancel"
        :attrs="{ 'data-apos-test': 'see-changes-confirm-cancel' }"
        @click="$emit('cancel')"
      />
      <AposButton
        v-if="editable"
        class="apos-see-changes-confirm__cancel"
        type="quiet"
        label="apostrophe:edit"
        :attrs="{ 'data-apos-test': 'see-changes-confirm-edit' }"
        @click="$emit('edit')"
      />
      <AposButton
        type="primary"
        :label="removes
          ? 'apostrophe:seeChangesRemoveConfirm'
          : 'apostrophe:seeChangesRestoreConfirm'"
        :modifiers="[ 'small' ]"
        :busy="busy"
        :disabled="busy"
        :attrs="{ 'data-apos-test': 'see-changes-confirm-restore' }"
        @click="$emit('restore')"
      />
    </div>
  </div>
</template>

<script setup>
// Asks before a restore, showing what it returns to: the older value as the
// entry's detail reads it, or for a whole widget or item, its type and
// title. An entry that can be edited offers its editor instead
import {
  computed, nextTick, onMounted, ref, useId
} from 'vue';

const props = defineProps({
  // An entry of `change-groups.js` with a `restore`
  entry: {
    type: Object,
    required: true
  },
  // What the rows compare with, `published` or `default`
  baseline: {
    type: String,
    default: 'published'
  },
  // Whether the restore is being saved
  busy: {
    type: Boolean,
    default: false
  },
  // Whether the server refused the value as invalid
  invalid: {
    type: Boolean,
    default: false
  },
  // Whether the entry can be edited instead
  editable: {
    type: Boolean,
    default: false
  }
});

defineEmits([ 'cancel', 'restore', 'edit' ]);

const titleId = useId();
const root = ref(null);
const text = ref(null);
// Whether the text is cut short by its height
const cut = ref(false);

const whole = computed(() => [ 'widget', 'arrayItem' ].includes(props.entry.row.kind));
const listed = computed(() => whole.value &&
  [ 'added', 'deleted' ].includes(props.entry.row.type));
const removes = computed(() => listed.value && (props.entry.row.type === 'added'));

const title = computed(() => {
  if (listed.value) {
    const what = (props.entry.row.kind === 'widget') ? 'Widget' : 'Item';
    return removes.value
      ? `apostrophe:seeChangesRemoveAdded${what}`
      : `apostrophe:seeChangesRestoreDeleted${what}`;
  }
  return (props.baseline === 'default')
    ? 'apostrophe:seeChangesRestoreDefault'
    : 'apostrophe:seeChangesRestorePublished';
});

// A widget by its type's label and its title, an item by its array's label
// and its own
const item = computed(() => {
  if (!whole.value) {
    return null;
  }
  const { row } = props.entry;
  const segment = row.path.at(-1);
  if (row.kind === 'widget') {
    return {
      type: segment.label,
      title: removes.value ? row.newText : row.oldText
    };
  }
  return {
    type: row.path.at(-2)?.label || '',
    title: segment.label
  };
});

const images = computed(() => props.entry.images.old || null);

onMounted(async () => {
  await nextTick();
  const el = text.value;
  cut.value = Boolean(el) && (el.scrollHeight > el.clientHeight + 1);
});

function focus() {
  root.value?.focus();
}

defineExpose({
  focus
});
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

// Inset as the entry's detail is
.apos-see-changes-confirm {
  overflow: hidden;
  margin: $spacing-one-quarter $pad-x $spacing-base;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  background-color: var(--a-background-primary);

  &:focus-visible {
    outline: 2px solid var(--a-primary);
    outline-offset: 1px;
  }

  &__title {
    @include type-base;

    & {
      margin: 0;
      padding: $spacing-base $spacing-base 0;
      font-size: var(--a-type-label);
      line-height: var(--a-line-tall);
    }
  }

  &__value {
    @include type-base;

    & {
      margin: $spacing-three-quarters $spacing-base $spacing-base;
      padding: $spacing-half $spacing-three-quarters;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius);
      color: var(--a-base-1);
      background-color: var(--a-base-10);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }
  }

  &__type {
    font-weight: var(--a-weight-bold);
  }

  // Long text shows its first lines, fading out
  &__text {
    display: block;
    overflow: hidden;
    max-height: calc(4 * var(--a-line-tall) * 1em);
    white-space: pre-line;
  }

  &__text--cut {
    mask-image: linear-gradient(to bottom, #000 50%, transparent);
  }

  &__empty {
    color: var(--a-base-2);
    font-style: italic;
  }

  &__image {
    display: block;

    & + & {
      margin-top: $spacing-half;
    }

    img {
      display: block;
      max-width: 120px;
      height: 64px;
      margin-bottom: $spacing-one-quarter;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius);
      background-color: var(--a-background-primary);
      object-fit: contain;
    }
  }

  &__invalid {
    margin: 0 $spacing-base $spacing-base;
    color: var(--a-danger);
    font-size: var(--a-type-smaller);
    line-height: var(--a-line-tall);
  }

  &__controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-base;
    padding: $spacing-half $spacing-base;
    border-top: 1px solid var(--a-base-8);
  }

  &__cancel :deep(.apos-button) {
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
  }
}
</style>
