<template>
  <div role="alert" :class="classList">
    <span class="apos-notification__indicator">
      <AposIndicator
        :icon="iconComponent" class="apos-notification__indicator__icon"
        :icon-size="notification.icon ? 16 : 12"
      />
    </span>
    <span
      class="apos-notification__label"
      ref="label"
    >
      {{ localize(notification.message) }}
      <!-- OK to use index as key because buttons are constant for the lifetime of the notification -->
      <button
        v-for="(button, i) in notification.buttons"
        :key="i"
        :data-apos-bus-event="JSON.stringify({ name: button.name, data: button.data })"
      >
        {{ localize(button.label) }}
      </button>
    </span>
    <div
      class="apos-notification__progress"
      v-if="notification.progress && notification.progress.current"
    >
      <div class="apos-notification__progress-bar">
        <div
          class="apos-notification__progress-now" role="progressbar"
          :aria-valuenow="notification.progress.current" :style="`width: ${progressPercent}`"
          aria-valuemin="0" :aria-valuemax="100"
        />
      </div>
      <span class="apos-notification__progress-value">
        {{ progressPercent }}
      </span>
    </div>
    <button @click="close" class="apos-notification__button">
      <Close
        class="apos-notification__close-icon"
        title="Close Notification"
        :size="14"
      />
    </button>
  </div>
</template>

<script>
import Close from 'vue-material-design-icons/Close.vue';

export default {
  name: 'AposNotification',
  components: { Close },
  props: {
    notification: {
      type: Object,
      required: true
    }
  },
  emits: [ 'close' ],
  computed: {
    classList() {
      const classes = [ 'apos-notification' ];
      if (this.notification.type && this.notification.type !== 'none') {
        classes.push(`apos-notification--${this.notification.type}`);
      }

      if (this.notification.progress && this.notification.progress.notification.current) {
        classes.push('apos-notification--progress');
      }

      // long notifications look funky, but reading the label's length doesn't account for html.
      // Throw the string into a fake element to get its text content
      const div = document.createElement('div');
      div.innerHTML = this.localize(this.notification.message);
      const textContent = div.textContent || div.innerText || '';
      if (textContent.length > 160) {
        classes.push('apos-notification--long');
      }

      return classes.join(' ');
    },
    iconComponent () {
      if (this.notification.icon) {
        return this.notification.icon;
      } else {
        return 'circle-icon';
      }
    },
    progressPercent () {
      return `${Math.floor((this.notification.progress.current / 100) * 100)}%`;
    }
  },
  async mounted() {
    if (this.notification.dismiss) {
      setTimeout(() => {
        this.$emit('close', this.notification._id);
      }, 1000 * this.notification.dismiss);
    }
    this.$refs.label.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-apos-bus-event')) {
        this.close();
      }
    });
  },
  methods: {
    close() {
      this.$emit('close', this.notification._id);
    },
    localize(s) {
      let result;
      if (this.notification.localize !== false) {
        result = this.$t(s, this.notification.interpolate || {});
      } else {
        // Any interpolation was done before insertion
        result = s;
      }
      return result;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-notification {
    @include apos-transition();
    pointer-events: auto;
    position: relative;
    display: inline-flex;
    overflow: hidden;
    min-width: 200px;
    max-width: 500px;
    padding: 8px 35px 8px 8px;
    color: var(--a-text-inverted);
    background: var(--a-background-inverted);
    border-radius: 200px;
    box-shadow: var(--a-box-shadow);
    align-items: center;
    & + .apos-notification {
      margin-top: 8px;
    }
    &:hover {
      transform: translateY(-1px);
    }
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

  .apos-notification--success .apos-notification__indicator {
    background-color: var(--a-success-fade);
    color: var(--a-success);
  }

  .apos-notification--danger .apos-notification__indicator {
    background-color: var(--a-danger-fade);
    color: var(--a-danger);
  }

  .apos-notification__button {
    position: absolute;
    right: 2px;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 100%;
    padding: 20px 10px;
    border: none;
    background-color: transparent;
    color: var(--a-text-inverted);
    @include apos-transition(all);

    &:hover {
      cursor: pointer;
    }
  }

  .apos-notification__close-icon {
    height: 12px;
  }

  .apos-notification__label,
  .apos-notification__progress-value {
    @include type-base;
    color: var(--a-text-inverted);
    line-height: var(--a-line-tallest);
  }

  .apos-notification__label ::v-deep button {
    @include apos-button-reset();
    text-decoration: underline;
    text-decoration-color: var(--a-success);
    text-underline-offset: 3px;
    padding: 0 3px;
  }

  .apos-notification__progress {
    display: flex;
    align-items: center;
    flex-shrink: 0;
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
    background-image: linear-gradient(46deg, var(--a-brand-gold) 0%, var(--a-brand-red) 26%, var(--a-brand-magenta) 47%, var(--a-brand-blue) 76%, var(--a-brand-green) 100%);
    transition: width 0.2s ease-out;
  }

  .apos-notification__progress-value {
    margin-left: 20px;
  }
</style>
