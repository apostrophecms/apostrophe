<template>
  <div
    role="alert"
    :class="classList"
  >
    <span class="apos-notification__indicator">
      <AposIndicator
        :icon="iconComponent"
        class="apos-notification__indicator__icon"
        :icon-size="notification.icon ? 16 : 12"
      />
    </span>
    <span
      ref="label"
      class="apos-notification__label"
    >
      {{ localize(notification.message) }}
      <button
        v-for="(button, i) in notification.buttons"
        :key="i"
        :data-apos-bus-event="JSON.stringify({
          name: button.name,
          data: button.data
        })"
        @click="close"
      >
        {{ localize(button.label) }}
      </button>
    </span>
    <div
      v-if="process"
      class="apos-notification__progress"
    >
      <div class="apos-notification__progress-bar">
        <div
          class="apos-notification__progress-now"
          role="progressbar"
          :aria-valuenow="process.processed || 0"
          :style="`width: ${process.percent + '%'}`"
          aria-valuemin="0"
          :aria-valuemax="process.total"
        />
      </div>
      <span class="apos-notification__progress-value">
        {{ Math.floor(process.percent) + '%' }}
      </span>
    </div>
    <button
      v-if="!process"
      class="apos-notification__button"
      @click="close"
    >
      <Close
        class="apos-notification__close-icon"
        title="Close Notification"
        :size="14"
      />
    </button>
  </div>
</template>

<script setup>
import {
  ref, computed, inject, onMounted
} from 'vue';
import Close from '@apostrophecms/vue-material-design-icons/Close.vue';
import { useNotificationStore } from 'Modules/@apostrophecms/ui/stores/notification.js';

const props = defineProps({
  notification: {
    type: Object,
    required: true
  }
});

const $t = inject('i18n');
const emit = defineEmits([ 'close' ]);
const store = useNotificationStore();

const hasJob = props.notification.job && props.notification.job._id;
const job = ref(
  hasJob
    ? {
      route: `${apos.modules['@apostrophecms/job'].action}/${props.notification.job._id}`,
      action: props.notification.job.action,
      ids: props.notification.job.ids,
      docTypes: props.notification.job.docTypes
    }
    : null
);

const process = computed(() => {
  return store.processes[props.notification._id] || null;
});

const classList = computed(() => {
  const classes = [ 'apos-notification' ];

  if (Array.isArray(props.notification.classes) && props.notification.classes.length) {
    classes.push(...props.notification.classes);
  }

  if (props.notification.type && props.notification.type !== 'none') {
    classes.push(`apos-notification--${props.notification.type}`);
  }

  if (job.value) {
    classes.push('apos-notification--progress');
  }

  // long notifications look funky, but reading the label's length doesn't account for
  // html. Throw the string into a fake element to get its text content
  const div = document.createElement('div');
  div.innerHTML = localize(props.notification.message);
  const textContent = div.textContent || div.innerText || '';
  if (textContent.length > 160) {
    classes.push('apos-notification--long');
  }

  return classes.join(' ');
});

const iconComponent = computed(() => {
  if (props.notification.icon) {
    return props.notification.icon;
  } else {
    return 'circle-icon';
  }
});

onMounted(async () => {
  if (props.notification.dismiss) {
    setTimeout(() => {
      emit('close', props.notification._id);
    }, 1000 * props.notification.dismiss);
  }

  if (hasJob || props.notification.type === 'progress') {
    store.startProcess(props.notification._id);
  }

  if (hasJob) {
    store.pollJob(
      props.notification._id,
      job
    );
  }

  // Notifications may include events to emit.
  if (props.notification.event?.name) {
    try {
      // Clear the event to make sure it's only emitted once across browsers.
      const safe = await store.clearEvent(props.notification._id);

      if (safe) {
        // The notification doc will only still have the event in one instance.
        apos.bus.$emit(props.notification.event.name, props.notification.event.data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error($t('apostrophe:notificationClearEventError'));
    }
  }
});

function close() {
  emit('close', props.notification._id);
}

function localize(s) {
  return props.notification.localize !== false
    ? $t(s, props.notification.interpolate || {})
    : s;
}
</script>

<style lang="scss" scoped>
.apos-notification {
  @include apos-transition();

  & {
    position: relative;
    display: inline-flex;
    overflow: hidden;
    align-items: center;
    padding: 8px 35px 8px 8px;
    color: var(--a-text-inverted);
    background: var(--a-background-inverted);
    pointer-events: auto;
    min-width: 200px;
    max-width: 500px;
    border-radius: 200px;
    box-shadow: var(--a-box-shadow);
  }

  &+.apos-notification {
    margin-top: 8px;
  }

  &:hover {
    transform: translateY(-1px);
  }
}

.apos-notification--hidden {
  display: none;
}

.apos-notification--long {
  border-radius: 10px;
}

.apos-notification__indicator {
  position: relative;
  display: inline-flex;
  margin-right: 10px;
  padding: 5px;
  color: var(--a-base-1);
  border-radius: 50%;
  background-color: var(--a-base-1);
}

.apos-notification--warning .apos-notification__indicator {
  background-color: var(--a-warning-fade);
  color: var(--a-warning);
}

.apos-notification--success .apos-notification__indicator,
.apos-notification--progress .apos-notification__indicator {
  background-color: var(--a-success-fade);
  color: var(--a-success);
}

.apos-notification--danger .apos-notification__indicator {
  background-color: var(--a-danger-fade);
  color: var(--a-danger);
}

.apos-notification__button {
  @include apos-transition(all);

  & {
    position: absolute;
    right: 2px;
    display: flex;
    box-sizing: border-box;
    align-items: center;
    height: 100%;
    padding: 20px 10px;
    border: none;
    color: var(--a-text-inverted);
    background-color: transparent;
  }

  &:hover {
    cursor: pointer;
  }
}

.apos-notification__label,
.apos-notification__progress-value {
  @include type-base;

  & {
    color: var(--a-text-inverted);
   line-height: var(--a-line-tallest);
  }
}

.apos-notification__label :deep(button) {
  @include apos-button-reset();

  & {
    text-decoration: underline;
    text-decoration-color: var(--a-success);
    text-underline-offset: 3px;
    padding: 0 3px;
  }
}

.apos-notification__progress {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.apos-notification__progress-bar {
  width: 70px;
  height: 4px;
  margin-left: 20px;
  border-width: 0;
  background-color: var(--a-progress-bg);
}

.apos-notification__progress-now {
  height: 100%;
  background-color: var(--a-brand-green);
  background-image: linear-gradient(
    46deg,
    var(--a-brand-gold) 0%,
    var(--a-brand-red) 26%,
    var(--a-brand-magenta) 47%,
    var(--a-brand-blue) 76%,
    var(--a-brand-green) 100%
  );
  transition: width 500ms ease-out;
}

.apos-notification__progress-value {
  margin-left: 20px;
}
</style>
