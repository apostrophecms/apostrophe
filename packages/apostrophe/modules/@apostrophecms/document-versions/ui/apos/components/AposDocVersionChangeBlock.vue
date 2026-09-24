<template>
  <div
    class="apos-doc-version-changes__block"
    data-apos-test="doc-version-change-block"
  >
    <ul
      v-if="entry.order"
      ref="valueRef"
      class="apos-doc-version-changes__block-value apos-doc-version-changes__order"
      :class="{ 'apos-doc-version-changes__block-value--clamped': !full }"
      data-apos-test="doc-version-change-block-value"
    >
      <li
        v-for="(part, index) in parts"
        :key="index"
        data-apos-test="doc-version-change-order-item"
        :data-apos-order-change="part.change"
      >
        <template v-if="part.change === 'elided'">
          <span
            class="apos-doc-version-changes__elided"
            aria-hidden="true"
          >…</span>
          <span class="apos-sr-only">{{ $t('apostrophe:versionUnchangedItemsOmitted') }}</span>
        </template>
        <component
          :is="marks[part.change].tag"
          v-else-if="marks[part.change]"
          :data-apos-version-change="part.change"
        >
          <span class="apos-sr-only">{{ `${$t(marks[part.change].label)} ` }}</span>{{ part.text }}
        </component>
        <template v-else>
          {{ part.text }}
        </template>
      </li>
    </ul>
    <p
      v-else
      ref="valueRef"
      class="apos-doc-version-changes__block-value apos-doc-version-changes__block-value--text"
      :class="{ 'apos-doc-version-changes__block-value--clamped': !full }"
      data-apos-test="doc-version-change-block-value"
    >
      <template
        v-for="(part, index) in parts"
        :key="index"
      >
        <template v-if="part.change === 'elided'">
          <span
            class="apos-doc-version-changes__elided"
            aria-hidden="true"
          > … </span>
          <span class="apos-sr-only">{{ ` ${$t('apostrophe:versionUnchangedOmitted')} ` }}</span>
        </template>
        <component
          :is="marks[part.change].tag"
          v-else-if="marks[part.change]"
          :data-apos-version-change="part.change"
        >
          <span class="apos-sr-only">{{ `${$t(marks[part.change].label)} ` }}</span>{{ part.text }}
        </component>
        <span v-else>{{ part.text }}</span>
      </template>
    </p>
  </div>
  <AposDocVersionChangeMore
    v-if="entry.elided || clamped || full"
    v-model="full"
  />
</template>

<script setup>
// A change as one block rather than two sides: the words of a rich text in
// reading order, removed ones struck through where they were and added ones
// where they are, or the items of an array or area one to a line, the ones
// that moved removed where they were and added where they are. Cut short, as
// the sides are, until the full text is asked for
import {
  computed, nextTick, onMounted, ref
} from 'vue';

const props = defineProps({
  // An entry of a change group, of the `block` layout
  entry: {
    type: Object,
    required: true
  }
});

const marks = {
  added: {
    tag: 'ins',
    label: 'apostrophe:versionAddedText'
  },
  removed: {
    tag: 'del',
    label: 'apostrophe:versionRemovedText'
  }
};

const valueRef = ref(null);
// Whether the text shows in full, and whether its height cut it short
const full = ref(false);
const clamped = ref(false);

const parts = computed(() => (full.value ? props.entry.inline : props.entry.inlineShort));

onMounted(async () => {
  await nextTick();
  clamped.value = valueRef.value.scrollHeight > valueRef.value.clientHeight + 1;
});
</script>

<style lang="scss" scoped>
.apos-doc-version-changes {
  // No background, the padding of a side
  &__block {
    padding: $spacing-half $spacing-base $spacing-base;
  }

  &__block-value {
    @include type-base;

    & {
      font-size: var(--a-type-smaller);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }

    &--clamped {
      overflow: hidden;
      max-height: calc(8 * var(--a-line-tall) * 1em);
    }

    // Plaintext of rich text has a line for every block
    &--text {
      margin: 0;
      white-space: pre-line;
    }

    // The marks as the body shows them
    [data-apos-version-change] {
      padding: 0 2px;
      border-radius: var(--a-border-radius);
      text-decoration-thickness: 1px;
    }

    ins[data-apos-version-change] {
      color: var(--a-success-dark);
      background-color: var(--a-success-fade);
      text-decoration-line: underline;
    }

    del[data-apos-version-change] {
      color: var(--a-danger-button-hover);
      background-color: var(--a-danger-fade);
      text-decoration-line: line-through;
    }
  }

  &__elided {
    color: var(--a-base-2);
  }

  &__order {
    @include apos-list-reset();
  }
}
</style>
