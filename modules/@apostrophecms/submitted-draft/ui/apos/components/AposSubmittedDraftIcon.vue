<template>
  <span class="apos-submitted-drafts__container" :class="count < 1 ? 'apos-submitted-drafts__container--disabled' : ''">
    <AposIndicator
      icon="tray-full-icon"
      class="apos-submitted-drafts__icon"
      :icon-size="size"
    />
    <span v-if="canPublish && count > 0" class="apos-submitted-drafts__counter">
      {{ count }}
    </span>
  </span>
</template>
<script>
export default {
  name: 'AposSubmittedDraftIcon',
  props: {
    size: {
      type: Number,
      required: true,
      default() {
        return null;
      }
    }
  },
  data() {
    return {
      count: 0
    };
  },
  computed: {
    canPublish() {
      return window.apos.modules['@apostrophecms/submitted-draft'].canPublish;
    }
  },
  mounted() {
    this.updateCount();
  },
  destroyed() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  },
  methods: {
    async updateCount() {
      this.count = (await apos.http.get(apos.modules['@apostrophecms/submitted-draft'].action, {
        qs: {
          count: 1,
          'apos-mode': 'draft'
        }
      })).count;
      // Not declared in data() because it is not reactive
      this.timeout = setTimeout(this.updateCount, 10000);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-submitted-drafts__container {
    display: inline-flex;
    align-content: center;
    justify-items: space-between;
    &:hover {
      /deep/ .apos-submitted-drafts__icon svg {
        fill: var(--a-primary);
      }
    }
  }

  .apos-submitted-drafts__container--disabled {
    &:hover {
      cursor: not-allowed;
      pointer-events: none;
    }
    & /deep/ .apos-submitted-drafts__icon svg {
      fill: var(--a-base-6);
    }
  }

  .apos-submitted-drafts__counter {
    display: inline-flex;
    margin-left: $spacing-half;
    padding: 3px;
    background-color: var(--a-primary-10);
    border-radius: var(--a-border-radius);
    color: var(--a-primary);
    min-width: 15px;
    min-height: 15px;
    align-items: center;
    justify-content: center;
    font-size: var(--a-type-small);
    line-height: 0.9;
  }
</style>
