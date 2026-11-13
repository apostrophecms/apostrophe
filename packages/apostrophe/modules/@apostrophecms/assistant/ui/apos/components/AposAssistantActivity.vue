<template>
  <div
    class="apos-assistant-activity"
    :class="`apos-assistant-activity--${tone}`"
    :role="(tone === 'error') ? 'alert' : 'status'"
    data-apos-test="assistant-activity"
    :data-apos-tone="tone"
  >
    <p
      class="apos-assistant-activity__title"
      :class="{ 'apos-assistant-activity__title--dismissible': dismissLabel }"
    >
      {{ title }}
    </p>
    <button
      v-if="dismissLabel"
      type="button"
      class="apos-assistant-activity__dismiss"
      :aria-label="dismissLabel"
      :title="dismissLabel"
      data-apos-test="assistant-activity-dismiss"
      @click="emit('dismiss')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
      </svg>
    </button>
    <p
      v-if="text"
      class="apos-assistant-activity__text"
    >
      {{ text }}
    </p>
    <slot />
    <div
      v-if="actions.length"
      class="apos-assistant-activity__actions"
    >
      <button
        v-for="action in actions"
        :key="action.name"
        :ref="el => action.focus && (focused = el)"
        type="button"
        class="apos-assistant-activity__action"
        :class="`apos-assistant-activity__action--${action.kind || 'text'}`"
        :aria-disabled="action.disabled ? 'true' : null"
        :data-apos-test="`assistant-activity-${action.name}`"
        @click="!action.disabled && emit('action', action.name)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

// The activity slot under a request: what went wrong, what needs a look
// or a decision, and what happened besides the reply. Error and lock
// errors use the error tone. The default slot takes more than a line of
// text
defineProps({
  // 'error', 'warning' or 'general'
  tone: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  text: {
    type: String,
    default: null
  },
  // `{ name, label, kind?, disabled?, focus? }`, kind 'text' (the
  // default), or 'primary' and 'quiet' for a decision; `focus` takes the
  // focus when the slot appears
  actions: {
    type: Array,
    default: () => []
  },
  // A × at the end of the title that emits `dismiss`, labelled so
  dismissLabel: {
    type: String,
    default: null
  }
});

const emit = defineEmits([ 'action', 'dismiss' ]);
const focused = ref(null);

onMounted(() => focused.value?.focus());
</script>

<style lang="scss" scoped>
  // The theme's red, darkened to read at 4.5:1 on the error tone
  .apos-assistant-activity {
    --apos-assistant-activity-action: color-mix(in srgb, var(--a-danger) 80%, var(--a-black));

    & {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 16px;
      border-radius: var(--a-border-radius-large);
      color: var(--a-text-primary);
      background-color: var(--a-danger-button-background);
    }
  }

  .apos-assistant-activity__dismiss {
    @include apos-button-reset();

    & {
      position: absolute;
      top: 10px;
      right: 10px;
      display: grid;
      place-items: center;
      width: 23px;
      height: 23px;
      border-radius: 50%;
      color: var(--a-base-1);
      transition: background-color 200ms, color 200ms;
    }

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      color: var(--a-text-primary);
      background-color: color-mix(in srgb, var(--a-black) 6%, transparent);
    }

    &:focus-visible {
      outline: 1px solid var(--apos-assistant-activity-action);
      outline-offset: 1px;
    }
  }

  .apos-assistant-activity--warning {
    --apos-assistant-activity-action: var(--a-warning-dark);

    & {
      background-color: color-mix(in srgb, var(--a-warning) 12%, transparent);
    }
  }

  .apos-assistant-activity--general {
    --apos-assistant-activity-action: var(--a-primary);

    & {
      background-color: var(--a-base-10);
    }
  }

  .apos-assistant-activity__title {
    @include type-base;

    & {
      margin: 0;
      font-weight: var(--a-weight-bold);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-activity__title--dismissible {
    padding-right: 24px;
  }

  .apos-assistant-activity__text {
    @include type-base;

    & {
      margin: 0;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-activity__actions {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 2px;
  }

  .apos-assistant-activity__action {
    @include apos-button-reset();
    @include type-base;

    & {
      border-radius: var(--a-border-radius);
      color: var(--apos-assistant-activity-action);
    }

    &:hover:not([aria-disabled]) {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 1px solid var(--apos-assistant-activity-action);
      outline-offset: 2px;
    }

    &[aria-disabled] {
      opacity: 0.5;
      cursor: default;
    }
  }

  .apos-assistant-activity__action--quiet {
    color: var(--a-base-1);
  }

  .apos-assistant-activity__action--primary {
    & {
      padding: 5px 12px;
      color: var(--a-white);
      background-color: var(--a-primary);
      transition: background-color 200ms;
    }

    &:hover:not([aria-disabled]) {
      text-decoration: none;
      background-color: var(--a-primary-dark-10);
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
    }
  }
</style>
