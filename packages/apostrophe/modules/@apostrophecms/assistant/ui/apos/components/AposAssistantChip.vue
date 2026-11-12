<template>
  <span
    class="apos-assistant-chip"
    :class="{ 'apos-assistant-chip--action': actionLabel }"
    :title="title"
    data-apos-test="assistant-chip"
    :data-kind="kind"
  >
    <svg
      class="apos-assistant-chip__icon"
      :viewBox="icon.viewBox"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        :d="icon.path"
      />
    </svg>
    <button
      v-if="removeLabel"
      type="button"
      class="apos-assistant-chip__remove"
      :aria-label="removeLabel"
      data-apos-test="assistant-chip-remove"
      @click="emit('remove', $event)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 6l12 12M18 6 6 18"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <button
      v-if="actionLabel"
      type="button"
      class="apos-assistant-chip__title apos-assistant-chip__action"
      :aria-label="actionLabel"
      data-apos-test="assistant-chip-action"
      @click="emit('action', $event)"
    >{{ title }}</button>
    <span
      v-else
      class="apos-assistant-chip__title"
    >{{ title }}</span>
  </span>
</template>

<script setup>
// A chip: a document mentioned or a widget selected. The composer's editing
// area builds the same markup as plain DOM (`lib/chip.js`) and the server
// renders it in sent messages, which is why the styles below are not scoped
import { computed } from 'vue';
import { getChipIcon } from '../lib/chip.js';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  // `page`, `piece`, `image` or `widget`
  kind: {
    type: String,
    required: true
  },
  // A chip that can be removed names its button
  removeLabel: {
    type: String,
    default: null
  },
  // A chip that acts on a click names what it does; its title is the button
  actionLabel: {
    type: String,
    default: null
  }
});
const emit = defineEmits([ 'remove', 'action' ]);

const icon = computed(() => getChipIcon(props.kind));
</script>

<style lang="scss">
  .apos-assistant-chip {
    position: relative;
    top: -1.5px;
    display: inline-flex;
    align-items: center;
    max-width: min(100%, 15rem);
    margin-inline: 2px;
    padding: 3px 7px;
    border: 1px solid var(--a-primary);
    color: var(--a-primary);
    font-size: var(--a-type-smaller);
    line-height: var(--a-line-tall);
    vertical-align: middle;
    white-space: nowrap;
    cursor: default;
    gap: 4px;
    border-radius: var(--a-border-radius);
    background-color: color-mix(in srgb, var(--a-primary) 8%, var(--a-background-primary));
    user-select: none;
  }

  .apos-assistant-chip__icon {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
  }

  // A chip that acts: in a sent message or a reply, a link to the
  // document's page or a button that opens its editor; in the composer, a
  // chip whose title is a button
  .apos-assistant-chip--action {
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    appearance: none;

    &:hover {
      background-color: color-mix(in srgb, var(--a-primary) 16%, var(--a-background-primary));
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
    }
  }

  // Over the icon, and still focusable while it doesn't show
  .apos-assistant-chip__remove {
    @include apos-button-reset();

    & {
      position: absolute;
      top: 50%;
      left: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      color: var(--a-primary);
      cursor: pointer;
      opacity: 0;
      transform: translateY(-50%);
    }

    svg {
      width: 10px;
      height: 10px;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
      border-radius: 2px;
    }
  }

  .apos-assistant-chip__title {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
  }

  .apos-assistant-chip__action {
    @include apos-button-reset();

    & {
      color: inherit;
      font: inherit;
      line-height: inherit;
      cursor: pointer;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }

  .apos-assistant-chip:hover .apos-assistant-chip__remove,
  .apos-assistant-chip:focus-within .apos-assistant-chip__remove {
    opacity: 1;
  }

  // A removable chip shows its button in place of its icon
  .apos-assistant-chip:has(.apos-assistant-chip__remove):hover .apos-assistant-chip__icon,
  .apos-assistant-chip:has(.apos-assistant-chip__remove):focus-within .apos-assistant-chip__icon {
    opacity: 0;
  }
</style>
