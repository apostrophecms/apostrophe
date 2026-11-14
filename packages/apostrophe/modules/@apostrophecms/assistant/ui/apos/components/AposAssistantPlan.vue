<template>
  <AposAssistantDock
    tone="default"
    role="group"
    :label="$t('apostrophe:assistantPlan')"
    :collapsed="collapsed"
    data-apos-test="assistant-plan"
    :data-apos-failed="failed ? 'true' : null"
  >
    <template
      v-if="confirming"
      #toolbar
    >
      <div
        class="apos-assistant-plan__confirm"
        role="group"
        :aria-label="$t('apostrophe:assistantPlanCancelConfirm')"
        data-apos-test="assistant-plan-confirm"
        @keydown.esc.stop.prevent="closeConfirm"
      >
        <p class="apos-assistant-plan__confirm-copy">
          {{ $t('apostrophe:assistantPlanCancelConfirm') }}
        </p>
        <button
          type="button"
          class="apos-assistant-plan__text-button apos-assistant-plan__text-button--yes"
          data-apos-test="assistant-plan-cancel-yes"
          @click="confirmCancel"
        >
          {{ $t('apostrophe:yes') }}
        </button>
        <button
          ref="noButton"
          type="button"
          class="apos-assistant-plan__text-button"
          data-apos-test="assistant-plan-cancel-no"
          @click="closeConfirm"
        >
          {{ $t('apostrophe:no') }}
        </button>
      </div>
    </template>
    <template
      v-else
      #toolbar
    >
      <button
        type="button"
        class="apos-assistant-plan__toggle"
        :aria-expanded="collapsed ? 'false' : 'true'"
        :aria-controls="listId"
        data-apos-test="assistant-plan-toggle"
        @click="collapsed = !collapsed"
      >
        <svg
          class="apos-assistant-plan__chevron"
          :class="{ 'apos-assistant-plan__chevron--collapsed': collapsed }"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-if="failed && collapsed"
          class="apos-assistant-plan__icon apos-assistant-plan__icon--failed"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          data-apos-test="assistant-plan-failed"
        >
          <path :d="ICONS.failed" />
        </svg>
        <span
          class="apos-assistant-plan__label"
          aria-live="polite"
          data-apos-test="assistant-plan-label"
        >{{ $t('apostrophe:assistantPlanStep', { step: current + 1, count: steps.length }) }}<span
          v-if="failed"
          class="apos-sr-only"
        >{{ ` ${$t('apostrophe:assistantPlanStepFailed')}` }}</span></span>
      </button>
      <button
        v-if="cancellable"
        ref="cancelButton"
        type="button"
        class="apos-assistant-plan__cancel"
        data-apos-test="assistant-plan-cancel"
        @click="openConfirm"
      >
        {{ $t('apostrophe:cancel') }}
      </button>
    </template>
    <ol
      v-show="!collapsed"
      :id="listId"
      class="apos-assistant-plan__list"
    >
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="apos-assistant-plan__step"
        :class="`apos-assistant-plan__step--${stateOf(step, index)}`"
        data-apos-test="assistant-plan-step"
        :data-apos-state="stateOf(step, index)"
      >
        <svg
          class="apos-assistant-plan__icon"
          :class="`apos-assistant-plan__icon--${stateOf(step, index)}`"
          viewBox="0 0 24 24"
          :fill="stateOf(step, index) === 'active' ? 'none' : 'currentColor'"
          :stroke="stateOf(step, index) === 'active' ? 'currentColor' : null"
          :stroke-width="stateOf(step, index) === 'active' ? 2 : null"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path :d="ICONS[stateOf(step, index)]" />
        </svg>
        <span class="apos-sr-only">{{ $t(STATES[stateOf(step, index)]) }}</span>
        <span class="apos-assistant-plan__title">{{ step.title }}</span>
      </li>
    </ol>
  </AposAssistantDock>
</template>

