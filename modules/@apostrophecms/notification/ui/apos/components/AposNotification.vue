<template>
  <div role="alert" :class="classList">
    <span class="apos-notification__indicator">
      <AposIndicator
        :icon="iconComponent" class="apos-notification__indicator__icon"
        :icon-size="icon ? 16 : 12"
      />
    </span>
    <span
      class="apos-notification__label" v-html="label"
      ref="label"
    />
    <div
      class="apos-notification__progress"
      v-if="progress && progress.current"
    >
      <div class="apos-notification__progress-bar">
        <div
          class="apos-notification__progress-now" role="progressbar"
          :aria-valuenow="progress.current" :style="`width: ${progressPercent}`"
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
    id: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: null
    },
    icon: {
      type: String,
      default: null
    },
    label: {
      default: 'Set a label',
      type: String
    },
    progress: {
      type: Object,
      default: null
    },
    dismiss: {
      type: Number,
      default: 0
    }
  },
  emits: [ 'close' ],
  computed: {
    classList() {
      const classes = [ 'apos-notification' ];
      if (this.type && this.type !== 'none') {
        classes.push(`apos-notification--${this.type}`);
      }

      if (this.progress && this.progress.current) {
        classes.push('apos-notification--progress');
      }

      // long notifications look funky, but reading the label's length doesn't account for html.
      // Throw the string into a fake element to get its text content
      const div = document.createElement('div');
      div.innerHTML = this.label;
      const textContent = div.textContent || div.innerText || '';
      if (textContent.length > 160) {
        classes.push('apos-notification--long');
      }

      return classes.join(' ');
    },
    iconComponent () {
      if (this.icon) {
        return this.icon;
      } else {
        return 'circle-icon';
      }
    },
    progressPercent () {
      return `${Math.floor((this.progress.current / 100) * 100)}%`;
    }
  },
  async mounted() {
    if (this.dismiss) {
      setTimeout(() => {
        this.$emit('close', this.id);
      }, 1000 * this.dismiss);
    }
    this.$refs.label.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-apos-bus-event')) {
        this.close();
      }
    });
  },
  methods: {
    close () {
      this.$emit('close', this.id);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-notification {
    @include apos-transition();
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
    line-height: var(--a-line-tallest);
  }

  .apos-notification__label /deep/ button {
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
