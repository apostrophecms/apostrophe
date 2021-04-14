<template>
  <div
    key="status"
    class="apos-admin-bar__status"
  >
    <span class="apos-admin-bar__status__inner">
      <component
        :is="savingIndicator.componentName"
        v-bind="savingIndicator.options"
        class="apos-admin-bar__status__icon"
      />
      <div class="apos-admin-bar__status__label" ref="statusLabel">
        {{ savingLabel }}
      </div>
    </span>
  </div>
</template>

<script>
export default {
  name: 'TheAposSavingIndicator',
  props: {
    retrying: Boolean,
    editing: Boolean,
    saving: Boolean,
    saved: Boolean
  },
  data() {
    return {
      savingStatus: {
        transitioning: false,
        messages: {
          1: {
            label: 'Document Saved',
            icon: 'database-check-icon',
            class: 'is-success'
          },
          2: {
            label: 'Saving document...',
            component: 'AposSpinner'
          },
          3: {
            label: 'Retrying Save document...',
            component: 'AposSpinner',
            class: 'is-warning'
          }
        }
      }
    };
  },
  computed: {
    savingIndicator() {
      let componentName = '';
      const options = {};
      if (this.savingStep) {
        const currentStep = this.savingStatus.messages[this.savingStep];
        // form indicator component + options
        if (currentStep.component) {
          componentName = currentStep.component;
        } else {
          componentName = 'AposIndicator';
        }
        if (currentStep.icon) {
          options.icon = currentStep.icon;
          options.iconSize = 15;
        }
        if (currentStep.class) {
          options.class = currentStep.class;
        }

        if (componentName === 'AposIndicator') { // icon, include status tooltip where possible
          options.tooltip = this.savingStatus.messages[this.savingStep].label;
        }
      };
      return {
        componentName,
        options
      };
    },
    savingStep() {
      let s = null;
      if (this.retrying) {
        s = 3;
      } else if (this.saving || this.editing) {
        s = 2;
      } else if (this.saved) {
        s = 1;
      }
      return s;
    },
    savingLabel() {
      if (this.savingStep) {
        return this.savingStatus.messages[this.savingStep].label;
      } else {
        return '';
      }
    }
  },
  watch: {
    savingStep(newVal) {
      if (this.$refs.statusLabel) {
        const self = this;
        apos.util.removeClass(self.$refs.statusLabel, 'is-hidden');
        if (this.savingTimeout) {
          clearTimeout(this.savingTimeout);
        }
        this.savingTimeout = setTimeout(() => {
          // Mind race conditions
          if (self.$refs.statusLabel) {
            apos.util.addClass(self.$refs.statusLabel, 'is-hidden');
          }
        }, 5000);
      }
    }
  }
};

</script>

<style lang="scss" scoped>
.apos-admin-bar__status {
  @include type-help;
  position: relative;
  margin-left: 7.5px;
  opacity: 1;
  color: var(--a-base-2);
  transition: opacity 150ms;
  &.is-hidden {
    opacity: 0;
  }
  .is-success {
    color: var(--a-success);
  }

  .is-warning {
    color: var(--a-warning);
  }
}

.apos-admin-bar__status__inner {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  white-space: nowrap;
}

.apos-admin-bar__status__icon {
  margin-right: 7.5px;
  width: 18px;
  height: 18px;
}

.apos-admin-bar__status__label {
  opacity: 1;
  transition: opacity 200ms ease;
  &.is-hidden {
    opacity: 0;
  }
}
</style>