<script setup>
import {
  computed, nextTick, ref, watch
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

// The plan of the chat's request, in the dock above the composer, "Plan ·
// step N of M": the steps done, the one in progress, those to come. When
// the request failed, the step it was on failed with it, and the plan
// folds to its toolbar, marked failed there only while folded (the open
// list marks the step). The steps are the model's words, never translated.
// Cancel, on the toolbar's hover or focus, asks before it emits `cancel`:
// the request stops and its work is reverted
const props = defineProps({
  request: {
    type: Object,
    required: true
  },
  failed: {
    type: Boolean,
    default: false
  },
  cancellable: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits([ 'cancel' ]);

const ICONS = {
  done: 'M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z',
  active: 'M21 12a9 9 0 1 1-6.219-8.56',
  pending: 'M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z',
  failed: 'M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z'
};

// What a screen reader hears before each step
const STATES = {
  done: 'apostrophe:assistantPlanDone',
  active: 'apostrophe:assistantPlanActive',
  pending: 'apostrophe:assistantPlanPending',
  failed: 'apostrophe:assistantPlanFailed'
};

const listId = `apos-assistant-plan-${createId()}`;
const collapsed = ref(props.failed);
const confirming = ref(false);
const noButton = ref(null);
const cancelButton = ref(null);
const steps = computed(() => props.request.plan || []);
// The step in progress: the active one, else the first not done
const current = computed(() => {
  const active = steps.value.findIndex(step => step.status === 'active');
  if (active !== -1) {
    return active;
  }
  const next = steps.value.findIndex(step => step.status !== 'done');
  return (next === -1) ? steps.value.length - 1 : next;
});

watch(() => props.failed, (failed) => {
  collapsed.value = failed;
});

async function openConfirm() {
  confirming.value = true;
  await nextTick();
  noButton.value?.focus();
}

async function closeConfirm() {
  confirming.value = false;
  await nextTick();
  cancelButton.value?.focus();
}

function confirmCancel() {
  confirming.value = false;
  emit('cancel');
}

function stateOf(step, index) {
  if (props.failed && (index === current.value) && (step.status !== 'done')) {
    return 'failed';
  }
  return step.status;
}
</script>

<style lang="scss" scoped>
  .apos-assistant-plan__toggle {
    @include apos-button-reset();
    @include type-base;

    & {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      min-width: 0;
      padding: 6px 0;
      color: var(--a-text-primary);
      text-align: left;
      gap: 8px;
      border-radius: var(--a-border-radius);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  // The prototype's: shown on the toolbar's hover or focus
  .apos-assistant-plan__cancel {
    @include apos-button-reset();
    @include type-base;

    & {
      flex-shrink: 0;
      margin-right: 6px;
      padding: 2px 4px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
      opacity: 0;
      transition: color 200ms, opacity 200ms;
      pointer-events: none;
    }

    &:hover {
      color: var(--a-text-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  :deep(.apos-assistant-dock__toolbar:hover) .apos-assistant-plan__cancel,
  :deep(.apos-assistant-dock__toolbar:focus-within) .apos-assistant-plan__cancel {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-assistant-plan__confirm {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 0;
  }

  .apos-assistant-plan__confirm-copy {
    @include type-base;

    & {
      overflow: hidden;
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      color: var(--a-text-primary);
      line-height: var(--a-line-tall);
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .apos-assistant-plan__text-button {
    @include apos-button-reset();
    @include type-base;

    & {
      flex-shrink: 0;
      padding: 2px 6px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
      transition: background-color 200ms, color 200ms;
    }

    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  // The theme's red, darkened to read at 4.5:1
  .apos-assistant-plan__text-button--yes {
    color: color-mix(in srgb, var(--a-danger) 80%, var(--a-black));

    &:hover {
      color: color-mix(in srgb, var(--a-danger) 80%, var(--a-black));
      background-color: var(--a-danger-button-background);
    }
  }

  .apos-assistant-plan__chevron {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--a-base-3);
    transition: transform 280ms;
  }

  .apos-assistant-plan__chevron--collapsed {
    transform: rotate(-90deg);
  }

  .apos-assistant-plan__label {
    overflow: hidden;
    min-width: 0;
    line-height: var(--a-line-tall);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apos-assistant-plan__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 4px;
    padding: 0;
    list-style: none;
  }

  .apos-assistant-plan__step {
    @include type-base;

    & {
      display: flex;
      align-items: center;
      min-width: 0;
      padding: 6px 10px;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
      gap: 8px;
      border-radius: var(--a-border-radius);
    }
  }

  // Quieter than the steps to come, at 4.5:1
  .apos-assistant-plan__step--done {
    color: var(--a-base-2);
  }

  .apos-assistant-plan__step--active {
    color: var(--a-text-primary);
    background-color: color-mix(in srgb, var(--a-primary) 6%, var(--a-background-primary));
  }

  .apos-assistant-plan__step--failed {
    color: var(--a-text-primary);
    background-color: color-mix(in srgb, var(--a-danger) 6%, var(--a-background-primary));
  }

  .apos-assistant-plan__title {
    overflow: hidden;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apos-assistant-plan__icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  .apos-assistant-plan__icon--done {
    color: var(--a-success-dark);
  }

  .apos-assistant-plan__icon--active {
    color: var(--a-base-4);
  }

  .apos-assistant-plan__icon--pending {
    color: var(--a-base-5);
  }

  .apos-assistant-plan__icon--failed {
    color: var(--a-danger);
  }
</style>
